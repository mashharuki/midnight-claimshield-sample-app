import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
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

export function canRedeemPersonalClaim(
  personalClaim: ClaimShieldPersonalProjection,
): boolean {
  const claim = personalClaim.claim;
  return Boolean(
    claim &&
      claim.status === ClaimStatus.approved &&
      claim.hasLocalPayload &&
      claim.canRedeem,
  );
}

export async function submitClaimRedemption({
  personalClaim,
  isBusy,
  redeemClaim,
}: {
  personalClaim: ClaimShieldPersonalProjection;
  isBusy: boolean;
  redeemClaim: () => Promise<unknown>;
}): Promise<boolean> {
  if (!canRedeemPersonalClaim(personalClaim) || isBusy) return false;
  await redeemClaim();
  return true;
}

function safeRedemptionError(
  transaction: ClaimTransactionState,
  t: ReturnType<typeof useTranslation>["t"],
): string | null {
  if (transaction.operation !== "redeem") return null;
  if (transaction.stage !== "failed" || !transaction.error) return null;
  if (transaction.error.kind === "privateState") {
    return t("claimShield.redeem.errorPrivate");
  }
  if (transaction.error.kind === "business") {
    return t("claimShield.redeem.errorBusiness");
  }
  if (transaction.error.kind === "wallet") {
    return t("claimShield.redeem.errorWallet");
  }
  return t("claimShield.redeem.errorUnknown");
}

function claimStatusLabel(
  status: ClaimStatus | undefined,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  switch (status) {
    case ClaimStatus.submitted:
      return t("claimShield.redeem.statusSubmitted");
    case ClaimStatus.approved:
      return t("claimShield.redeem.statusApproved");
    case ClaimStatus.rejected:
      return t("claimShield.redeem.statusRejected");
    case ClaimStatus.redeemed:
      return t("claimShield.redeem.statusRedeemed");
    default:
      return t("claimShield.redeem.statusNone");
  }
}

type ClaimRedemptionProps = Readonly<{
  personalClaim: ClaimShieldPersonalProjection;
  /** A safe hook error; raw private payload values are never exposed here. */
  readError: ClaimUiError | null;
  transaction: ClaimTransactionState;
  isWalletConnected: boolean;
  requiresWalletConnection: boolean;
  connectWallet: () => Promise<void>;
  redeemClaim: () => Promise<unknown>;
}>;

export function ClaimRedemption({
  personalClaim,
  readError,
  transaction,
  isWalletConnected,
  requiresWalletConnection,
  connectWallet,
  redeemClaim,
}: ClaimRedemptionProps) {
  const { t } = useTranslation();
  const [walletGateRequested, setWalletGateRequested] = useState(false);
  const isBusy = isClaimTransactionInFlight(transaction.stage);
  const canRedeem = canRedeemPersonalClaim(personalClaim);
  const status = personalClaim.claim?.status;
  const safeError = safeRedemptionError(transaction, t);
  const hasUnavailablePayload =
    personalClaim.recoveryError !== null ||
    (readError?.kind === "privateState" &&
      readError.code === "claimPayloadUnavailable") ||
    (status === ClaimStatus.approved && !personalClaim.claim?.hasLocalPayload);

  const redeem = async () => {
    setWalletGateRequested(true);
    await submitClaimRedemption({ personalClaim, isBusy, redeemClaim });
  };

  return (
    <section
      id="redeem"
      className="space-y-4"
      aria-label={t("claimShield.redeem.ariaLabel")}
    >
      <Card className="border-foreground bg-card shadow-[8px_8px_0_#d6c9af]">
        <CardHeader className="border-b border-border/70 pb-4">
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
            {t("claimShield.redeem.eyebrow")}
          </p>
          <CardTitle className="text-2xl">
            {t("claimShield.redeem.title")}
          </CardTitle>
          <CardDescription>
            {t("claimShield.redeem.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="rounded-lg border border-border bg-muted/60 px-3 py-3 text-sm">
            <p className="font-bold text-foreground">
              {t("claimShield.redeem.deviceClaim")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {claimStatusLabel(status, t)}
              {personalClaim.claim &&
                (personalClaim.claim.hasLocalPayload
                  ? t("claimShield.redeem.payloadAvailable")
                  : t("claimShield.redeem.payloadUnavailable"))}
            </p>
          </div>

          {canRedeem ? (
            <div className="rounded-lg border border-primary/20 bg-primary/8 p-3">
              <p className="text-sm font-bold text-foreground">
                {t("claimShield.redeem.readyTitle")}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("claimShield.redeem.readyBody")}
              </p>
              <Button
                type="button"
                className="mt-3"
                disabled={isBusy}
                onClick={() => void redeem()}
              >
                {isBusy && <Loader2 className="animate-spin" />}
                {t("claimShield.redeem.redeem")}
              </Button>
            </div>
          ) : (
            <p className="rounded-lg border border-border px-3 py-3 text-xs leading-relaxed text-muted-foreground">
              {t("claimShield.redeem.unavailable")}
            </p>
          )}

          {hasUnavailablePayload && (
            <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-foreground">
              {t("claimShield.redeem.recovery")}
            </p>
          )}
          {transaction.operation === "redeem" &&
            transaction.stage === "succeeded" && (
              <p className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-sm text-foreground">
                {t("claimShield.redeem.succeeded")}
              </p>
            )}
          {walletGateRequested &&
            requiresWalletConnection &&
            !isWalletConnected && (
              <div className="rounded-lg border border-primary/20 bg-primary/8 p-3 text-sm text-foreground">
                <p>{t("claimShield.redeem.walletRequired")}</p>
                <Button
                  type="button"
                  className="mt-3"
                  onClick={() => void connectWallet()}
                >
                  {t("claimShield.redeem.connectWallet")}
                </Button>
              </div>
            )}
          {safeError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {safeError}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
