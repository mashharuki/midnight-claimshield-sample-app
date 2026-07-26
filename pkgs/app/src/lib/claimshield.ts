import * as CompactJs from "@midnight-ntwrk/compact-js";
import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import type {
  MidnightProvider,
  ProofProvider,
  UnboundTransaction,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { assertIsContractAddress } from "@midnight-ntwrk/midnight-js-utils";
import {
  ClaimShield,
  type ClaimShieldPrivateState,
  claimShieldWitnesses,
  createInitialClaimShieldPrivateState,
} from "contract";
import * as Rx from "rxjs";
import {
  type ClaimantClaimProjection,
  type ClaimInput,
  type ClaimOperation,
  type ClaimOperationResult,
  type ClaimShieldContractInstance,
  type ClaimShieldLedgerState,
  ClaimShieldPrivateStateId,
  type ClaimShieldProviders,
  ClaimStatus,
  type ClaimTransactionState,
  type ClaimUiError,
  type DeployedClaimShieldContract,
  type PolicyInput,
  PolicyState,
  type TransactionStage,
} from "shared";

const CLAIMSHIELD_CONFIRMATION_TIMEOUT_MS = 120_000;
const UINT64_MAX = (1n << 64n) - 1n;

class ClaimShieldUiErrorCause extends Error {
  readonly uiError: ClaimUiError;

  constructor(uiError: ClaimUiError) {
    super(uiError.code);
    this.uiError = uiError;
  }
}

export type ClaimShieldStageReporter = (state: ClaimTransactionState) => void;

type ClaimShieldStageTransition = (stage: TransactionStage) => void;

type ClaimShieldTransactionOptions<Result> = Readonly<{
  operation: Exclude<ClaimOperation, null>;
  report: ClaimShieldStageReporter;
  execute: (transition: ClaimShieldStageTransition) => Promise<Result>;
  confirm: (result: Result) => Promise<void>;
}>;

type ClaimShieldDeployConfiguration = Readonly<{
  compiledContract: ClaimShieldContractInstance;
  privateStateId: typeof ClaimShieldPrivateStateId;
  initialPrivateState: ClaimShieldPrivateState;
  args: [
    Uint8Array,
    Uint8Array,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
    Uint8Array,
  ];
}>;

type ClaimShieldFindConfiguration = Readonly<{
  compiledContract: ClaimShieldContractInstance;
  contractAddress: ContractAddress;
  privateStateId: typeof ClaimShieldPrivateStateId;
  initialPrivateState?: ClaimShieldPrivateState;
}>;

/**
 * The production runtime calls the Midnight SDK directly. Keeping this narrow
 * boundary injectable makes the generated-binding integration testable without
 * a wallet, prover, or network in the browser test runner.
 */
export type ClaimShieldAdapterRuntime = Readonly<{
  deploy(
    providers: ClaimShieldProviders,
    configuration: ClaimShieldDeployConfiguration,
  ): Promise<DeployedClaimShieldContract>;
  find(
    providers: ClaimShieldProviders,
    configuration: ClaimShieldFindConfiguration,
  ): Promise<DeployedClaimShieldContract>;
  projectLedger(state: unknown): ClaimShieldLedgerState;
  deriveClaimantKey(
    ledger: ClaimShieldLedgerState,
    privateState: ClaimShieldPrivateState,
  ): Uint8Array;
}>;

export type ClaimShieldAdapter = Readonly<{
  deployPolicy(input: PolicyInput): Promise<ClaimOperationResult>;
  joinPolicy(address: string): Promise<ClaimOperationResult>;
  submitClaim(input: ClaimInput): Promise<ClaimOperationResult>;
  closePolicy(): Promise<ClaimOperationResult>;
  approveClaim(claimantKey: Uint8Array): Promise<ClaimOperationResult>;
  rejectClaim(claimantKey: Uint8Array): Promise<ClaimOperationResult>;
  redeemClaim(): Promise<ClaimOperationResult>;
  getPersonalClaimProjection(
    ledger: ClaimShieldLedgerState,
  ): Promise<ClaimantClaimProjection | null>;
  subscribe(address: ContractAddress): Rx.Observable<ClaimShieldLedgerState>;
  getContract(): DeployedClaimShieldContract | null;
  getContractAddress(): ContractAddress | null;
}>;

const claimShieldBase = CompactJs.CompiledContract.make(
  "claimshield",
  // biome-ignore lint/suspicious/noExplicitAny: generated Compact constructor generic is not exposed by compact-js
  ClaimShield.Contract as any,
);

export const claimShieldContractInstance = (
  CompactJs.CompiledContract.withWitnesses as unknown as (
    contract: unknown,
    witnesses: unknown,
  ) => unknown
)(claimShieldBase, claimShieldWitnesses) as ClaimShieldContractInstance;

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const bytesAreZero = (value: Uint8Array): boolean =>
  value.every((byte) => byte === 0);

const claimPayloadMatchesInput = (
  claim: NonNullable<ClaimShieldPrivateState["claim"]>,
  input: ClaimInput,
): boolean =>
  claim.amount === input.amount &&
  bytesEqual(claim.merchantDigest, input.merchantDigest) &&
  bytesEqual(claim.evidenceDigest, input.evidenceDigest) &&
  bytesEqual(claim.opaqueReceiptIdentifier, input.opaqueReceiptIdentifier);

const randomBytes32 = (): Uint8Array<ArrayBuffer> => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Browser cryptography is unavailable.");
  }
  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

