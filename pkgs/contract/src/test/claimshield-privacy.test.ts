import { describe, expect, it } from "vitest";
import {
  ClaimShieldPolicySimulator,
  ClaimStatus,
  PolicyState,
} from "./claimshield-policy-simulator.js";
import {
  assertPublicClaimShieldLedgerSnapshot,
  createPublicClaimShieldLedgerSnapshot,
} from "./claimshield-public-ledger.js";

const privateClaimPayload = {
  amount: 9_876_543n,
  merchantDigest: new Uint8Array(32).fill(0xa1),
  evidenceDigest: new Uint8Array(32).fill(0xb2),
  opaqueReceiptIdentifier: new Uint8Array(32).fill(0xc3),
  salt: new Uint8Array(32).fill(0xd4),
};

const claimantKeyFor = (policy: ClaimShieldPolicySimulator): Uint8Array => {
  const claim = Array.from(policy.getLedger().claims)[0];
  if (!claim) throw new Error("Expected a submitted claim");
  return claim[0];
};

const messageLeaksPrivateValue = (
  message: string,
  values: readonly string[],
): boolean => values.some((value) => message.includes(value));

const snapshotLeaksPrivateValue = (
  value: unknown,
  privateValues: readonly string[],
): boolean => {
  if (typeof value === "string" || typeof value === "bigint") {
    return messageLeaksPrivateValue(String(value), privateValues);
  }
  if (Array.isArray(value)) {
    return value.some((entry) =>
      snapshotLeaksPrivateValue(entry, privateValues),
    );
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((entry) =>
      snapshotLeaksPrivateValue(entry, privateValues),
    );
  }

  return false;
};

describe("ClaimShield public ledger boundary", () => {
  it("projects only public policy, status, commitment, nullifier, and aggregate data", () => {
    const policy = new ClaimShieldPolicySimulator();
    policy.addActor("applicant", 2);
    policy.setClaim("applicant", {
      ...privateClaimPayload,
      amount: 1_250n,
    });
    policy.submitClaim("applicant");
    const claimantKey = claimantKeyFor(policy);
    policy.approveClaim(claimantKey);

    const snapshot = createPublicClaimShieldLedgerSnapshot(policy.getLedger());

    expect(() => assertPublicClaimShieldLedgerSnapshot(snapshot)).not.toThrow();
    expect(snapshot.policy).toMatchObject({
      state: PolicyState.open,
      startAt: 1_000n,
      endAt: 2_000n,
      minimumAmount: 100n,
      maximumAmount: 10_000n,
      fixedBenefit: 500n,
    });
    expect(snapshot.claims).toHaveLength(1);
    expect(snapshot.claims[0]?.claimantKey).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.claims[0]?.status).toBe(ClaimStatus.approved);
    expect(snapshot.commitments).toHaveLength(1);
    expect(snapshot.commitments[0]?.commitment).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.receiptNullifiers).toHaveLength(1);
    expect(snapshot.receiptNullifiers[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot.aggregate).toEqual({
      submittedCount: 1n,
      approvedCount: 1n,
      plannedBenefitTotal: 500n,
    });
    expect(
      snapshotLeaksPrivateValue(snapshot, [
        "1250",
        "a1".repeat(32),
        "b2".repeat(32),
        "c3".repeat(32),
        "d4".repeat(32),
        "02".repeat(32),
        "external-review-value",
      ]),
    ).toBe(false);
  });

  it.each([
    "amount",
    "merchantDigest",
    "evidenceDigest",
    "opaqueReceiptIdentifier",
    "salt",
    "secretKey",
    "claimPayload",
    "rejectionReason",
  ])("rejects a snapshot when a private %s is mixed into it", (privateField) => {
    const policy = new ClaimShieldPolicySimulator();
    const snapshot = createPublicClaimShieldLedgerSnapshot(policy.getLedger());

    expect(() =>
      assertPublicClaimShieldLedgerSnapshot({
        ...snapshot,
        claims: [
          {
            claimantKey: "pseudonymous-claimant",
            status: ClaimStatus.submitted,
            [privateField]: "private-value",
          },
        ],
      }),
    ).toThrow("Private claim data is not allowed in a public ledger snapshot");
  });

  it("does not expose private fixture values in contract errors", () => {
    const captureErrorMessage = (operation: () => void): string => {
      try {
        operation();
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }

      throw new Error("Expected the contract operation to fail");
    };

    const outOfRangePolicy = new ClaimShieldPolicySimulator();
    outOfRangePolicy.addActor("applicant", 2);
    outOfRangePolicy.setClaim("applicant", privateClaimPayload);

    const duplicateReceiptPolicy = new ClaimShieldPolicySimulator();
    duplicateReceiptPolicy.addActor("applicant", 2);
    duplicateReceiptPolicy.addActor("second-applicant", 3);
    duplicateReceiptPolicy.setClaim("applicant", {
      ...privateClaimPayload,
      amount: 1_250n,
    });
    duplicateReceiptPolicy.submitClaim("applicant");
    duplicateReceiptPolicy.setClaim("second-applicant", {
      ...privateClaimPayload,
      amount: 1_500n,
      salt: new Uint8Array(32).fill(0xe5),
    });

    const commitmentPolicy = new ClaimShieldPolicySimulator();
    commitmentPolicy.addActor("applicant", 2);
    commitmentPolicy.setClaim("applicant", {
      ...privateClaimPayload,
      amount: 1_250n,
    });
    commitmentPolicy.submitClaim("applicant");
    commitmentPolicy.approveClaim(claimantKeyFor(commitmentPolicy));
    commitmentPolicy.setClaim("applicant", {
      ...privateClaimPayload,
      amount: 1_250n,
      salt: new Uint8Array(32).fill(0xe5),
    });

    const errorMessages = [
      captureErrorMessage(() => outOfRangePolicy.submitClaim("applicant")),
      captureErrorMessage(() =>
        duplicateReceiptPolicy.submitClaim("second-applicant"),
      ),
      captureErrorMessage(() => commitmentPolicy.redeemClaim("applicant")),
    ];

    const privateValueMarkers = [
      privateClaimPayload.amount.toString(),
      "a1".repeat(32),
      "b2".repeat(32),
      "c3".repeat(32),
      "d4".repeat(32),
      "e5".repeat(32),
      "01".repeat(32),
      "02".repeat(32),
      "03".repeat(32),
      "external-review-value",
    ];

    expect(errorMessages).toEqual([
      expect.stringContaining("Claim amount is outside policy range"),
      expect.stringContaining("Receipt has already been used for this policy"),
      expect.stringContaining(
        "Claim commitment does not match private payload",
      ),
    ]);
    expect(
      errorMessages.some((message) =>
        messageLeaksPrivateValue(message, privateValueMarkers),
      ),
    ).toBe(false);
    expect(outOfRangePolicy.getLedger().submitted_count).toBe(0n);
    expect(duplicateReceiptPolicy.getLedger().submitted_count).toBe(1n);
    expect(
      commitmentPolicy
        .getLedger()
        .claims.lookup(claimantKeyFor(commitmentPolicy)),
    ).toBe(ClaimStatus.approved);
  });
});
