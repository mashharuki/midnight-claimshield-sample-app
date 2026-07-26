import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClaimStatus, type ClaimTransactionState } from "shared";
import { describe, expect, it, vi } from "vitest";
import {
  AdministratorReview,
  canRejectPublicClaim,
  isClaimReviewable,
  publicClaimsForReview,
  submitClaimReview,
  submitPolicyClosure,
} from "./AdministratorReview";

const idleTransaction: ClaimTransactionState = {
  operation: null,
  stage: "idle",
  error: null,
};

const submittedClaim = {
  claimantKey: new Uint8Array(32).fill(7),
  status: ClaimStatus.submitted,
} as const;

describe("AdministratorReview", () => {
  it("allows only submitted public claims to be reviewed and requires a local rejection reason", () => {
    expect(isClaimReviewable(ClaimStatus.submitted)).toBe(true);
    expect(isClaimReviewable(ClaimStatus.approved)).toBe(false);
    expect(
      canRejectPublicClaim({
        status: ClaimStatus.submitted,
        reason: "",
        isBusy: false,
      }),
    ).toBe(false);
    expect(
      canRejectPublicClaim({
        status: ClaimStatus.submitted,
        reason: "資料は社内窓口で確認済み",
        isBusy: false,
      }),
    ).toBe(true);
  });

  it("keeps a rejection reason outside the ClaimShield adapter call", async () => {
    const approveClaim = vi.fn();
    const rejectClaim = vi.fn();
    const rejectionReason = "社内資料の確認結果は別の安全な保管場所に記録";

    await expect(
      submitClaimReview({
        kind: "reject",
        claim: submittedClaim,
        reason: rejectionReason,
        isBusy: false,
        approveClaim,
        rejectClaim,
      }),
    ).resolves.toBe(true);

    expect(rejectClaim).toHaveBeenCalledOnce();
    expect(rejectClaim).toHaveBeenCalledWith(submittedClaim.claimantKey);
    expect(approveClaim).not.toHaveBeenCalled();
    expect(rejectClaim.mock.calls.flat()).not.toContain(rejectionReason);
  });

  it("prevents duplicate close and review starts when the public state is terminal or busy", async () => {
    const closePolicy = vi.fn();
    const approveClaim = vi.fn();
    const rejectClaim = vi.fn();

    await expect(
      submitPolicyClosure({
        policyIsOpen: false,
        isBusy: false,
        closePolicy,
      }),
    ).resolves.toBe(false);
    await expect(
      submitClaimReview({
        kind: "approve",
        claim: { ...submittedClaim, status: ClaimStatus.approved },
        reason: "",
        isBusy: false,
        approveClaim,
        rejectClaim,
      }),
    ).resolves.toBe(false);

    expect(closePolicy).not.toHaveBeenCalled();
    expect(approveClaim).not.toHaveBeenCalled();
    expect(rejectClaim).not.toHaveBeenCalled();
  });

  it("renders only public reviewer data and the dApp-external review boundary", () => {
    const claims = publicClaimsForReview([
      [submittedClaim.claimantKey, ClaimStatus.submitted],
      [new Uint8Array(32).fill(9), ClaimStatus.approved],
    ]);
    const markup = renderToStaticMarkup(
      createElement(AdministratorReview, {
        policyIsOpen: true,
        claims,
        isWalletConnected: true,
        requiresWalletConnection: false,
        transaction: idleTransaction,
        connectWallet: vi.fn(),
        closePolicy: vi.fn(),
        approveClaim: vi.fn(),
        rejectClaim: vi.fn(),
      }),
    );

    expect(markup).toContain("審査資料は dApp 外で確認します。");
    expect(markup).toContain("取消理由は ClaimShield へ送信・保存しません。");
    expect(markup).toContain("判断済み");
    expect(markup).not.toContain("Secret Merchant 91");
    expect(markup).not.toContain("receipt-2026-07-26");
  });
});