/** Always make a non-zero CSPRNG secret; never use the witness test default. */
export const createFreshClaimShieldPrivateState = (): ClaimShieldPrivateState =>
  createInitialClaimShieldPrivateState(randomBytes32());

const encodeFixedText = (value: string): Uint8Array => {
  const encoded = new TextEncoder().encode(value.trim());
  if (encoded.length === 0 || encoded.length > 32) {
    throw new Error(
      "ClaimShield policy text must contain between 1 and 32 bytes.",
    );
  }
  const result = new Uint8Array(32);
  result.set(encoded);
  return result;
};

const requireUint64 = (value: bigint): void => {
  if (value < 0n || value > UINT64_MAX) {
    throw new Error("ClaimShield value is outside Uint64.");
  }
};

const validatePolicyInput = (input: PolicyInput): void => {
  encodeFixedText(input.label);
  encodeFixedText(input.category);
  for (const value of [
    input.startAt,
    input.endAt,
    input.minimumAmount,
    input.maximumAmount,
    input.fixedBenefit,
  ]) {
    requireUint64(value);
  }
  if (
    input.startAt >= input.endAt ||
    input.minimumAmount > input.maximumAmount ||
    input.fixedBenefit === 0n
  ) {
    throw new Error("ClaimShield policy period is invalid.");
  }
};

const validateClaimInput = (
  input: ClaimInput,
  ledger: ClaimShieldLedgerState,
): void => {
  requireUint64(input.amount);
  if (
    input.amount < ledger.minimumAmount ||
    input.amount > ledger.maximumAmount
  ) {
    throw new Error("Claim amount is outside policy range.");
  }
  for (const value of [
    input.merchantDigest,
    input.evidenceDigest,
    input.opaqueReceiptIdentifier,
  ]) {
    if (value.length !== 32) {
      throw new Error("Claim private digest must have 32 bytes.");
    }
  }
  if (bytesAreZero(input.opaqueReceiptIdentifier)) {
    throw new Error("Claim receipt identifier is required.");
  }
};

const toClaimShieldLedgerState = (
  state: Parameters<typeof ClaimShield.ledger>[0],
): ClaimShieldLedgerState => {
  const ledger = ClaimShield.ledger(state);
  return {
    policyState: ledger.policy_state,
    adminKey: ledger.admin_key,
    policyNonce: ledger.policy_nonce,
    policyLabel: ledger.policy_label,
    policyCategory: ledger.policy_category,
    startAt: ledger.start_at,
    endAt: ledger.end_at,
    minimumAmount: ledger.minimum_amount,
    maximumAmount: ledger.maximum_amount,
    fixedBenefit: ledger.fixed_benefit,
    submittedCount: ledger.submitted_count,
    approvedCount: ledger.approved_count,
    plannedBenefitTotal: ledger.planned_benefit_total,
    claims: ledger.claims,
    commitments: ledger.commitments,
    usedReceiptNullifiers: ledger.used_receipt_nullifiers,
  };
};

