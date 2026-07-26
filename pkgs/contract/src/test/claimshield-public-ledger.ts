import type {
  ClaimStatus,
  Ledger,
  PolicyState,
} from "../managed/claimshield/contract/index.js";

type PublicClaimStatus = ClaimStatus;
type PublicPolicyState = PolicyState;

type PublicClaim = {
  claimantKey: string;
  status: PublicClaimStatus;
};

type PublicCommitment = {
  claimantKey: string;
  commitment: string;
};

export type ClaimShieldPublicLedgerSnapshot = {
  policy: {
    state: PublicPolicyState;
    label: string;
    category: string;
    startAt: bigint;
    endAt: bigint;
    minimumAmount: bigint;
    maximumAmount: bigint;
    fixedBenefit: bigint;
  };
  claims: PublicClaim[];
  commitments: PublicCommitment[];
  receiptNullifiers: string[];
  aggregate: {
    submittedCount: bigint;
    approvedCount: bigint;
    plannedBenefitTotal: bigint;
  };
};

const expectedLedgerFields = new Set([
  "policy_state",
  "admin_key",
  "policy_nonce",
  "policy_label",
  "policy_category",
  "start_at",
  "end_at",
  "minimum_amount",
  "maximum_amount",
  "fixed_benefit",
  "submitted_count",
  "approved_count",
  "planned_benefit_total",
  "claims",
  "commitments",
  "used_receipt_nullifiers",
]);

const privateClaimFieldNames = new Set([
  "amount",
  "merchantDigest",
  "merchant_digest",
  "evidenceDigest",
  "evidence_digest",
  "opaqueReceiptIdentifier",
  "opaque_receipt_identifier",
  "salt",
  "secretKey",
  "secret_key",
  "claim",
  "claimPayload",
  "rejectionReason",
  "rejection_reason",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const bytesToHex = (value: Uint8Array): string =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");

const assertNoPrivateClaimFields = (
  value: unknown,
  visited = new WeakSet<object>(),
): void => {
  if (
    value instanceof Uint8Array ||
    typeof value !== "object" ||
    value === null
  )
    return;
  if (visited.has(value)) return;
  visited.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      assertNoPrivateClaimFields(entry, visited);
    });
    return;
  }

  for (const [field, entry] of Object.entries(value)) {
    if (privateClaimFieldNames.has(field)) {
      throw new Error(
        "Private claim data is not allowed in a public ledger snapshot",
      );
    }
    assertNoPrivateClaimFields(entry, visited);
  }
};

function assertExactFields(
  value: unknown,
  expectedFields: readonly string[],
  context: string,
): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object`);
  }

  assertNoPrivateClaimFields(value);
  const expected = new Set(expectedFields);
  for (const field of Object.keys(value)) {
    if (!expected.has(field)) {
      throw new Error(`${context} contains an unexpected field: ${field}`);
    }
  }
  for (const field of expectedFields) {
    if (!(field in value)) {
      throw new Error(`${context} is missing the required ${field} field`);
    }
  }
}

const assertLedgerShape = (ledger: Ledger): void => {
  const fields = Object.keys(ledger);
  for (const field of fields) {
    if (!expectedLedgerFields.has(field)) {
      throw new Error(`Ledger contains an unexpected field: ${field}`);
    }
  }
  for (const field of expectedLedgerFields) {
    if (!fields.includes(field)) {
      throw new Error(`Ledger is missing the required ${field} field`);
    }
  }
};

export function assertPublicClaimShieldLedgerSnapshot(
  snapshot: unknown,
): asserts snapshot is ClaimShieldPublicLedgerSnapshot {
  assertExactFields(
    snapshot,
    ["policy", "claims", "commitments", "receiptNullifiers", "aggregate"],
    "Public ledger snapshot",
  );
  assertExactFields(
    snapshot.policy,
    [
      "state",
      "label",
      "category",
      "startAt",
      "endAt",
      "minimumAmount",
      "maximumAmount",
      "fixedBenefit",
    ],
    "Public policy snapshot",
  );
  assertExactFields(
    snapshot.aggregate,
    ["submittedCount", "approvedCount", "plannedBenefitTotal"],
    "Public aggregate snapshot",
  );

  if (!Array.isArray(snapshot.claims)) {
    throw new Error("Public claims snapshot must be an array");
  }
  snapshot.claims.forEach((claim) => {
    assertExactFields(
      claim,
      ["claimantKey", "status"],
      "Public claim snapshot",
    );
  });

  if (!Array.isArray(snapshot.commitments)) {
    throw new Error("Public commitments snapshot must be an array");
  }
  snapshot.commitments.forEach((commitment) => {
    assertExactFields(
      commitment,
      ["claimantKey", "commitment"],
      "Public commitment snapshot",
    );
  });

  if (!Array.isArray(snapshot.receiptNullifiers)) {
    throw new Error("Public receipt nullifiers snapshot must be an array");
  }
}

export const createPublicClaimShieldLedgerSnapshot = (
  ledger: Ledger,
): ClaimShieldPublicLedgerSnapshot => {
  assertLedgerShape(ledger);
  const snapshot: ClaimShieldPublicLedgerSnapshot = {
    policy: {
      state: ledger.policy_state,
      label: bytesToHex(ledger.policy_label),
      category: bytesToHex(ledger.policy_category),
      startAt: ledger.start_at,
      endAt: ledger.end_at,
      minimumAmount: ledger.minimum_amount,
      maximumAmount: ledger.maximum_amount,
      fixedBenefit: ledger.fixed_benefit,
    },
    claims: Array.from(ledger.claims).map(([claimantKey, status]) => ({
      claimantKey: bytesToHex(claimantKey),
      status,
    })),
    commitments: Array.from(ledger.commitments).map(
      ([claimantKey, commitment]) => ({
        claimantKey: bytesToHex(claimantKey),
        commitment: bytesToHex(commitment),
      }),
    ),
    receiptNullifiers: Array.from(ledger.used_receipt_nullifiers).map(
      bytesToHex,
    ),
    aggregate: {
      submittedCount: ledger.submitted_count,
      approvedCount: ledger.approved_count,
      plannedBenefitTotal: ledger.planned_benefit_total,
    },
  };

  assertPublicClaimShieldLedgerSnapshot(snapshot);
  return snapshot;
};
