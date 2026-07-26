import { beforeEach, describe, expect, it } from "vitest";
import {
  ClaimShieldPolicySimulator,
  ClaimStatus,
  defaultPolicy,
} from "./claimshield-policy-simulator.js";

const claimPayload = (
  amount = 1_250n,
  receiptByte = 0x33,
  saltByte = 0x44,
) => ({
  amount,
  merchantDigest: new Uint8Array(32).fill(0x11),
  evidenceDigest: new Uint8Array(32).fill(0x22),
  opaqueReceiptIdentifier: new Uint8Array(32).fill(receiptByte),
  salt: new Uint8Array(32).fill(saltByte),
});

describe("ClaimShield private claim submission", () => {
  let policy: ClaimShieldPolicySimulator;

  beforeEach(() => {
    policy = new ClaimShieldPolicySimulator();
    policy.addActor("applicant", 2);
  });

  it("records only a pseudonymous submitted claim, commitment, and receipt nullifier", () => {
    const payload = claimPayload();
    policy.setClaim("applicant", payload);

    const ledger = policy.submitClaim("applicant");
    const [[claimantKey, status]] = Array.from(ledger.claims);
    const [[, commitment]] = Array.from(ledger.commitments);

    expect(ledger.submitted_count).toBe(1n);
    expect(status).toBe(ClaimStatus.submitted);
    expect(ledger.commitments.member(claimantKey)).toBe(true);
    expect(ledger.used_receipt_nullifiers.size()).toBe(1n);
    expect(Object.keys(ledger)).not.toContain("amount");
    expect(Object.keys(ledger)).not.toContain("merchant_digest");
    expect(Object.keys(ledger)).not.toContain("evidence_digest");
    expect(Object.keys(ledger)).not.toContain("opaque_receipt_identifier");
    expect(Object.keys(ledger)).not.toContain("salt");
    expect(commitment).not.toEqual(payload.merchantDigest);
    expect(commitment).not.toEqual(payload.evidenceDigest);
    expect(commitment).not.toEqual(payload.opaqueReceiptIdentifier);
    expect(commitment).not.toEqual(payload.salt);
  });

  it.each([
    99n,
    10_001n,
  ])("rejects a private amount outside the policy range: %s", (amount) => {
    policy.setClaim("applicant", claimPayload(amount));

    expect(() => policy.submitClaim("applicant")).toThrow(
      "Claim amount is outside policy range",
    );
    expect(policy.getLedger().submitted_count).toBe(0n);
  });

  it("rejects submissions after the policy is closed", () => {
    policy.setClaim("applicant", claimPayload());
    policy.closePolicy();

    expect(() => policy.submitClaim("applicant")).toThrow(
      "Policy is closed to new claims",
    );
  });

  it("rejects a second submission from the same pseudonymous claimant", () => {
    policy.setClaim("applicant", claimPayload());
    policy.submitClaim("applicant");
    policy.setClaim("applicant", claimPayload(1_300n, 0x55, 0x66));

    expect(() => policy.submitClaim("applicant")).toThrow(
      "Claimant already submitted",
    );
  });

  it("rejects reuse of the same receipt within one policy", () => {
    policy.addActor("second-applicant", 3);
    policy.setClaim("applicant", claimPayload(1_250n, 0x55, 0x44));
    policy.submitClaim("applicant");
    policy.setClaim("second-applicant", claimPayload(1_500n, 0x55, 0x77));

    expect(() => policy.submitClaim("second-applicant")).toThrow(
      "Receipt has already been used for this policy",
    );
  });

  it("domains an identical receipt nullifier to each policy", () => {
    const secondPolicy = new ClaimShieldPolicySimulator({
      ...defaultPolicy,
      nonce: new Uint8Array(32).fill(0x7f),
    });
    secondPolicy.addActor("applicant", 2);
    const payload = claimPayload(1_250n, 0x55, 0x44);
    policy.setClaim("applicant", payload);
    secondPolicy.setClaim("applicant", payload);

    const firstLedger = policy.submitClaim("applicant");
    const secondLedger = secondPolicy.submitClaim("applicant");
    const [firstNullifier] = Array.from(firstLedger.used_receipt_nullifiers);
    const [secondNullifier] = Array.from(secondLedger.used_receipt_nullifiers);

    expect(firstNullifier).not.toEqual(secondNullifier);
    expect(firstLedger.submitted_count).toBe(1n);
    expect(secondLedger.submitted_count).toBe(1n);
  });
});
