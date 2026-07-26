import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ClaimStatus,
  type ClaimTransactionState,
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

export type PublicClaimReview = Readonly<{
  claimantKey: Uint8Array;
  status: ClaimStatus;
}>;

export function publicClaimsForReview(
  claims: Iterable<readonly [Uint8Array, ClaimStatus]>,
): PublicClaimReview[] {
  return Array.from(claims, ([claimantKey, status]) => ({
    claimantKey: new Uint8Array(claimantKey),
    status,
  }));
}

export function isClaimReviewable(status: ClaimStatus): boolean {
  return status === ClaimStatus.submitted;
}

export function canRejectPublicClaim({
  status,
  reason,
  isBusy,
}: {
  status: ClaimStatus;
  reason: string;
  isBusy: boolean;
}): boolean {
  return isClaimReviewable(status) && reason.trim().length > 0 && !isBusy;
}

export async function submitPolicyClosure({
  policyIsOpen,
  isBusy,
  closePolicy,
}: {
  policyIsOpen: boolean;
  isBusy: boolean;
  closePolicy: () => Promise<unknown>;
}): Promise<boolean> {
  if (!policyIsOpen || isBusy) return false;
  await closePolicy();
  return true;
}

export async function submitClaimReview({
  kind,
  claim,
  reason,
  isBusy,
  approveClaim,
  rejectClaim,
}: {
  kind: "approve" | "reject";
  claim: PublicClaimReview;
  reason: string;
  isBusy: boolean;
  approveClaim: (claimantKey: Uint8Array) => Promise<unknown>;
  rejectClaim: (claimantKey: Uint8Array) => Promise<unknown>;
}): Promise<boolean> {
  if (!isClaimReviewable(claim.status) || isBusy) return false;
  if (kind === "reject" && reason.trim().length === 0) return false;

  if (kind === "approve") {
    await approveClaim(claim.claimantKey);
  } else {
    // The reviewer reason gates this local UI action only. ClaimShield's
    // generated circuit accepts the pseudonymous claimant key and nothing else.
    await rejectClaim(claim.claimantKey);
  }
  return true;
}

const reviewInputClassName =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15";

function claimStatusLabel(
  status: ClaimStatus,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  switch (status) {
    case ClaimStatus.submitted:
      return t("claimShield.review.statusSubmitted");
    case ClaimStatus.approved:
      return t("claimShield.review.statusApproved");
    case ClaimStatus.rejected:
      return t("claimShield.review.statusRejected");
    case ClaimStatus.redeemed:
      return t("claimShield.review.statusRedeemed");
    default:
      return t("claimShield.review.statusNone");
  }
}

function pseudonymLabel(claimantKey: Uint8Array): string {
  const hex = Array.from(claimantKey, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `claim-${hex.slice(0, 8)}…${hex.slice(-6)}`;
}

function safeAdministrationError(
  transaction: ClaimTransactionState,
  t: ReturnType<typeof useTranslation>["t"],
): string | null {
  if (transaction.operation !== "close" && transaction.operation !== "review") {
    return null;
  }
  if (transaction.stage !== "failed" || !transaction.error) return null;

  if (transaction.error.kind === "business") {
    return t("claimShield.review.errorBusiness");
  }
  if (transaction.error.kind === "wallet") {
    return t("claimShield.review.errorWallet");
  }
  return t("claimShield.review.errorUnknown");
}

function ReviewClaimRow({
  claim,
  isBusy,
  approveClaim,
  rejectClaim,
  requestWalletGate,
}: {
  claim: PublicClaimReview;
  isBusy: boolean;
  approveClaim: (claimantKey: Uint8Array) => Promise<unknown>;
  rejectClaim: (claimantKey: Uint8Array) => Promise<unknown>;
  requestWalletGate: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const reviewable = isClaimReviewable(claim.status);
  const rejectionReady = canRejectPublicClaim({
    status: claim.status,
    reason,
    isBusy,
  });

  const review = async (kind: "approve" | "reject") => {
    requestWalletGate();
    const started = await submitClaimReview({
      kind,
      claim,
      reason,
      isBusy,
      approveClaim,
      rejectClaim,
    });
    if (started && kind === "reject") setReason("");
  };

  return (
    <li className="rounded-lg border border-border bg-card/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-bold text-foreground">
            {pseudonymLabel(claim.claimantKey)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("claimShield.review.publicStatus", {
              status: claimStatusLabel(claim.status, t),
            })}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            reviewable
              ? "bg-accent/20 text-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {reviewable
            ? t("claimShield.review.pending")
            : t("claimShield.review.decided")}
        </span>
      </div>

      {reviewable ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isBusy}
              onClick={() => void review("approve")}
            >
              {isBusy && <Loader2 className="animate-spin" />}
              {t("claimShield.review.approve")}
            </Button>
          </div>
          <div className="border-l-2 border-accent/50 pl-3">
            <label
              className="mb-1.5 block text-xs font-bold tracking-wide text-foreground"
              htmlFor={`review-reason-${pseudonymLabel(claim.claimantKey)}`}
            >
              {t("claimShield.review.rejectionReason")}
            </label>
            <input
              id={`review-reason-${pseudonymLabel(claim.claimantKey)}`}
              className={reviewInputClassName}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              autoComplete="off"
              placeholder={t("claimShield.review.rejectionPlaceholder")}
              disabled={isBusy}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!rejectionReady}
                onClick={() => void review("reject")}
              >
                {isBusy && <Loader2 className="animate-spin" />}
                {t("claimShield.review.reject")}
              </Button>
              {!reason.trim() && (
                <span className="text-xs text-muted-foreground">
                  {t("claimShield.review.reasonRequired")}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("claimShield.review.decidedBody")}
        </p>
      )}
    </li>
  );
}

