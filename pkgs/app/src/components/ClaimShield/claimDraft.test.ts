import type { ClaimInput } from "shared";
import { describe, expect, it, vi } from "vitest";
import {
  createPrivateClaimInput,
  type PrivateClaimDraft,
  submitPrivateClaimDraft,
  validatePrivateClaimDraft,
} from "./claimDraft";

const validDraft: PrivateClaimDraft = {
  amount: "720",
  merchant: "Sora Coffee",
  receiptIdentifier: "receipt-2026-07-26-6f5ab6cb-d6e2-498d-bb8d",
};

describe("private claim draft boundary", () => {
  it("shows private-form guidance and never starts a submit for invalid input", async () => {
    const submitClaim = vi.fn();
    const invalidDraft: PrivateClaimDraft = {
      amount: "2000",
      merchant: "",
      receiptIdentifier: "short",
    };

    expect(validatePrivateClaimDraft(invalidDraft, 500n, 1_500n)).toEqual({
      amount: "支出額は 500〜1,500 の範囲で入力してください。",
      merchant: "店舗名を入力してください。",
      receiptIdentifier:
        "ランダムなレシート識別子を UTF-8 で 32 bytes 以上入力してください。",
    });
    await expect(
      submitPrivateClaimDraft({
        draft: invalidDraft,
        minimumAmount: 500n,
        maximumAmount: 1_500n,
        isBusy: false,
        submitClaim,
      }),
    ).resolves.toBe(false);
    expect(submitClaim).not.toHaveBeenCalled();
  });

  it("converts raw browser input to only the ClaimInput witness shape", async () => {
    const input = await createPrivateClaimInput(validDraft);
    const normalized = await createPrivateClaimInput({
      ...validDraft,
      merchant: "  Sora Coffee  ",
    });
    const sameReceiptAtAnotherMerchant = await createPrivateClaimInput({
      ...validDraft,
      merchant: "Harbor Bakery",
    });

    expect(Object.keys(input)).toEqual([
      "amount",
      "merchantDigest",
      "evidenceDigest",
      "opaqueReceiptIdentifier",
    ]);
    expect(input.amount).toBe(720n);
    expect(input.merchantDigest).toHaveLength(32);
    expect(input.evidenceDigest).toHaveLength(32);
    expect(input.opaqueReceiptIdentifier).toHaveLength(32);
    expect(input.merchantDigest).toEqual(normalized.merchantDigest);
    expect(input.evidenceDigest).not.toEqual(input.merchantDigest);
    expect(input.opaqueReceiptIdentifier).not.toEqual(input.evidenceDigest);
    expect(input.opaqueReceiptIdentifier).toEqual(
      sameReceiptAtAnotherMerchant.opaqueReceiptIdentifier,
    );
    expect(
      Object.values(input).some((value) => typeof value === "string"),
    ).toBe(false);
  });

  it("passes exactly one private ClaimInput to a valid submit action", async () => {
    const submitClaim = vi.fn<(input: ClaimInput) => Promise<unknown>>(
      async () => undefined,
    );

    await expect(
      submitPrivateClaimDraft({
        draft: validDraft,
        minimumAmount: 500n,
        maximumAmount: 1_500n,
        isBusy: false,
        submitClaim,
      }),
    ).resolves.toBe(true);

    expect(submitClaim).toHaveBeenCalledOnce();
    expect(submitClaim.mock.calls[0]?.[0]).toMatchObject({ amount: 720n });
  });
});
