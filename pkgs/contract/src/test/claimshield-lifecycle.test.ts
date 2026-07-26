import { describe, expect, it } from "vitest";
import {
  ClaimShieldPolicySimulator,
  ClaimStatus,
  defaultPolicy,
  PolicyState,
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

const claimantKeyFor = (
  policy: ClaimShieldPolicySimulator,
  index = 0,
): Uint8Array => {
  const claim = Array.from(policy.getLedger().claims)[index];
  if (!claim) throw new Error("Expected a submitted claim");
  return claim[0];
};

describe("ClaimShield end-to-end policy lifecycle", () => {
  it.each([
    ["minimum", defaultPolicy.minimumAmount],
    ["maximum", defaultPolicy.maximumAmount],
  ])("accepts the policy %s amount boundary", (_boundary, amount) => {
    const policy = new ClaimShieldPolicySimulator();
    policy.addActor("applicant", 2);
    policy.setClaim("applicant", claimPayload(amount));

    const ledger = policy.submitClaim("applicant");

    expect(ledger.submitted_count).toBe(1n);
    expect(ledger.claims.lookup(claimantKeyFor(policy))).toBe(
      ClaimStatus.submitted,
    );
  });

  it("publishes public conditions and completes an approved claim after closing intake", () => {
    const policy = new ClaimShieldPolicySimulator();
    policy.addActor("applicant", 2);
    policy.setClaim("applicant", claimPayload());

    const submitted = policy.submitClaim("applicant");
    const claimantKey = claimantKeyFor(policy);

    expect(submitted).toMatchObject({
      policy_state: PolicyState.open,
      policy_label: defaultPolicy.label,
      policy_category: defaultPolicy.category,
      start_at: defaultPolicy.startAt,
      end_at: defaultPolicy.endAt,
      minimum_amount: defaultPolicy.minimumAmount,
      maximum_amount: defaultPolicy.maximumAmount,
      fixed_benefit: defaultPolicy.fixedBenefit,
      submitted_count: 1n,
    });
    expect(submitted.claims.lookup(claimantKey)).toBe(ClaimStatus.submitted);

    policy.closePolicy();
    const approved = policy.approveClaim(claimantKey);
    expect(approved.policy_state).toBe(PolicyState.closed);
    expect(approved.claims.lookup(claimantKey)).toBe(ClaimStatus.approved);
    expect(approved.approved_count).toBe(1n);
    expect(approved.planned_benefit_total).toBe(defaultPolicy.fixedBenefit);

    const redeemed = policy.redeemClaim("applicant");
    expect(redeemed.claims.lookup(claimantKey)).toBe(ClaimStatus.redeemed);
    expect(redeemed.approved_count).toBe(1n);
    expect(redeemed.planned_benefit_total).toBe(defaultPolicy.fixedBenefit);
  });

  it("rejects invalid, duplicate, and unauthorised transitions without changing public state", () => {
    expect(
      () =>
        new ClaimShieldPolicySimulator({
          ...defaultPolicy,
          startAt: defaultPolicy.endAt,
        }),
    ).toThrow();

    const policy = new ClaimShieldPolicySimulator();
    policy.addActor("applicant", 2);
    policy.addActor("second-applicant", 3);
    policy.addActor("reviewer", 4);
    policy.setClaim(
      "applicant",
      claimPayload(defaultPolicy.maximumAmount + 1n),
    );

    expect(() => policy.submitClaim("applicant")).toThrow(
      "Claim amount is outside policy range",
    );
    expect(policy.getLedger().submitted_count).toBe(0n);
    expect(() => policy.closePolicy("reviewer")).toThrow(
      "Only the policy administrator can perform this action",
    );

    policy.setClaim("applicant", claimPayload());
    policy.submitClaim("applicant");
    const claimantKey = claimantKeyFor(policy);
    policy.setClaim("second-applicant", claimPayload(1_500n));

    expect(() => policy.submitClaim("second-applicant")).toThrow(
      "Receipt has already been used for this policy",
    );
    expect(policy.getLedger().submitted_count).toBe(1n);
    expect(() => policy.approveClaim(claimantKey, "reviewer")).toThrow(
      "Only the policy administrator can perform this action",
    );
    expect(policy.getLedger().claims.lookup(claimantKey)).toBe(
      ClaimStatus.submitted,
    );

    policy.rejectClaim(claimantKey);
    expect(() => policy.redeemClaim("applicant")).toThrow(
      "Claim is not approved for redemption",
    );
    expect(policy.getLedger().claims.lookup(claimantKey)).toBe(
      ClaimStatus.rejected,
    );
  });

  it("keeps existing claims reviewable but rejects new claims after policy closure", () => {
    const policy = new ClaimShieldPolicySimulator();
    policy.addActor("applicant", 2);
    policy.addActor("second-applicant", 3);
    policy.setClaim("applicant", claimPayload());
    policy.submitClaim("applicant");
    const claimantKey = claimantKeyFor(policy);
    policy.closePolicy();
    policy.setClaim("second-applicant", claimPayload(1_500n, 0x55));

    expect(() => policy.submitClaim("second-applicant")).toThrow(
      "Policy is closed to new claims",
    );
    expect(policy.getLedger().submitted_count).toBe(1n);

    const rejected = policy.rejectClaim(claimantKey);
    expect(rejected.claims.lookup(claimantKey)).toBe(ClaimStatus.rejected);
    expect(rejected.approved_count).toBe(0n);
    expect(rejected.planned_benefit_total).toBe(0n);
  });

  it("rejects missing private payloads without changing the public claim state", () => {
    const policy = new ClaimShieldPolicySimulator();
    policy.addActor("applicant", 2);

    expect(() => policy.submitClaim("applicant")).toThrow(
      "Claim private payload is unavailable",
    );
    expect(policy.getLedger().submitted_count).toBe(0n);

    policy.setClaim("applicant", claimPayload());
    policy.submitClaim("applicant");
    const claimantKey = claimantKeyFor(policy);
    policy.approveClaim(claimantKey);
    policy.clearClaim("applicant");

    expect(() => policy.redeemClaim("applicant")).toThrow(
      "Claim private payload is unavailable",
    );
    expect(policy.getLedger().claims.lookup(claimantKey)).toBe(
      ClaimStatus.approved,
    );
  });

  it("prevents review decisions after a claim has been redeemed", () => {
    const policy = new ClaimShieldPolicySimulator();
    policy.addActor("applicant", 2);
    policy.setClaim("applicant", claimPayload());
    policy.submitClaim("applicant");
    const claimantKey = claimantKeyFor(policy);
    policy.approveClaim(claimantKey);
    policy.redeemClaim("applicant");

    expect(() => policy.approveClaim(claimantKey)).toThrow(
      "Claim has already been decided",
    );
    expect(() => policy.rejectClaim(claimantKey)).toThrow(
      "Claim has already been decided",
    );
    expect(policy.getLedger().claims.lookup(claimantKey)).toBe(
      ClaimStatus.redeemed,
    );
    expect(policy.getLedger().approved_count).toBe(1n);
    expect(policy.getLedger().planned_benefit_total).toBe(
      defaultPolicy.fixedBenefit,
    );
  });

  it.each([
    [
      "amount",
      (payload: ReturnType<typeof claimPayload>) => ({
        ...payload,
        amount: payload.amount + 1n,
      }),
    ],
    [
      "merchant digest",
      (payload: ReturnType<typeof claimPayload>) => ({
        ...payload,
        merchantDigest: new Uint8Array(32).fill(0x55),
      }),
    ],
    [
      "evidence digest",
      (payload: ReturnType<typeof claimPayload>) => ({
        ...payload,
        evidenceDigest: new Uint8Array(32).fill(0x66),
      }),
    ],
    [
      "receipt identifier",
      (payload: ReturnType<typeof claimPayload>) => ({
        ...payload,
        opaqueReceiptIdentifier: new Uint8Array(32).fill(0x77),
      }),
    ],
    [
      "salt",
      (payload: ReturnType<typeof claimPayload>) => ({
        ...payload,
        salt: new Uint8Array(32).fill(0x88),
      }),
    ],
  ])("rejects redemption when the private %s no longer matches its commitment", (_field, mutate) => {
    const policy = new ClaimShieldPolicySimulator();
    policy.addActor("applicant", 2);
    const originalPayload = claimPayload();
    policy.setClaim("applicant", originalPayload);
    policy.submitClaim("applicant");
    const claimantKey = claimantKeyFor(policy);
    policy.approveClaim(claimantKey);
    policy.setClaim("applicant", mutate(originalPayload));

    expect(() => policy.redeemClaim("applicant")).toThrow(
      "Claim commitment does not match private payload",
    );
    expect(policy.getLedger().claims.lookup(claimantKey)).toBe(
      ClaimStatus.approved,
    );
  });

  it("allows a receipt once per policy while scoping its nullifier to each policy", () => {
    const firstPolicy = new ClaimShieldPolicySimulator();
    const secondPolicy = new ClaimShieldPolicySimulator({
      ...defaultPolicy,
      nonce: new Uint8Array(32).fill(0x7f),
    });
    const payload = claimPayload();

    firstPolicy.addActor("applicant", 2);
    secondPolicy.addActor("applicant", 2);
    firstPolicy.setClaim("applicant", payload);
    secondPolicy.setClaim("applicant", payload);

    const firstLedger = firstPolicy.submitClaim("applicant");
    const secondLedger = secondPolicy.submitClaim("applicant");
    const [firstNullifier] = Array.from(firstLedger.used_receipt_nullifiers);
    const [secondNullifier] = Array.from(secondLedger.used_receipt_nullifiers);

    expect(firstNullifier).not.toEqual(secondNullifier);
    expect(firstLedger.used_receipt_nullifiers.size()).toBe(1n);
    expect(secondLedger.used_receipt_nullifiers.size()).toBe(1n);
  });
});
