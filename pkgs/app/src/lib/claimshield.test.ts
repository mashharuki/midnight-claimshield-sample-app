import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import type { ClaimShieldPrivateState } from "contract";
import { Subject } from "rxjs";
import {
  type ClaimShieldLedgerState,
  type ClaimShieldProviders,
  ClaimStatus,
  PolicyState,
} from "shared";
import { describe, expect, it, vi } from "vitest";
import {
  type ClaimShieldAdapterRuntime,
  type ClaimShieldStageReporter,
  createClaimShieldAdapter,
  createFreshClaimShieldPrivateState,
  runClaimShieldTransaction,
} from "./claimshield";

const contractAddress =
  "0200000000000000000000000000000000000000000000000000000000000000" as ContractAddress;
const claimantKey = new Uint8Array(32).fill(7);
const policyInput = {
  label: "Travel delay",
  category: "transport",
  startAt: 10n,
  endAt: 20n,
  minimumAmount: 1n,
  maximumAmount: 100n,
  fixedBenefit: 10n,
};
const claimInput = {
  amount: 10n,
  merchantDigest: new Uint8Array(32).fill(1),
  evidenceDigest: new Uint8Array(32).fill(2),
  opaqueReceiptIdentifier: new Uint8Array(32).fill(3),
};

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length &&
  left.every((byte, index) => byte === right[index]);

const fixedText = (value: string): Uint8Array => {
  const result = new Uint8Array(32);
  result.set(new TextEncoder().encode(value));
  return result;
};

const createLedger = (
  getPolicyState: () => PolicyState,
  getClaimStatus: () => ClaimStatus,
): ClaimShieldLedgerState => ({
  policyState: getPolicyState(),
  adminKey: new Uint8Array(32),
  policyNonce: new Uint8Array(32).fill(9),
  policyLabel: fixedText(policyInput.label),
  policyCategory: fixedText(policyInput.category),
  startAt: policyInput.startAt,
  endAt: policyInput.endAt,
  minimumAmount: policyInput.minimumAmount,
  maximumAmount: policyInput.maximumAmount,
  fixedBenefit: policyInput.fixedBenefit,
  submittedCount: 0n,
  approvedCount: 0n,
  plannedBenefitTotal: 0n,
  claims: {
    isEmpty: () => false,
    size: () => 1n,
    member: (key) => sameBytes(key, claimantKey),
    lookup: (key) =>
      sameBytes(key, claimantKey) ? getClaimStatus() : ClaimStatus.none,
    *[Symbol.iterator]() {
      yield [claimantKey, getClaimStatus()] as const;
    },
  },
  commitments: {
    isEmpty: () => false,
    size: () => 1n,
    member: (key) => sameBytes(key, claimantKey),
    lookup: () => new Uint8Array(32),
    *[Symbol.iterator]() {
      yield [claimantKey, new Uint8Array(32)] as const;
    },
  },
  usedReceiptNullifiers: {
    isEmpty: () => true,
    size: () => 0n,
    member: () => false,
    *[Symbol.iterator]() {},
  },
});

type AdapterHarness = ReturnType<typeof createAdapterHarness>;

