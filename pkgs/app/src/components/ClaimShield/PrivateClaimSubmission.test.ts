import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClaimStatus, type ClaimTransactionState } from "shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { PrivateClaimSubmission } from "./PrivateClaimSubmission";

const idleTransaction: ClaimTransactionState = {
  operation: null,
  stage: "idle",
  error: null,
};

describe("PrivateClaimSubmission", () => {
  afterEach(async () => {
    await i18n.changeLanguage("ja");
  });

  it("renders private input, privacy, and safe error guidance in English", async () => {
    await i18n.changeLanguage("en");
    const markup = renderToStaticMarkup(
      createElement(PrivateClaimSubmission, {
        minimumAmount: 500n,
        maximumAmount: 1_500n,
        policyIsOpen: true,
        isWalletConnected: false,
        requiresWalletConnection: false,
        personalClaim: { claim: null, recoveryError: null },
        transaction: {
          operation: "submit",
          stage: "failed",
          error: { kind: "wallet", code: "networkMismatch" },
        },
        connectWallet: vi.fn(),
        submitClaim: vi.fn(),
      }),
    );

    expect(markup).toContain("Create a private claim");
    expect(markup).toContain("Understand this before submitting");
    expect(markup).toContain("Public visibility and limits after submission");
    expect(markup).toContain("Check Lace Wallet and the selected network");
  });

  it("renders a private-only form and persistent privacy limits without raw values", () => {
    const markup = renderToStaticMarkup(
      createElement(PrivateClaimSubmission, {
        minimumAmount: 500n,
        maximumAmount: 1_500n,
        policyIsOpen: true,
        isWalletConnected: false,
        requiresWalletConnection: false,
        personalClaim: { claim: null, recoveryError: null },
        transaction: idleTransaction,
        connectWallet: vi.fn(),
        submitClaim: vi.fn(),
      }),
    );

    expect(markup).toContain("秘密の申請を作成");
    expect(markup).toContain("公開されるのは policy 条件、疑似 ID");
    expect(markup).toContain(
      "完全な匿名性、本人性、Sybil 耐性を保証するものではありません。",
    );
    expect(markup).toContain('id="claim-receipt-identifier"');
    expect(markup).toContain('type="password"');
    expect(markup).not.toContain("Secret Merchant 91");
    expect(markup).not.toContain("receipt-2026-07-26");
  });

  it("shows backup guidance instead of a lost private payload", () => {
    const markup = renderToStaticMarkup(
      createElement(PrivateClaimSubmission, {
        minimumAmount: 500n,
        maximumAmount: 1_500n,
        policyIsOpen: true,
        isWalletConnected: true,
        requiresWalletConnection: false,
        personalClaim: {
          claim: {
            claimantKey: new Uint8Array(32).fill(7),
            status: ClaimStatus.submitted,
            hasLocalPayload: false,
            canRedeem: false,
          },
          recoveryError: {
            kind: "privateState",
            code: "claimPayloadUnavailable",
          },
        },
        transaction: idleTransaction,
        connectWallet: vi.fn(),
        submitClaim: vi.fn(),
      }),
    );

    expect(markup).toContain("この端末の申請状態");
    expect(markup).toContain("バックアップからの復元が必要です。");
    expect(markup).not.toContain("000000000000000000000000");
  });
});
