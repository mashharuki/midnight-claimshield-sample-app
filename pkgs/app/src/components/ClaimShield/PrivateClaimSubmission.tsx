import { Loader2 } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type ClaimInput,
  type ClaimOperationResult,
  ClaimStatus,
  type ClaimTransactionState,
  type ClaimUiError,
  isClaimTransactionInFlight,
} from "shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClaimShieldPersonalProjection } from "@/hooks/useClaimShield";
import {
  type PrivateClaimDraft,
  submitPrivateClaimDraft,
  validatePrivateClaimDraft,
} from "./claimDraft";

const emptyPrivateClaimDraft: PrivateClaimDraft = {
  amount: "",
  merchant: "",
  receiptIdentifier: "",
};

const privateInputClassName =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15";

const privateFieldLabelClassName =
  "mb-1.5 block text-xs font-bold tracking-wide text-foreground";

type PrivateClaimSubmissionProps = Readonly<{
  minimumAmount: bigint;
  maximumAmount: bigint;
  policyIsOpen: boolean;
  isWalletConnected: boolean;
  requiresWalletConnection: boolean;
  personalClaim: ClaimShieldPersonalProjection;
  transaction: ClaimTransactionState;
  connectWallet: () => Promise<void>;
  submitClaim: (input: ClaimInput) => Promise<ClaimOperationResult | null>;
}>;

/**
 * Decides whether a private-claim write may start from authoritative public
 * policy state and local operation state. Device-time messaging is deliberately
 * excluded: it is advisory only and must not block a valid on-chain action.
 */
export function canStartPrivateClaim({
  policyIsOpen,
  hasExistingClaim,
  isBusy,
}: Readonly<{
  policyIsOpen: boolean;
  hasExistingClaim: boolean;
  isBusy: boolean;
}>): boolean {
  return policyIsOpen && !hasExistingClaim && !isBusy;
}

function PrivateField({
  inputId,
  label,
  error,
  children,
}: {
  inputId: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={privateFieldLabelClassName} htmlFor={inputId}>
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs leading-relaxed text-destructive">{error}</p>
      )}
    </div>
  );
}

function claimStatusLabel(
  status: ClaimStatus,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  switch (status) {
    case ClaimStatus.submitted:
      return t("claimShield.claim.statusSubmitted");
    case ClaimStatus.approved:
      return t("claimShield.claim.statusApproved");
    case ClaimStatus.rejected:
      return t("claimShield.claim.statusRejected");
    case ClaimStatus.redeemed:
      return t("claimShield.claim.statusRedeemed");
    default:
      return t("claimShield.claim.statusNone");
  }
}

function safeSubmitErrorMessage(
  error: ClaimUiError | null,
  minimumAmount: bigint,
  maximumAmount: bigint,
  t: ReturnType<typeof useTranslation>["t"],
): string | null {
  if (!error) return null;
  if (error.kind === "input" && error.code === "amountOutOfRange") {
    return t("claimShield.claim.errorRange", {
      minimum: minimumAmount.toLocaleString(),
      maximum: maximumAmount.toLocaleString(),
    });
  }
  if (error.kind === "input" && error.code === "missingReceipt") {
    return t("claimShield.claim.errorReceipt");
  }
  if (error.kind === "business" && error.code === "duplicateReceipt") {
    return t("claimShield.claim.errorDuplicate");
  }
  if (error.kind === "business" && error.code === "policyClosed") {
    return t("claimShield.claim.errorClosed");
  }
  if (error.kind === "wallet") {
    return t("claimShield.claim.errorWallet");
  }
  return t("claimShield.claim.errorUnknown");
}

function localizePrivateClaimDraftError(
  error: string | undefined,
  minimumAmount: bigint,
  maximumAmount: bigint,
  t: ReturnType<typeof useTranslation>["t"],
): string | undefined {
  if (!error) return undefined;
  if (error.startsWith("支出額は")) {
    return t("claimShield.claim.errorRange", {
      minimum: minimumAmount.toLocaleString(),
      maximum: maximumAmount.toLocaleString(),
    });
  }
  if (error === "店舗名を入力してください。") {
    return t("claimShield.claim.errorMerchant");
  }
  if (error.startsWith("ランダムなレシート識別子")) {
    return t("claimShield.claim.errorReceipt");
  }
  return error;
}

/**
 * Owns raw applicant input only for the active browser form. The public
 * dashboard receives no values from this component; only ClaimInput crosses
 * into the hook and the adapter's private-state boundary.
 */