function createAdapterHarness(options: { deferClose?: boolean } = {}) {
  let policyState = PolicyState.open;
  let claimStatus = ClaimStatus.none;
  let privateState: ClaimShieldPrivateState | null = {
    secretKey: new Uint8Array(32).fill(4),
    claim: null,
  };
  let stagedProviders: ClaimShieldProviders | null = null;
  const stages: Array<{ operation: string | null; stage: string }> = [];
  const circuitCalls: string[] = [];
  const findConfigurations: Array<{ initialPrivateState?: unknown }> = [];
  const ledgerEvents = new Subject<{ data: ClaimShieldLedgerState }>();

  const ledger = () =>
    createLedger(
      () => policyState,
      () => claimStatus,
    );
  const executeStagedTransaction = async () => {
    if (!stagedProviders)
      throw new Error("Staged providers were not supplied.");
    await stagedProviders.proofProvider.proveTx({} as never, {} as never);
    await stagedProviders.walletProvider.balanceTx({} as never);
    await stagedProviders.midnightProvider.submitTx({} as never);
  };
  const fakeContract = {
    deployTxData: { public: { contractAddress } },
    callTx: {
      close_policy: async () => {
        circuitCalls.push("close_policy");
        await executeStagedTransaction();
        if (!options.deferClose) policyState = PolicyState.closed;
      },
      submit_claim: async () => {
        circuitCalls.push("submit_claim");
        await executeStagedTransaction();
        claimStatus = ClaimStatus.submitted;
      },
      approve_claim: async (key: Uint8Array) => {
        expect(key).toEqual(claimantKey);
        circuitCalls.push("approve_claim");
        await executeStagedTransaction();
        claimStatus = ClaimStatus.approved;
      },
      reject_claim: async (key: Uint8Array) => {
        expect(key).toEqual(claimantKey);
        circuitCalls.push("reject_claim");
        await executeStagedTransaction();
        claimStatus = ClaimStatus.rejected;
      },
      redeem_claim: async () => {
        circuitCalls.push("redeem_claim");
        await executeStagedTransaction();
        claimStatus = ClaimStatus.redeemed;
      },
    },
  };
  const providers = {
    proofProvider: { proveTx: vi.fn(async (transaction) => transaction) },
    walletProvider: {
      getCoinPublicKey: vi.fn(),
      getEncryptionPublicKey: vi.fn(),
      balanceTx: vi.fn(async (transaction) => transaction),
    },
    midnightProvider: { submitTx: vi.fn(async () => "tx-id") },
    privateStateProvider: {
      setContractAddress: vi.fn(),
      get: vi.fn(async () => privateState),
      set: vi.fn(async (_id, value) => {
        privateState = value;
      }),
    },
    publicDataProvider: {
      queryContractState: vi.fn(async () => ({ data: ledger() })),
      contractStateObservable: vi.fn(() => ledgerEvents),
    },
  } as unknown as ClaimShieldProviders;
  const runtime: ClaimShieldAdapterRuntime = {
    deploy: async (nextProviders) => {
      stagedProviders = nextProviders;
      await executeStagedTransaction();
      return fakeContract as never;
    },
    find: async (nextProviders, configuration) => {
      findConfigurations.push({
        initialPrivateState: configuration.initialPrivateState,
      });
      stagedProviders = nextProviders;
      return fakeContract as never;
    },
    projectLedger: (state) => state as ClaimShieldLedgerState,
    deriveClaimantKey: () => claimantKey,
  };
  const adapter = createClaimShieldAdapter(
    providers,
    (state) => stages.push({ operation: state.operation, stage: state.stage }),
    runtime,
  );

  return {
    adapter,
    circuitCalls,
    findConfigurations,
    getLedger: ledger,
    getPrivateState: () => privateState,
    ledgerEvents,
    providers,
    stages,
    setClaimStatus: (next: ClaimStatus) => {
      claimStatus = next;
    },
    setPolicyState: (next: PolicyState) => {
      policyState = next;
    },
    setPrivateState: (next: ClaimShieldPrivateState | null) => {
      privateState = next;
    },
  };
}

const stagesFor = (harness: AdapterHarness, operation: string) =>
  harness.stages
    .filter((entry) => entry.operation === operation)
    .map((entry) => entry.stage);

