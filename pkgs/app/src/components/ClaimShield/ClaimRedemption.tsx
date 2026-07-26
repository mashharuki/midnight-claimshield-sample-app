import { Loader2 } from "lucide-react";
import { useState } from "react";
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
): string | null {
  if (transaction.operation !== "redeem") return null;
  if (transaction.stage !== "failed" || !transaction.error) return null;
  if (transaction.error.kind === "privateState") {
    return "このブラウザの private payload を利用できません。バックアップから復元してから再試行してください。";
  }
  if (transaction.error.kind === "business") {
    return "この申請は引換可能な状態ではありません。公開状態を確認してください。";
  }
  if (transaction.error.kind === "wallet") {
    return "Lace Wallet の接続または署名を確認して、もう一度実行してください。";
  }
  return "引換の資格記録を完了できませんでした。秘密値を表示せずに安全に再試行できます。";
}

function claimStatusLabel(status: ClaimStatus | undefined): string {
  switch (status) {
    case ClaimStatus.submitted:
      return "審査待ち";
    case ClaimStatus.approved:
      return "承認済み";
    case ClaimStatus.rejected:
      return "取消済み";
    case ClaimStatus.redeemed:
      return "引換済み";
    default:
      return "申請なし";
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
  const [walletGateRequested, setWalletGateRequested] = useState(false);
  const isBusy = isClaimTransactionInFlight(transaction.stage);
  const canRedeem = canRedeemPersonalClaim(personalClaim);
  const status = personalClaim.claim?.status;
  const safeError = safeRedemptionError(transaction);
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
    <section className="space-y-4" aria-label="申請者の引換">
      <Card className="border-foreground bg-card shadow-[8px_8px_0_#d6c9af]">
        <CardHeader className="border-b border-border/70 pb-4">
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
            Applicant redemption
          </p>
          <CardTitle className="text-2xl">資格を一回だけ引換</CardTitle>
          <CardDescription>
            引換は固定給付の資格記録です。資産送付や支払いは行いません。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="rounded-lg border border-border bg-muted/60 px-3 py-3 text-sm">
            <p className="font-bold text-foreground">この端末の申請状態</p>
            <p className="mt-1 text-muted-foreground">
              {claimStatusLabel(status)}
              {personalClaim.claim &&
                (personalClaim.claim.hasLocalPayload
                  ? " ・ private payload を確認しました。"
                  : " ・ private payload を確認できません。")}
            </p>
          </div>

          {canRedeem ? (
            <div className="rounded-lg border border-primary/20 bg-primary/8 p-3">
              <p className="text-sm font-bold text-foreground">
                承認済みのため、引換を記録できます。
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                この操作は既存の private payload を witness
                として使います。金額、店舗、レシート、salt
                を再入力・表示しません。
              </p>
              <Button
                type="button"
                className="mt-3"
                disabled={isBusy}
                onClick={() => void redeem()}
              >
                {isBusy && <Loader2 className="animate-spin" />}
                資格を引換済みに記録
              </Button>
            </div>
          ) : (
            <p className="rounded-lg border border-border px-3 py-3 text-xs leading-relaxed text-muted-foreground">
              引換は、承認済みでこの端末に対応する private payload
              がある申請だけで実行できます。
            </p>
          )}

          {hasUnavailablePayload && (
            <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-foreground">
              このブラウザの private payload
              を利用できません。バックアップから復元するまで引換できません。
            </p>
          )}
          {transaction.operation === "redeem" &&
            transaction.stage === "succeeded" && (
              <p className="rounded-lg border border-primary/25 bg-primary/8 px-3 py-2 text-sm text-foreground">
                引換済みの資格記録を確認しました。資産送付や支払いは行いません。
              </p>
            )}
          {walletGateRequested &&
            requiresWalletConnection &&
            !isWalletConnected && (
              <div className="rounded-lg border border-primary/20 bg-primary/8 p-3 text-sm text-foreground">
                <p>引換には Lace Wallet への接続が必要です。</p>
                <Button
                  type="button"
                  className="mt-3"
                  onClick={() => void connectWallet()}
                >
                  Lace Wallet を接続
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
