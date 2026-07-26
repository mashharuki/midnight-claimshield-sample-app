import { describe, expect, it } from "vitest";
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

const submittedClaimantKey = (
  policy: ClaimShieldPolicySimulator,
): Uint8Array => {
  const firstClaim = Array.from(policy.getLedger().claims)[0];
  if (!firstClaim) throw new Error("Expected a submitted claim");
  return firstClaim[0];
};

const approvedPolicy = (): {
  policy: ClaimShieldPolicySimulator;
  claimantKey: Uint8Array;
} => {
  const policy = new ClaimShieldPolicySimulator();
  policy.addActor("applicant", 2);
  policy.setClaim("applicant", claimPayload);
  policy.submitClaim("applicant");
  const claimantKey = submittedClaimantKey(policy);
  policy.approveClaim(claimantKey);
  return { policy, claimantKey };
};

describe("ClaimShield one-time redemption", () => {
  it("redeems an approved claim only with its original private payload", () => {
    const { policy, claimantKey } = approvedPolicy();

    const ledger = policy.redeemClaim("applicant");

    expect(ledger.claims.lookup(claimantKey)).toBe(ClaimStatus.redeemed);
    expect(ledger.approved_count).toBe(1n);
    expect(ledger.planned_benefit_total).toBe(defaultPolicy.fixedBenefit);
    expect(Object.keys(ledger)).not.toContain("transfer");
    expect(Object.keys(ledger)).not.toContain("payout");
  });

  it("allows an approved claim to redeem after the policy closes", () => {
    const { policy, claimantKey } = approvedPolicy();
    policy.closePolicy();

    const ledger = policy.redeemClaim("applicant");

    expect(ledger.claims.lookup(claimantKey)).toBe(ClaimStatus.redeemed);
  });

  it("rejects redemption of submitted, rejected, and already redeemed claims", () => {
    const submittedPolicy = new ClaimShieldPolicySimulator();
    submittedPolicy.addActor("applicant", 2);
    submittedPolicy.setClaim("applicant", claimPayload);
    submittedPolicy.submitClaim("applicant");
    expect(() => submittedPolicy.redeemClaim("applicant")).toThrow(
      "Claim is not approved for redemption",
    );

    const rejectedPolicy = new ClaimShieldPolicySimulator();
    rejectedPolicy.addActor("applicant", 2);
    rejectedPolicy.setClaim("applicant", claimPayload);
    rejectedPolicy.submitClaim("applicant");
    rejectedPolicy.rejectClaim(submittedClaimantKey(rejectedPolicy));
    expect(() => rejectedPolicy.redeemClaim("applicant")).toThrow(
      "Claim is not approved for redemption",
    );

    const { policy } = approvedPolicy();
    policy.redeemClaim("applicant");
    expect(() => policy.redeemClaim("applicant")).toThrow(
      "Claim is not approved for redemption",
    );
  });

  it("rejects a changed private payload before changing public claim status", () => {
    const { policy, claimantKey } = approvedPolicy();
    policy.setClaim("applicant", {
      ...claimPayload,
      salt: new Uint8Array(32).fill(0x99),
    });

    expect(() => policy.redeemClaim("applicant")).toThrow(
      "Claim commitment does not match private payload",
    );
    expect(policy.getLedger().claims.lookup(claimantKey)).toBe(
      ClaimStatus.approved,
    );
  });

  it("rejects a different private secret even when payload fields match", () => {
    const { policy, claimantKey } = approvedPolicy();
    policy.addActor("different-applicant", 3);
    policy.setClaim("different-applicant", claimPayload);

    expect(() => policy.redeemClaim("different-applicant")).toThrow(
      "Claim does not exist",
    );
    expect(policy.getLedger().claims.lookup(claimantKey)).toBe(
      ClaimStatus.approved,
    );
  });
});
