import { beforeEach, describe, expect, it } from "vitest";
import {
  ClaimShieldPolicySimulator,
  ClaimStatus,
  defaultPolicy,
} from "./claimshield-policy-simulator.js";

const claimPayload = {
  amount: 1_250n,
  merchantDigest: new Uint8Array(32).fill(0x11),
  evidenceDigest: new Uint8Array(32).fill(0x22),
  opaqueReceiptIdentifier: new Uint8Array(32).fill(0x33),
  salt: new Uint8Array(32).fill(0x44),
};

const secondClaimPayload = {
  amount: 1_500n,
  merchantDigest: new Uint8Array(32).fill(0x55),
  evidenceDigest: new Uint8Array(32).fill(0x66),
  opaqueReceiptIdentifier: new Uint8Array(32).fill(0x77),
  salt: new Uint8Array(32).fill(0x88),
};

const submittedClaimantKey = (
  policy: ClaimShieldPolicySimulator,
): Uint8Array => {
  const firstClaim = Array.from(policy.getLedger().claims)[0];
  if (!firstClaim) throw new Error("Expected a submitted claim");
  return firstClaim[0];
};

describe("ClaimShield claim review", () => {
  let policy: ClaimShieldPolicySimulator;

  beforeEach(() => {
    policy = new ClaimShieldPolicySimulator();
    policy.addActor("applicant", 2);
    policy.setClaim("applicant", claimPayload);
    policy.submitClaim("applicant");
  });

  it("allows only the administrator to approve a submitted claim and update aggregates", () => {
    const claimantKey = submittedClaimantKey(policy);
    const ledger = policy.approveClaim(claimantKey);

    expect(ledger.claims.lookup(claimantKey)).toBe(ClaimStatus.approved);
    expect(ledger.approved_count).toBe(1n);
    expect(ledger.planned_benefit_total).toBe(defaultPolicy.fixedBenefit);
  });

  it("allows only the administrator to reject a submitted claim without an aggregate update", () => {
    const claimantKey = submittedClaimantKey(policy);
    const ledger = policy.rejectClaim(claimantKey);

    expect(ledger.claims.lookup(claimantKey)).toBe(ClaimStatus.rejected);
    expect(ledger.submitted_count).toBe(1n);
    expect(ledger.approved_count).toBe(0n);
    expect(ledger.planned_benefit_total).toBe(0n);
    expect(ledger.commitments.size()).toBe(1n);
    expect(ledger.used_receipt_nullifiers.size()).toBe(1n);
    expect(Object.keys(ledger)).not.toContain("rejection_reason");
  });

  it("keeps submitted claims reviewable after the policy closes", () => {
    const claimantKey = submittedClaimantKey(policy);
    policy.closePolicy();

    const ledger = policy.approveClaim(claimantKey);

    expect(ledger.claims.lookup(claimantKey)).toBe(ClaimStatus.approved);
    expect(ledger.approved_count).toBe(1n);
  });

  it("adds the fixed benefit for every approved claim", () => {
    const firstClaimantKey = submittedClaimantKey(policy);
    policy.addActor("second-applicant", 3);
    policy.setClaim("second-applicant", secondClaimPayload);
    policy.submitClaim("second-applicant");
    const claimantKeys = Array.from(policy.getLedger().claims).map(
      ([claimantKey]) => claimantKey,
    );
    const secondClaimantKey = claimantKeys.find(
      (claimantKey) =>
        !claimantKey.every((byte, index) => byte === firstClaimantKey[index]),
    );
    if (!secondClaimantKey)
      throw new Error("Expected a second submitted claim");

    policy.approveClaim(firstClaimantKey);
    const ledger = policy.approveClaim(secondClaimantKey);

    expect(ledger.approved_count).toBe(2n);
    expect(ledger.planned_benefit_total).toBe(defaultPolicy.fixedBenefit * 2n);
  });

  it("rejects review attempts by a non-administrator", () => {
    const claimantKey = submittedClaimantKey(policy);
    policy.addActor("reviewer", 3);

    expect(() => policy.approveClaim(claimantKey, "reviewer")).toThrow(
      "Only the policy administrator can perform this action",
    );
    expect(() => policy.rejectClaim(claimantKey, "reviewer")).toThrow(
      "Only the policy administrator can perform this action",
    );
    expect(policy.getLedger().claims.lookup(claimantKey)).toBe(
      ClaimStatus.submitted,
    );
  });

  it("rejects decisions for absent or already decided claims", () => {
    const claimantKey = submittedClaimantKey(policy);

    expect(() => policy.approveClaim(new Uint8Array(32).fill(0x99))).toThrow(
      "Claim does not exist",
    );
    expect(policy.getLedger().approved_count).toBe(0n);
    expect(policy.getLedger().planned_benefit_total).toBe(0n);
    policy.approveClaim(claimantKey);
    expect(() => policy.approveClaim(claimantKey)).toThrow(
      "Claim has already been decided",
    );
    expect(() => policy.rejectClaim(claimantKey)).toThrow(
      "Claim has already been decided",
    );
    expect(policy.getLedger().approved_count).toBe(1n);
    expect(policy.getLedger().planned_benefit_total).toBe(
      defaultPolicy.fixedBenefit,
    );
  });
});
