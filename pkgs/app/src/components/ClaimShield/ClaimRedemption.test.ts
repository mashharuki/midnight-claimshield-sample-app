import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClaimStatus, type ClaimTransactionState } from "shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClaimShieldPersonalProjection } from "@/hooks/useClaimShield";
import i18n from "@/i18n";
import {
  ClaimRedemption,
  canRedeemPersonalClaim,
  submitClaimRedemption,
} from "./ClaimRedemption";

const idleTransaction: ClaimTransactionState = {
  operation: null,
  stage: "idle",
  error: null,
};

const approvedClaim = {
  claimantKey: new Uint8Array(32).fill(7),
  status: ClaimStatus.approved,
  hasLocalPayload: true,
  canRedeem: true,
} as const;

const approvedWithPayload: ClaimShieldPersonalProjection = {
  claim: approvedClaim,
  recoveryError: null,
};

describe("ClaimRedemption", () => {
  afterEach(async () => {
    await i18n.changeLanguage("ja");
  });

  it("renders redemption and safe recovery guidance in English", async () => {
    await i18n.changeLanguage("en");
    const markup = renderToStaticMarkup(
      createElement(ClaimRedemption, {
        personalClaim: approvedWithPayload,
        readError: null,
        transaction: {
          operation: "redeem",
          stage: "failed",
          error: { kind: "privateState", code: "claimPayloadUnavailable" },
        },
        isWalletConnected: true,
        requiresWalletConnection: false,
        connectWallet: vi.fn(),
        redeemClaim: vi.fn(),
      }),
    );

    expect(markup).toContain("Redeem an entitlement once");
    expect(markup).toContain("This approved claim can be redeemed.");
    expect(markup).toContain("Restore it from a backup before trying again.");
  });

  it("only allows an approved claim with its local private payload to redeem", () => {
    expect(canRedeemPersonalClaim(approvedWithPayload)).toBe(true);
    expect(
      canRedeemPersonalClaim({
        claim: {
          ...approvedClaim,
          status: ClaimStatus.rejected,
          canRedeem: false,
        },
        recoveryError: null,
      }),
    ).toBe(false);
    expect(
      canRedeemPersonalClaim({
        claim: {
          ...approvedClaim,
          hasLocalPayload: false,
          canRedeem: false,
        },
        recoveryError: {
          kind: "privateState",
          code: "claimPayloadUnavailable",
        },
      }),
    ).toBe(false);
  });

  it("does not start duplicate or ineligible redemption writes", async () => {
    const redeemClaim = vi.fn();

    await expect(
      submitClaimRedemption({
        personalClaim: approvedWithPayload,
        isBusy: false,
        redeemClaim,
      }),
    ).resolves.toBe(true);
    await expect(
      submitClaimRedemption({
        personalClaim: approvedWithPayload,
        isBusy: true,
        redeemClaim,
      }),
    ).resolves.toBe(false);

    expect(redeemClaim).toHaveBeenCalledOnce();
  });

  it("shows backup guidance for an unavailable payload and states that redemption is not a transfer", () => {
    const markup = renderToStaticMarkup(
      createElement(ClaimRedemption, {
        personalClaim: {
          claim: {
            ...approvedClaim,
            hasLocalPayload: false,
            canRedeem: false,
          },
          recoveryError: {
            kind: "privateState",
            code: "claimPayloadUnavailable",
          },
        },
        readError: null,
        transaction: idleTransaction,
        isWalletConnected: true,
        requiresWalletConnection: false,
        connectWallet: vi.fn(),
        redeemClaim: vi.fn(),
      }),
    );

    expect(markup).toContain("バックアップから復元するまで引換できません。");
    expect(markup).toContain("資産送付や支払いは行いません。");
    expect(markup).not.toContain("Secret Merchant 91");
  });

  it("shows backup guidance when the entire local private-state projection is unavailable", () => {
    const markup = renderToStaticMarkup(
      createElement(ClaimRedemption, {
        personalClaim: { claim: null, recoveryError: null },
        readError: {
          kind: "privateState",
          code: "claimPayloadUnavailable",
        },
        transaction: idleTransaction,
        isWalletConnected: true,
        requiresWalletConnection: false,
        connectWallet: vi.fn(),
        redeemClaim: vi.fn(),
      }),
    );

    expect(markup).toContain("バックアップから復元するまで引換できません。");
    expect(markup).not.toContain("公開状態を取得できませんでした。");
  });
});
