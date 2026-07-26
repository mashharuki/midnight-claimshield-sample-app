import { Loader2 } from "lucide-react";
import { useState } from "react";
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

function claimStatusLabel(status: ClaimStatus): string {
  switch (status) {
    case ClaimStatus.submitted:
      return "未判断";
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

function pseudonymLabel(claimantKey: Uint8Array): string {
  const hex = Array.from(claimantKey, (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  return `claim-${hex.slice(0, 8)}…${hex.slice(-6)}`;
}

function safeAdministrationError(
  transaction: ClaimTransactionState,
): string | null {
  if (transaction.operation !== "close" && transaction.operation !== "review") {
    return null;
  }
  if (transaction.stage !== "failed" || !transaction.error) return null;

  if (transaction.error.kind === "business") {
    return "公開状態が更新されている可能性があります。最新の policy と申請状態を確認してください。";
  }
  if (transaction.error.kind === "wallet") {
    return "Lace Wallet の接続または署名を確認して、もう一度実行してください。";
  }
  return "管理操作を記録できませんでした。秘密の審査情報を表示せずに安全に再試行できます。";
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
            公開状態: {claimStatusLabel(claim.status)}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            reviewable
              ? "bg-accent/20 text-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {reviewable ? "審査待ち" : "判断済み"}
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
              承認を記録
            </Button>
          </div>
          <div className="border-l-2 border-accent/50 pl-3">
            <label
              className="mb-1.5 block text-xs font-bold tracking-wide text-foreground"
              htmlFor={`review-reason-${pseudonymLabel(claim.claimantKey)}`}
            >
              dApp 外で保管する取消理由
            </label>
            <input
              id={`review-reason-${pseudonymLabel(claim.claimantKey)}`}
              className={reviewInputClassName}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              autoComplete="off"
              placeholder="取消を記録する前に理由を入力"
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
                取消を記録
              </Button>
              {!reason.trim() && (
                <span className="text-xs text-muted-foreground">
                  理由を入力するまで取消は開始できません。
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          判断済みの申請は再度の承認・取消を実行できません。
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
  const [walletGateRequested, setWalletGateRequested] = useState(false);
  const isBusy = isClaimTransactionInFlight(transaction.stage);
  const safeError = safeAdministrationError(transaction);

  const close = async () => {
    setWalletGateRequested(true);
    await submitPolicyClosure({ policyIsOpen, isBusy, closePolicy });
  };

  return (
    <section
      id="review"
      className="space-y-4"
      aria-label="管理者の受付終了と審査"
    >
      <Card className="border-foreground bg-card shadow-[8px_8px_0_#d6c9af]">
        <CardHeader className="border-b border-border/70 pb-4">
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
            Administrator review
          </p>
          <CardTitle className="text-2xl">受付終了と審査記録</CardTitle>
          <CardDescription>
            policy 管理者だけが、受付状態と submitted claim
            の状態を記録できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="rounded-lg border border-accent/30 bg-accent/8 px-3 py-3 text-xs leading-relaxed text-foreground">
            <p className="font-bold">審査資料は dApp 外で確認します。</p>
            <p className="mt-1">
              この画面には疑似申請 ID
              と公開状態だけを表示します。支出額、店舗、レシート、実ウォレットアドレス、秘密値は表示しません。
            </p>
            <p className="mt-1">
              取消理由は ClaimShield へ送信・保存しません。組織の定めた安全な
              dApp 外の経路で保管・連絡してください。
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/60 p-3">
            <p className="text-sm font-bold text-foreground">新規申請の受付</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              受付終了後も、すでに submitted の申請は審査でき、approved
              の申請は引換できます。
            </p>
            <Button
              type="button"
              className="mt-3"
              variant="outline"
              disabled={!policyIsOpen || isBusy}
              onClick={() => void close()}
            >
              {isBusy && <Loader2 className="animate-spin" />}
              {policyIsOpen ? "受付を終了して記録" : "受付は終了済み"}
            </Button>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold text-foreground">
                公開申請の審査
              </p>
              <span className="text-xs text-muted-foreground">
                {claims.length} public claim{claims.length === 1 ? "" : "s"}
              </span>
            </div>
            {claims.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                審査対象の公開申請はまだありません。
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
                <p>管理操作には Lace Wallet への接続が必要です。</p>
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
