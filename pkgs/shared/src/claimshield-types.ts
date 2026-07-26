import type { CompiledContract } from "@midnight-ntwrk/compact-js";
import type {
  DeployedContract,
  FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import type {
  AnyProvableCircuitId,
  MidnightProviders,
} from "@midnight-ntwrk/midnight-js-types";
import { ClaimShield, type ClaimShieldPrivateState } from "contract";

export const ClaimShieldPrivateStateId = "claimshield-private-state";

/** Generated Compact enums are re-exported so app code never imports managed bindings. */
export const PolicyState = ClaimShield.PolicyState;
export type PolicyState = ClaimShield.PolicyState;

export const ClaimStatus = ClaimShield.ClaimStatus;
export type ClaimStatus = ClaimShield.ClaimStatus;

export type CompactMap<Key, Value> = Iterable<readonly [Key, Value]> & {
  isEmpty(): boolean;
  size(): bigint;
  member(key: Key): boolean;
  lookup(key: Key): Value;
};

export type CompactSet<Value> = Iterable<Value> & {
  isEmpty(): boolean;
  size(): bigint;
  member(value: Value): boolean;
};

/**
 * Public ledger projection. It deliberately contains no private claim payload,
 * wallet address, secret key, salt, or review reason.
 */
export type ClaimShieldLedgerState = Readonly<{
  policyState: PolicyState;
  adminKey: Uint8Array;
  policyNonce: Uint8Array;
  policyLabel: Uint8Array;
  policyCategory: Uint8Array;
  startAt: bigint;
  endAt: bigint;
  minimumAmount: bigint;
  maximumAmount: bigint;
  fixedBenefit: bigint;
  submittedCount: bigint;
  approvedCount: bigint;
  plannedBenefitTotal: bigint;
  claims: CompactMap<Uint8Array, ClaimStatus>;
  commitments: CompactMap<Uint8Array, Uint8Array>;
  usedReceiptNullifiers: CompactSet<Uint8Array>;
}>;

/** Values that are published when a policy is deployed. */
export type PolicyInput = Readonly<{
  label: string;
  category: string;
  startAt: bigint;
  endAt: bigint;
  minimumAmount: bigint;
  maximumAmount: bigint;
  fixedBenefit: bigint;
}>;

/**
 * Private submission input. This shape is never part of ClaimShieldLedgerState
 * and must only cross the adapter/private-state boundary.
 */
export type ClaimInput = Readonly<{
  amount: bigint;
  merchantDigest: Uint8Array;
  evidenceDigest: Uint8Array;
  opaqueReceiptIdentifier: Uint8Array;
}>;

export type ClaimantClaimProjection = Readonly<{
  claimantKey: Uint8Array;
  status: ClaimStatus;
  hasLocalPayload: boolean;
  canRedeem: boolean;
}>;

export type ClaimOperation =
  | "deploy"
  | "join"
  | "submit"
  | "close"
  | "review"
  | "redeem"
  | null;

export type TransactionStage =
  | "idle"
  | "preparing"
  | "proving"
  | "awaitingSignature"
  | "submitting"
  | "confirming"
  | "succeeded"
  | "failed";

export type ClaimUiError =
  | {
      kind: "input";
      code: "invalidPolicyPeriod" | "amountOutOfRange" | "missingReceipt";
    }
  | { kind: "privateState"; code: "claimPayloadUnavailable" }
  | {
      kind: "business";
      code:
        | "policyClosed"
        | "duplicateReceipt"
        | "claimAlreadyDecided"
        | "claimNotRedeemable";
    }
  | {
      kind: "wallet";
      code: "walletUnavailable" | "walletRejected" | "networkMismatch";
    }
  | {
      kind: "proof";
      code: "proofFailed" | "submissionFailed" | "confirmationFailed";
    };

export type ClaimTransactionState = Readonly<{
  operation: ClaimOperation;
  stage: TransactionStage;
  error: ClaimUiError | null;
}>;

export const isClaimTransactionInFlight = (stage: TransactionStage): boolean =>
  stage === "preparing" ||
  stage === "proving" ||
  stage === "awaitingSignature" ||
  stage === "submitting" ||
  stage === "confirming";

export type ClaimOperationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; error: ClaimUiError }>;

export interface ClaimShieldOperations {
  deployPolicy(input: PolicyInput): Promise<ClaimOperationResult>;
  joinPolicy(address: string): Promise<ClaimOperationResult>;
  submitClaim(input: ClaimInput): Promise<ClaimOperationResult>;
  closePolicy(): Promise<ClaimOperationResult>;
  approveClaim(claimantKey: Uint8Array): Promise<ClaimOperationResult>;
  rejectClaim(claimantKey: Uint8Array): Promise<ClaimOperationResult>;
  redeemClaim(): Promise<ClaimOperationResult>;
}

export type ClaimShieldCircuits = AnyProvableCircuitId;
export type ClaimShieldProviders = MidnightProviders<
  ClaimShieldCircuits,
  typeof ClaimShieldPrivateStateId,
  ClaimShieldPrivateState
>;
export type ClaimShieldContractInstance =
  // biome-ignore lint/suspicious/noExplicitAny: generated Compact contract generic is not externally accessible
  CompiledContract.CompiledContract<any, ClaimShieldPrivateState>;
export type DeployedClaimShieldContract =
  // biome-ignore lint/suspicious/noExplicitAny: Midnight.js derives the mapping from generated circuit names at runtime
  | DeployedContract<any>
  // biome-ignore lint/suspicious/noExplicitAny: Midnight.js derives the mapping from generated circuit names at runtime
  | FoundContract<any>;