export function PrivateClaimSubmission({
  minimumAmount,
  maximumAmount,
  policyIsOpen,
  isWalletConnected,
  requiresWalletConnection,
  personalClaim,
  transaction,
  connectWallet,
  submitClaim,
}: PrivateClaimSubmissionProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<PrivateClaimDraft>(emptyPrivateClaimDraft);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [walletGateRequested, setWalletGateRequested] = useState(false);
  const errors = useMemo(
    () => validatePrivateClaimDraft(draft, minimumAmount, maximumAmount),
    [draft, maximumAmount, minimumAmount],
  );
  const isBusy = isClaimTransactionInFlight(transaction.stage);
  const hasExistingClaim = personalClaim.claim !== null;
  const canStartClaim = canStartPrivateClaim({
    policyIsOpen,
    hasExistingClaim,
    isBusy,
  });
  const safeError =
    transaction.operation === "submit"
      ? safeSubmitErrorMessage(
          transaction.error,
          minimumAmount,
          maximumAmount,
          t,
        )
      : null;

  const updateDraft = (field: keyof PrivateClaimDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    if (!canStartClaim) return;

    const started = await submitPrivateClaimDraft({
      draft,
      minimumAmount,
      maximumAmount,
      isBusy,
      submitClaim: async (input) => {
        const result = await submitClaim(input);
        if (result?.ok) setDraft(emptyPrivateClaimDraft);
        return result;
      },
    });
    if (started) setWalletGateRequested(true);
  };

  return (
    <section
      id="claim"
      className="space-y-4"
      aria-label={t("claimShield.claim.ariaLabel")}
    >
      <Card className="border-foreground bg-card shadow-[8px_8px_0_#d6c9af]">
        <CardHeader className="border-b border-border/70 pb-4">
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
            {t("claimShield.claim.eyebrow")}
          </p>
          <CardTitle className="text-2xl">
            {t("claimShield.claim.title")}
          </CardTitle>
          <CardDescription>
            {t("claimShield.claim.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="rounded-lg border border-primary/20 bg-primary/8 px-3 py-3 text-xs leading-relaxed text-foreground">
            <p className="font-bold">{t("claimShield.claim.beforeTitle")}</p>
            <p className="mt-1">{t("claimShield.claim.beforePublic")}</p>
            <p className="mt-1">{t("claimShield.claim.beforePrivate")}</p>
          </div>

          {hasExistingClaim ? (
            <div className="rounded-lg border border-border bg-muted/60 px-3 py-3 text-sm">
              <p className="font-bold text-foreground">
                {t("claimShield.claim.deviceClaim")}
              </p>
              <p className="mt-1 text-muted-foreground">
                {claimStatusLabel(personalClaim.claim.status, t)} ・
                {personalClaim.claim.hasLocalPayload
                  ? t("claimShield.claim.payloadAvailable")
                  : t("claimShield.claim.payloadUnavailable")}
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <PrivateField
                inputId="claim-amount"
                label={t("claimShield.claim.amountLabel", {
                  minimum: minimumAmount.toLocaleString(),
                  maximum: maximumAmount.toLocaleString(),
                })}
                error={
                  hasSubmitted
                    ? localizePrivateClaimDraftError(
                        errors.amount,
                        minimumAmount,
                        maximumAmount,
                        t,
                      )
                    : undefined
                }
              >
                <input
                  id="claim-amount"
                  className={privateInputClassName}
                  inputMode="numeric"
                  autoComplete="off"
                  value={draft.amount}
                  onChange={(event) =>
                    updateDraft("amount", event.target.value)
                  }
                  aria-invalid={Boolean(hasSubmitted && errors.amount)}
                  placeholder={t("claimShield.claim.amountPlaceholder")}
                />
              </PrivateField>
              <PrivateField
                inputId="claim-merchant"
                label={t("claimShield.claim.merchantLabel")}
                error={
                  hasSubmitted
                    ? localizePrivateClaimDraftError(
                        errors.merchant,
                        minimumAmount,
                        maximumAmount,
                        t,
                      )
                    : undefined
                }
              >
                <input
                  id="claim-merchant"
                  className={privateInputClassName}
                  autoComplete="off"
                  value={draft.merchant}
                  onChange={(event) =>
                    updateDraft("merchant", event.target.value)
                  }
                  aria-invalid={Boolean(hasSubmitted && errors.merchant)}
                  placeholder={t("claimShield.claim.merchantPlaceholder")}
                />
              </PrivateField>
              <PrivateField
                inputId="claim-receipt-identifier"
                label={t("claimShield.claim.receiptLabel")}
                error={
                  hasSubmitted
                    ? localizePrivateClaimDraftError(
                        errors.receiptIdentifier,
                        minimumAmount,
                        maximumAmount,
                        t,
                      )
                    : undefined
                }
              >
                <input
                  id="claim-receipt-identifier"
                  className={privateInputClassName}
                  type="password"
                  autoComplete="off"
                  value={draft.receiptIdentifier}
                  onChange={(event) =>
                    updateDraft("receiptIdentifier", event.target.value)
                  }
                  aria-invalid={Boolean(
                    hasSubmitted && errors.receiptIdentifier,
                  )}
                  placeholder={t("claimShield.claim.receiptPlaceholder")}
                />
              </PrivateField>

              <p className="rounded-lg border border-accent/25 bg-accent/7 px-3 py-2 text-xs leading-relaxed text-foreground">
                {t("claimShield.claim.receiptHelp")}
              </p>

              {!policyIsOpen && (
                <p className="text-sm text-destructive">
                  {t("claimShield.claim.closed")}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto"
                disabled={!canStartClaim}
              >
                {isBusy && <Loader2 className="animate-spin" />}
                {isWalletConnected
                  ? t("claimShield.claim.submit")
                  : t("claimShield.claim.connectAndSubmit")}
              </Button>
            </form>
          )}

          {walletGateRequested &&
            requiresWalletConnection &&
            !isWalletConnected && (
              <div className="rounded-lg border border-primary/20 bg-primary/8 p-3 text-sm text-foreground">
                <p>{t("claimShield.claim.walletRequired")}</p>
                <Button
                  type="button"
                  className="mt-3"
                  onClick={() => void connectWallet()}
                >
                  {t("claimShield.claim.connectWallet")}
                </Button>
              </div>
            )}
          {safeError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {safeError}
            </p>
          )}
          {personalClaim.recoveryError && (
            <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-foreground">
              {t("claimShield.claim.recovery")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card/85">
        <CardContent className="space-y-2 pt-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-bold text-foreground">
            {t("claimShield.claim.privacyTitle")}
          </p>
          <p>{t("claimShield.claim.privacyPseudonym")}</p>
          <p>{t("claimShield.claim.privacyRetry")}</p>
        </CardContent>
      </Card>
    </section>
  );
}
