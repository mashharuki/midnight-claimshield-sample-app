import {
  type ClaimInput,
  ClaimStatus,
  type ClaimUiError,
  isClaimTransactionInFlight,
  type PolicyInput,
  PolicyState,
} from "shared";
import { describe, expect, it } from "vitest";

describe("ClaimShield shared domain contract", () => {
  it("gives the app generated status enums and transaction-stage guards", () => {
    const policy: PolicyInput = {
      label: "Lunch support",
      category: "meals",
      startAt: 10n,
      endAt: 20n,
      minimumAmount: 100n,
      maximumAmount: 1_000n,
      fixedBenefit: 300n,
    };
    const privateClaim: ClaimInput = {
      amount: 500n,
      merchantDigest: new Uint8Array(32),
      evidenceDigest: new Uint8Array(32),
      opaqueReceiptIdentifier: new Uint8Array(32),
    };
    const error: ClaimUiError = {
      kind: "proof",
      code: "proofFailed",
    };

    expect(policy.fixedBenefit).toBe(300n);
    expect(privateClaim.amount).toBe(500n);
    expect(error.code).toBe("proofFailed");
    expect(PolicyState.open).toBe(0);
    expect(ClaimStatus.approved).toBe(2);
    expect(isClaimTransactionInFlight("proving")).toBe(true);
    expect(isClaimTransactionInFlight("succeeded")).toBe(false);
  });
});