describe("ClaimShield SDK transaction lifecycle", () => {
  it("creates a fresh non-zero private secret for each new claimant", () => {
    const first = createFreshClaimShieldPrivateState();
    const second = createFreshClaimShieldPrivateState();

    expect(first.secretKey).toHaveLength(32);
    expect(first.secretKey.some((byte) => byte !== 0)).toBe(true);
    expect(second.secretKey).not.toEqual(first.secretKey);
    expect(first.claim).toBeNull();
  });

  it("does not report success until the Indexer confirmation resolves", async () => {
    const stages: string[] = [];
    let confirm: (() => void) | undefined;
    const confirmation = new Promise<void>((resolve) => {
      confirm = resolve;
    });
    const report: ClaimShieldStageReporter = (state) => {
      stages.push(state.stage);
    };

    const result = runClaimShieldTransaction({
      operation: "submit",
      report,
      execute: async (transition) => {
        transition("proving");
        transition("awaitingSignature");
        transition("submitting");
      },
      confirm: async () => confirmation,
    });

    await Promise.resolve();
    expect(stages).toEqual([
      "preparing",
      "proving",
      "awaitingSignature",
      "submitting",
      "confirming",
    ]);
    expect(stages).not.toContain("succeeded");

    confirm?.();

    await expect(result).resolves.toEqual({ ok: true });
    expect(stages.at(-1)).toBe("succeeded");
  });

  it("returns a typed non-secret error when the claim private state is missing", async () => {
    const states: string[] = [];

    const result = await runClaimShieldTransaction({
      operation: "redeem",
      report: (state) => states.push(state.stage),
      execute: async () => {
        throw new Error("Claim private payload is unavailable");
      },
      confirm: async () => undefined,
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: "privateState", code: "claimPayloadUnavailable" },
    });
    expect(states).toEqual(["preparing", "failed"]);
  });

  it("executes every generated write circuit through staged providers", async () => {
    const harness = createAdapterHarness();

    await expect(harness.adapter.deployPolicy(policyInput)).resolves.toEqual({
      ok: true,
    });
    await expect(harness.adapter.joinPolicy(contractAddress)).resolves.toEqual({
      ok: true,
    });
    await expect(harness.adapter.submitClaim(claimInput)).resolves.toEqual({
      ok: true,
    });
    await expect(harness.adapter.approveClaim(claimantKey)).resolves.toEqual({
      ok: true,
    });
    await expect(harness.adapter.redeemClaim()).resolves.toEqual({ ok: true });

    // Start another submitted claim in the fake ledger to verify that reject
    // remains a direct generated-binding call with no review-reason payload.
    harness.setClaimStatus(ClaimStatus.submitted);
    await expect(harness.adapter.rejectClaim(claimantKey)).resolves.toEqual({
      ok: true,
    });
    await expect(harness.adapter.closePolicy()).resolves.toEqual({ ok: true });

    expect(harness.circuitCalls).toEqual([
      "submit_claim",
      "approve_claim",
      "redeem_claim",
      "reject_claim",
      "close_policy",
    ]);
    expect(stagesFor(harness, "deploy")).toEqual([
      "preparing",
      "proving",
      "awaitingSignature",
      "submitting",
      "confirming",
      "succeeded",
    ]);
    for (const operation of ["submit", "review", "redeem", "close"]) {
      expect(stagesFor(harness, operation)).toContain("proving");
      expect(stagesFor(harness, operation)).toContain("awaitingSignature");
      expect(stagesFor(harness, operation)).toContain("submitting");
      expect(stagesFor(harness, operation).at(-1)).toBe("succeeded");
    }
    expect(stagesFor(harness, "join")).toEqual([
      "preparing",
      "confirming",
      "succeeded",
    ]);
    expect(
      harness.findConfigurations.at(0)?.initialPrivateState,
    ).toBeUndefined();
    expect(harness.providers.privateStateProvider.set).toHaveBeenCalledOnce();
  });

  it("waits for the adapter's Indexer predicate before reporting success", async () => {
    const harness = createAdapterHarness({ deferClose: true });
    await harness.adapter.joinPolicy(contractAddress);

    const result = harness.adapter.closePolicy();
    await vi.waitFor(() =>
      expect(stagesFor(harness, "close")).toEqual([
        "preparing",
        "proving",
        "awaitingSignature",
        "submitting",
        "confirming",
      ]),
    );

    harness.setPolicyState(PolicyState.closed);
    harness.ledgerEvents.next({
      data: createLedger(
        () => PolicyState.closed,
        () => ClaimStatus.none,
      ),
    });
    await expect(result).resolves.toEqual({ ok: true });
    expect(stagesFor(harness, "close").at(-1)).toBe("succeeded");
  });

  it("does not overwrite an existing claim private state when joining", async () => {
    const harness = createAdapterHarness();
    const existingState: ClaimShieldPrivateState = {
      secretKey: new Uint8Array(32).fill(5),
      claim: null,
    };
    harness.setPrivateState(existingState);

    await expect(harness.adapter.joinPolicy(contractAddress)).resolves.toEqual({
      ok: true,
    });

    expect(harness.findConfigurations).toEqual([
      { initialPrivateState: undefined },
    ]);
    expect(harness.providers.privateStateProvider.set).not.toHaveBeenCalled();
  });

  it("returns a typed non-secret adapter error when local claim state is lost", async () => {
    const harness = createAdapterHarness();
    await harness.adapter.joinPolicy(contractAddress);
    harness.setPrivateState(null);

    await expect(harness.adapter.redeemClaim()).resolves.toEqual({
      ok: false,
      error: { kind: "privateState", code: "claimPayloadUnavailable" },
    });
    expect(stagesFor(harness, "redeem")).toEqual(["preparing", "failed"]);
  });

  it("validates a join address before changing the private-state scope", async () => {
    const harness = createAdapterHarness();

    await expect(
      harness.adapter.joinPolicy("not-a-contract-address"),
    ).resolves.toEqual({
      ok: false,
      error: { kind: "input", code: "invalidContractAddress" },
    });
    expect(
      harness.providers.privateStateProvider.setContractAddress,
    ).not.toHaveBeenCalled();
  });

  it("reuses a persisted private salt when a submission is retried", async () => {
    const harness = createAdapterHarness();
    await harness.adapter.joinPolicy(contractAddress);

    await expect(harness.adapter.submitClaim(claimInput)).resolves.toEqual({
      ok: true,
    });
    const firstSalt = harness.getPrivateState()?.claim?.salt;

    await expect(harness.adapter.submitClaim(claimInput)).resolves.toEqual({
      ok: true,
    });
    expect(harness.getPrivateState()?.claim?.salt).toEqual(firstSalt);
  });

  it("returns only a public personal projection and signals lost private state", async () => {
    const harness = createAdapterHarness();
    await harness.adapter.joinPolicy(contractAddress);

    await expect(
      harness.adapter.getPersonalClaimProjection(harness.getLedger()),
    ).resolves.toEqual({
      claimantKey,
      status: ClaimStatus.none,
      hasLocalPayload: false,
      canRedeem: false,
    });

    harness.setPrivateState(null);
    await expect(
      harness.adapter.getPersonalClaimProjection(harness.getLedger()),
    ).rejects.toThrow("claimPayloadUnavailable");
  });
});