const errorMessage = (cause: unknown): string => {
  const messages: string[] = [];
  let current: unknown = cause;
  while (current && typeof current === "object" && messages.length < 8) {
    if (current instanceof Error) messages.push(current.message);
    current = "cause" in current ? current.cause : undefined;
  }
  return messages.join(" ").toLowerCase();
};

const mapClaimShieldError = (
  stage: TransactionStage,
  cause: unknown,
): ClaimUiError => {
  if (cause instanceof ClaimShieldUiErrorCause) return cause.uiError;
  const message = errorMessage(cause);

  if (
    message.includes("private payload") ||
    message.includes("private state")
  ) {
    return { kind: "privateState", code: "claimPayloadUnavailable" };
  }
  if (message.includes("outside policy range")) {
    return { kind: "input", code: "amountOutOfRange" };
  }
  if (message.includes("contract address")) {
    return { kind: "input", code: "invalidContractAddress" };
  }
  if (message.includes("receipt") && message.includes("required")) {
    return { kind: "input", code: "missingReceipt" };
  }
  if (message.includes("policy period") || message.includes("uint64")) {
    return { kind: "input", code: "invalidPolicyPeriod" };
  }
  if (message.includes("policy is closed")) {
    return { kind: "business", code: "policyClosed" };
  }
  if (message.includes("receipt has already been used")) {
    return { kind: "business", code: "duplicateReceipt" };
  }
  if (message.includes("already been decided")) {
    return { kind: "business", code: "claimAlreadyDecided" };
  }
  if (message.includes("not approved for redemption")) {
    return { kind: "business", code: "claimNotRedeemable" };
  }
  if (message.includes("rejected") || message.includes("cancel")) {
    return { kind: "wallet", code: "walletRejected" };
  }
  if (
    message.includes("wallet") ||
    message.includes("lace") ||
    message.includes("network mismatch")
  ) {
    return message.includes("mismatch")
      ? { kind: "wallet", code: "networkMismatch" }
      : { kind: "wallet", code: "walletUnavailable" };
  }
  if (stage === "proving") return { kind: "proof", code: "proofFailed" };
  if (stage === "confirming") {
    return { kind: "proof", code: "confirmationFailed" };
  }
  return { kind: "proof", code: "submissionFailed" };
};

/**
 * Runs a write without exposing SDK errors. `succeeded` is emitted only after
 * the caller's Indexer predicate has observed the expected public ledger.
 */
export async function runClaimShieldTransaction<Result>(
  options: ClaimShieldTransactionOptions<Result>,
): Promise<ClaimOperationResult> {
  let currentStage: TransactionStage = "idle";
  const transition: ClaimShieldStageTransition = (stage) => {
    if (currentStage === stage) return;
    currentStage = stage;
    options.report({ operation: options.operation, stage, error: null });
  };

  transition("preparing");
  try {
    const result = await options.execute(transition);
    transition("confirming");
    await options.confirm(result);
    transition("succeeded");
    return { ok: true };
  } catch (cause: unknown) {
    const error = mapClaimShieldError(currentStage, cause);
    currentStage = "failed";
    options.report({ operation: options.operation, stage: "failed", error });
    return { ok: false, error };
  }
}

const withTransactionStages = (
  providers: ClaimShieldProviders,
  transition: ClaimShieldStageTransition,
): ClaimShieldProviders => {
  const proofProvider: ProofProvider = {
    async proveTx(tx, config) {
      transition("proving");
      return providers.proofProvider.proveTx(tx, config);
    },
  };
  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => providers.walletProvider.getCoinPublicKey(),
    getEncryptionPublicKey: () =>
      providers.walletProvider.getEncryptionPublicKey(),
    async balanceTx(tx: UnboundTransaction, ttl?: Date) {
      transition("awaitingSignature");
      return providers.walletProvider.balanceTx(tx, ttl);
    },
  };
  const midnightProvider: MidnightProvider = {
    async submitTx(tx) {
      transition("submitting");
      const transactionId = await providers.midnightProvider.submitTx(tx);
      transition("confirming");
      return transactionId;
    },
  };

  return {
    ...providers,
    proofProvider,
    walletProvider,
    midnightProvider,
  };
};