type AdministratorReviewProps = Readonly<{
  policyIsOpen: boolean;
  claims: readonly PublicClaimReview[];
  isWalletConnected: boolean;
  requiresWalletConnection: boolean;
  transaction: ClaimTransactionState;
  connectWallet: () => Promise<void>;
  closePolicy: () => Promise<unknown>;
  approveClaim: (claimantKey: Uint8Array) => Promise<unknown>;
  rejectClaim: (claimantKey: Uint8Array) => Promise<unknown>;
}>;

export function AdministratorReview({
  policyIsOpen,
  claims,
  isWalletConnected,
  requiresWalletConnection,
  transaction,
  connectWallet,
  closePolicy,
  approveClaim,
  rejectClaim,
}: AdministratorReviewProps) {
  const { t } = useTranslation();
  const [walletGateRequested, setWalletGateRequested] = useState(false);
  const isBusy = isClaimTransactionInFlight(transaction.stage);
  const safeError = safeAdministrationError(transaction, t);

  const close = async () => {
    setWalletGateRequested(true);
    await submitPolicyClosure({ policyIsOpen, isBusy, closePolicy });
  };

  return (
    <section
      id="review"
      className="space-y-4"
      aria-label={t("claimShield.review.ariaLabel")}
    >
      <Card className="border-foreground bg-card shadow-[8px_8px_0_#d6c9af]">
        <CardHeader className="border-b border-border/70 pb-4">
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
            {t("claimShield.review.eyebrow")}
          </p>
          <CardTitle className="text-2xl">
            {t("claimShield.review.title")}
          </CardTitle>
          <CardDescription>
            {t("claimShield.review.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="rounded-lg border border-accent/30 bg-accent/8 px-3 py-3 text-xs leading-relaxed text-foreground">
            <p className="font-bold">
              {t("claimShield.review.materialsTitle")}
            </p>
            <p className="mt-1">{t("claimShield.review.materialsBody")}</p>
            <p className="mt-1">{t("claimShield.review.reasonBody")}</p>
          </div>

          <div className="rounded-lg border border-border bg-muted/60 p-3">
            <p className="text-sm font-bold text-foreground">
              {t("claimShield.review.intakeTitle")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t("claimShield.review.intakeBody")}
            </p>
            <Button
              type="button"
              className="mt-3"
              variant="outline"
              disabled={!policyIsOpen || isBusy}
              onClick={() => void close()}
            >
              {isBusy && <Loader2 className="animate-spin" />}
              {policyIsOpen
                ? t("claimShield.review.close")
                : t("claimShield.review.closed")}
            </Button>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold text-foreground">
                {t("claimShield.review.claimsTitle")}
              </p>
              <span className="text-xs text-muted-foreground">
                {t("claimShield.review.claimCount", { count: claims.length })}
              </span>
            </div>
            {claims.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                {t("claimShield.review.empty")}
              </p>
            ) : (
              <ul className="space-y-3">
                {claims.map((claim) => (
                  <ReviewClaimRow
                    key={Array.from(claim.claimantKey).join("-")}
                    claim={claim}
                    isBusy={isBusy}
                    approveClaim={approveClaim}
                    rejectClaim={rejectClaim}
                    requestWalletGate={() => setWalletGateRequested(true)}
                  />
                ))}
              </ul>
            )}
          </div>

          {walletGateRequested &&
            requiresWalletConnection &&
            !isWalletConnected && (
              <div className="rounded-lg border border-primary/20 bg-primary/8 p-3 text-sm text-foreground">
                <p>{t("claimShield.review.walletRequired")}</p>
                <Button
                  type="button"
                  className="mt-3"
                  onClick={() => void connectWallet()}
                >
                  {t("claimShield.review.connectWallet")}
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
