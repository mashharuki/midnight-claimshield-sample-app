import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type ClaimShieldLedgerState, ClaimStatus, PolicyState } from "shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import {
  isPolicyDraftDeployable,
  type PolicyDraft,
  PublicPolicyDashboard,
  policyInputFromDraft,
  policyStateIsOpen,
  policyTimingAdvisory,
  submitPolicyDraft,
  TransactionProgress,
  toPublicPolicyView,
  validatePolicyDraft,
} from "./PolicyWorkspace";
import { canStartPrivateClaim } from "./PrivateClaimSubmission";

const validDraft: PolicyDraft = {
  label: "Lunch support",
  category: "Wellbeing",
  startAt: "2026-07-01T09:00",
  endAt: "2026-07-31T18:00",
  minimumAmount: "500",
  maximumAmount: "1500",
  fixedBenefit: "300",
};

describe("ClaimShield policy workspace", () => {
  afterEach(async () => {
    await i18n.changeLanguage("ja");
  });

  it("renders transaction status in the selected English locale", async () => {
    await i18n.changeLanguage("en");
    const markup = renderToStaticMarkup(
      createElement(TransactionProgress, {
        operation: "submit",
        stage: "succeeded",
        error: null,
      }),
    );

    expect(markup).toContain("Private claim recorded.");
  });

  const invalidDraft: PolicyDraft = {
    ...validDraft,
    startAt: "2026-07-31T18:00",
    endAt: "2026-07-01T09:00",
    minimumAmount: "1501",
    maximumAmount: "1500",
    fixedBenefit: "0",
  };

  it("returns field guidance and prevents invalid policy deployments", () => {
    expect(validatePolicyDraft(invalidDraft)).toEqual({
      startAt: "開始日時は終了日時より前にしてください。",
      endAt: "終了日時は開始日時より後にしてください。",
      minimumAmount: "下限は上限以下にしてください。",
      maximumAmount: "上限は下限以上にしてください。",
      fixedBenefit: "固定給付額は 1 以上にしてください。",
    });
    expect(isPolicyDraftDeployable(invalidDraft)).toBe(false);
    expect(isPolicyDraftDeployable(validDraft)).toBe(true);
    expect(policyInputFromDraft(validDraft)).toMatchObject({
      label: "Lunch support",
      fixedBenefit: 300n,
    });
  });

  it("does not call the deploy action when a submitted form is invalid", async () => {
    const deployPolicy = vi.fn();

    await expect(
      submitPolicyDraft({ draft: invalidDraft, isBusy: false, deployPolicy }),
    ).resolves.toBe(false);

    expect(deployPolicy).not.toHaveBeenCalled();
  });

  it("keeps device-time guidance advisory while policy openness follows public state", () => {
    const startAt = 1_800_000_000n;
    const endAt = 1_800_003_600n;

    expect(policyTimingAdvisory(startAt, endAt, 1_799_999_999_000)).toBe(
      "この端末の時刻では、表示中の受付開始前です。",
    );
    expect(policyTimingAdvisory(startAt, endAt, 1_800_003_600_000)).toBe(
      "この端末の時刻では、表示中の受付期間が終了しています。",
    );
    expect(policyStateIsOpen(0)).toBe(true);
    expect(policyStateIsOpen(1)).toBe(false);
  });

  it("does not turn a device-time advisory into a private-claim write gate", () => {
    const startAt = 1_800_000_000n;
    const endAt = 1_800_003_600n;

    expect(policyTimingAdvisory(startAt, endAt, 1_800_003_600_000)).not.toBe(
      null,
    );
    expect(
      canStartPrivateClaim({
        policyIsOpen: policyStateIsOpen(PolicyState.open),
        hasExistingClaim: false,
        isBusy: false,
      }),
    ).toBe(true);
    expect(
      canStartPrivateClaim({
        policyIsOpen: policyStateIsOpen(PolicyState.closed),
        hasExistingClaim: false,
        isBusy: false,
      }),
    ).toBe(false);
  });

  it("projects only explicitly public policy data for the dashboard", () => {
    const emptyClaims = {
      isEmpty: () => true,
      size: () => 0n,
      member: () => false,
      lookup: () => ClaimStatus.none,
      *[Symbol.iterator]() {},
    };
    const emptyCommitments = {
      isEmpty: () => true,
      size: () => 0n,
      member: () => false,
      lookup: () => new Uint8Array(32),
      *[Symbol.iterator]() {},
    };
    const emptySet = {
      isEmpty: () => true,
      size: () => 0n,
      member: () => false,
      *[Symbol.iterator]() {},
    };
    const text = (value: string) => {
      const bytes = new Uint8Array(32);
      bytes.set(new TextEncoder().encode(value));
      return bytes;
    };
    const ledger: ClaimShieldLedgerState = {
      policyState: PolicyState.open,
      adminKey: new Uint8Array(32).fill(1),
      policyNonce: new Uint8Array(32).fill(2),
      policyLabel: text("Lunch support"),
      policyCategory: text("Wellbeing"),
      startAt: 1_800_000_000n,
      endAt: 1_800_003_600n,
      minimumAmount: 500n,
      maximumAmount: 1_500n,
      fixedBenefit: 300n,
      submittedCount: 4n,
      approvedCount: 3n,
      plannedBenefitTotal: 900n,
      claims: emptyClaims,
      commitments: emptyCommitments,
      usedReceiptNullifiers: emptySet,
    };

    expect(toPublicPolicyView(ledger)).toEqual({
      label: "Lunch support",
      category: "Wellbeing",
      startAt: 1_800_000_000n,
      endAt: 1_800_003_600n,
      minimumAmount: 500n,
      maximumAmount: 1_500n,
      fixedBenefit: 300n,
      submittedCount: 4n,
      approvedCount: 3n,
      plannedBenefitTotal: 900n,
      isOpen: true,
    });
  });

  it("shows the public policy contract address needed to join a shared workflow", () => {
    const markup = renderToStaticMarkup(
      createElement(PublicPolicyDashboard, {
        contractAddress:
          "0200000000000000000000000000000000000000000000000000000000000000",
        policy: {
          label: "Lunch support",
          category: "Wellbeing",
          startAt: 1_800_000_000n,
          endAt: 1_800_003_600n,
          minimumAmount: 500n,
          maximumAmount: 1_500n,
          fixedBenefit: 300n,
          submittedCount: 0n,
          approvedCount: 0n,
          plannedBenefitTotal: 0n,
          isOpen: true,
        },
      }),
    );

    expect(markup).toContain("公開 policy contract address");
    expect(markup).toContain(
      "0200000000000000000000000000000000000000000000000000000000000000",
    );
  });
});