const contractAddressFrom = (
  contract: DeployedClaimShieldContract,
): ContractAddress =>
  (
    contract as unknown as {
      deployTxData: { public: { contractAddress: ContractAddress } };
    }
  ).deployTxData.public.contractAddress;

/** The generated binding's complete public write surface. */
type ClaimShieldGeneratedCallTx = Readonly<{
  close_policy(): Promise<unknown>;
  submit_claim(): Promise<unknown>;
  approve_claim(claimantKey: Uint8Array): Promise<unknown>;
  reject_claim(claimantKey: Uint8Array): Promise<unknown>;
  redeem_claim(): Promise<unknown>;
}>;

const generatedCallTx = (
  contract: DeployedClaimShieldContract,
): ClaimShieldGeneratedCallTx =>
  (
    contract as unknown as {
      callTx: ClaimShieldGeneratedCallTx;
    }
  ).callTx;

const defaultClaimShieldAdapterRuntime: ClaimShieldAdapterRuntime = {
  async deploy(providers, configuration) {
    return (await deployContract(providers, {
      // biome-ignore lint/suspicious/noExplicitAny: Midnight.js cannot infer generated Compact constructor arguments through shared aliases
      compiledContract: configuration.compiledContract as any,
      privateStateId: configuration.privateStateId,
      initialPrivateState: configuration.initialPrivateState,
      args: configuration.args,
    })) as unknown as DeployedClaimShieldContract;
  },
  async find(providers, configuration) {
    return (await findDeployedContract(providers, {
      // biome-ignore lint/suspicious/noExplicitAny: SDK generic inference does not retain the generated witness shape through shared aliases
      compiledContract: configuration.compiledContract as any,
      contractAddress: configuration.contractAddress,
      privateStateId: configuration.privateStateId,
      ...(configuration.initialPrivateState
        ? { initialPrivateState: configuration.initialPrivateState }
        : {}),
    })) as unknown as DeployedClaimShieldContract;
  },
  projectLedger: (state) =>
    toClaimShieldLedgerState(state as Parameters<typeof ClaimShield.ledger>[0]),
  deriveClaimantKey: (ledger, privateState) =>
    ClaimShield.pureCircuits.derive_claimant_key(
      ledger.policyNonce,
      privateState.secretKey,
    ),
};

export function createClaimShieldAdapter(
  providers: ClaimShieldProviders,
  report: ClaimShieldStageReporter,
  runtime: ClaimShieldAdapterRuntime = defaultClaimShieldAdapterRuntime,
): ClaimShieldAdapter {
  let contract: DeployedClaimShieldContract | null = null;
  let contractAddress: ContractAddress | null = null;

  const subscribe = (address: ContractAddress) =>
    providers.publicDataProvider
      .contractStateObservable(address, { type: "latest" })
      .pipe(Rx.map((state) => runtime.projectLedger(state.data)));

  const readLedger = async (
    address: ContractAddress,
  ): Promise<ClaimShieldLedgerState | null> => {
    const state =
      await providers.publicDataProvider.queryContractState(address);
    return state ? runtime.projectLedger(state.data) : null;
  };

  const waitForLedger = async (
    address: ContractAddress,
    predicate: (ledger: ClaimShieldLedgerState) => boolean,
  ): Promise<void> => {
    const current = await readLedger(address);
    if (current && predicate(current)) return;

    await Rx.firstValueFrom(
      subscribe(address).pipe(
        Rx.filter(predicate),
        Rx.take(1),
        Rx.timeout({ first: CLAIMSHIELD_CONFIRMATION_TIMEOUT_MS }),
      ),
    );
  };

  const requireConnectedContract = (): {
    contract: DeployedClaimShieldContract;
    address: ContractAddress;
  } => {
    if (!contract || !contractAddress) {
      throw new Error("ClaimShield contract is not connected.");
    }
    return { contract, address: contractAddress };
  };

  const transactionContractFor = async (
    transition: ClaimShieldStageTransition,
  ): Promise<DeployedClaimShieldContract> => {
    const { address } = requireConnectedContract();
    providers.privateStateProvider.setContractAddress(address);
    return await runtime.find(withTransactionStages(providers, transition), {
      compiledContract: claimShieldContractInstance,
      contractAddress: address,
      privateStateId: ClaimShieldPrivateStateId,
    });
  };

  const readOrCreatePrivateState = async (
    address: ContractAddress,
  ): Promise<{ state: ClaimShieldPrivateState; existed: boolean }> => {
    providers.privateStateProvider.setContractAddress(address);
    const existing = await providers.privateStateProvider.get(
      ClaimShieldPrivateStateId,
    );
    return existing
      ? { state: existing, existed: true }
      : { state: createFreshClaimShieldPrivateState(), existed: false };
  };

  const claimantKeyFor = runtime.deriveClaimantKey;

  return {
    async deployPolicy(input) {
      let deployed: DeployedClaimShieldContract | null = null;
      return runClaimShieldTransaction({
        operation: "deploy",
        report,
        execute: async (transition) => {
          validatePolicyInput(input);
          const initialPrivateState = createFreshClaimShieldPrivateState();
          deployed = await runtime.deploy(
            withTransactionStages(providers, transition),
            {
              compiledContract: claimShieldContractInstance,
              privateStateId: ClaimShieldPrivateStateId,
              initialPrivateState,
              args: [
                encodeFixedText(input.label),
                encodeFixedText(input.category),
                input.startAt,
                input.endAt,
                input.minimumAmount,
                input.maximumAmount,
                input.fixedBenefit,
                randomBytes32(),
              ],
            },
          );
          return deployed;
        },
        confirm: async (nextContract) => {
          const address = contractAddressFrom(nextContract);
          await waitForLedger(
            address,
            (ledger) =>
              ledger.policyState === PolicyState.open &&
              ledger.submittedCount === 0n &&
              ledger.approvedCount === 0n &&
              ledger.plannedBenefitTotal === 0n &&
              ledger.startAt === input.startAt &&
              ledger.endAt === input.endAt &&
              ledger.minimumAmount === input.minimumAmount &&
              ledger.maximumAmount === input.maximumAmount &&
              ledger.fixedBenefit === input.fixedBenefit &&
              bytesEqual(ledger.policyLabel, encodeFixedText(input.label)) &&
              bytesEqual(
                ledger.policyCategory,
                encodeFixedText(input.category),
              ),
          );
          contract = nextContract;
          contractAddress = address;
        },
      });
    },

    async joinPolicy(address) {
      return runClaimShieldTransaction({
        operation: "join",
        report,
        execute: async () => {
          try {
            assertIsContractAddress(address);
          } catch {
            throw new ClaimShieldUiErrorCause({
              kind: "input",
              code: "invalidContractAddress",
            });
          }
          const nextAddress = address;
          const privateState = await readOrCreatePrivateState(nextAddress);
          const found = privateState.existed
            ? await runtime.find(providers, {
                compiledContract: claimShieldContractInstance,
                contractAddress: nextAddress,
                privateStateId: ClaimShieldPrivateStateId,
              })
            : await runtime.find(providers, {
                compiledContract: claimShieldContractInstance,
                contractAddress: nextAddress,
                privateStateId: ClaimShieldPrivateStateId,
                initialPrivateState: privateState.state,
              });
          return found as unknown as DeployedClaimShieldContract;
        },
        confirm: async (nextContract) => {
          const nextAddress = contractAddressFrom(nextContract);
          await waitForLedger(nextAddress, () => true);
          contract = nextContract;
          contractAddress = nextAddress;
        },
      });
    },

    async submitClaim(input) {
      return runClaimShieldTransaction({
        operation: "submit",
        report,
        execute: async (transition) => {
          const current = requireConnectedContract();
          const ledger = await readLedger(current.address);
          if (!ledger)
            throw new Error("ClaimShield contract state is unavailable.");
          validateClaimInput(input, ledger);
          providers.privateStateProvider.setContractAddress(current.address);
          const privateState = await providers.privateStateProvider.get(
            ClaimShieldPrivateStateId,
          );
          if (!privateState)
            throw new Error("Claim private payload is unavailable");
          if (
            privateState.claim &&
            !claimPayloadMatchesInput(privateState.claim, input)
          ) {
            throw new Error("Claim private payload is already stored.");
          }
          const nextPrivateState: ClaimShieldPrivateState = {
            ...privateState,
            claim: privateState.claim ?? {
              amount: input.amount,
              merchantDigest: new Uint8Array(input.merchantDigest),
              evidenceDigest: new Uint8Array(input.evidenceDigest),
              opaqueReceiptIdentifier: new Uint8Array(
                input.opaqueReceiptIdentifier,
              ),
              salt: randomBytes32(),
            },
          };
          // Keep this payload through ambiguous transport failures. It is the
          // only input that can later prove a successful submission/redeem.
          await providers.privateStateProvider.set(
            ClaimShieldPrivateStateId,
            nextPrivateState,
          );
          await generatedCallTx(
            await transactionContractFor(transition),
          ).submit_claim();
          return {
            ledger,
            privateState: nextPrivateState,
            address: current.address,
          };
        },
        confirm: async ({ ledger, privateState, address }) => {
          const claimantKey = claimantKeyFor(ledger, privateState);
          await waitForLedger(
            address,
            (next) =>
              next.claims.member(claimantKey) &&
              next.claims.lookup(claimantKey) === ClaimStatus.submitted &&
              next.commitments.member(claimantKey),
          );
        },
      });
    },

    async closePolicy() {
      return runClaimShieldTransaction({
        operation: "close",
        report,
        execute: async (transition) => {
          const current = requireConnectedContract();
          await generatedCallTx(
            await transactionContractFor(transition),
          ).close_policy();
          return current.address;
        },
        confirm: async (address) =>
          waitForLedger(
            address,
            (ledger) => ledger.policyState === PolicyState.closed,
          ),
      });
    },

    async approveClaim(claimantKey) {
      return runClaimShieldTransaction({
        operation: "review",
        report,
        execute: async (transition) => {
          const current = requireConnectedContract();
          await generatedCallTx(
            await transactionContractFor(transition),
          ).approve_claim(claimantKey);
          return current.address;
        },
        confirm: async (address) =>
          waitForLedger(
            address,
            (ledger) =>
              ledger.claims.lookup(claimantKey) === ClaimStatus.approved,
          ),
      });
    },

    async rejectClaim(claimantKey) {
      return runClaimShieldTransaction({
        operation: "review",
        report,
        execute: async (transition) => {
          const current = requireConnectedContract();
          await generatedCallTx(
            await transactionContractFor(transition),
          ).reject_claim(claimantKey);
          return current.address;
        },
        confirm: async (address) =>
          waitForLedger(
            address,
            (ledger) =>
              ledger.claims.lookup(claimantKey) === ClaimStatus.rejected,
          ),
      });
    },

    async redeemClaim() {
      return runClaimShieldTransaction({
        operation: "redeem",
        report,
        execute: async (transition) => {
          const current = requireConnectedContract();
          const ledger = await readLedger(current.address);
          if (!ledger)
            throw new Error("ClaimShield contract state is unavailable.");
          providers.privateStateProvider.setContractAddress(current.address);
          const privateState = await providers.privateStateProvider.get(
            ClaimShieldPrivateStateId,
          );
          if (!privateState?.claim) {
            throw new Error("Claim private payload is unavailable");
          }
          await generatedCallTx(
            await transactionContractFor(transition),
          ).redeem_claim();
          return { ledger, privateState, address: current.address };
        },
        confirm: async ({ ledger, privateState, address }) => {
          const claimantKey = claimantKeyFor(ledger, privateState);
          await waitForLedger(
            address,
            (next) => next.claims.lookup(claimantKey) === ClaimStatus.redeemed,
          );
        },
      });
    },

    async getPersonalClaimProjection(ledger) {
      const current = requireConnectedContract();
      providers.privateStateProvider.setContractAddress(current.address);
      const privateState = await providers.privateStateProvider.get(
        ClaimShieldPrivateStateId,
      );
      if (!privateState) {
        throw new ClaimShieldUiErrorCause({
          kind: "privateState",
          code: "claimPayloadUnavailable",
        });
      }

      const claimantKey = claimantKeyFor(ledger, privateState);
      const status = ledger.claims.lookup(claimantKey);
      return {
        claimantKey,
        status,
        hasLocalPayload: privateState.claim !== null,
        canRedeem:
          privateState.claim !== null && status === ClaimStatus.approved,
      };
    },

    subscribe,
    getContract: () => contract,
    getContractAddress: () => contractAddress,
  };
}
