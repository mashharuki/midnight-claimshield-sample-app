import { Loader2 } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
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

function claimStatusLabel(status: ClaimStatus): string {
  switch (status) {
    case ClaimStatus.submitted:
      return "提出済み";
    case ClaimStatus.approved:
      return "承認済み";
    case ClaimStatus.rejected:
      return "取消済み";
    case ClaimStatus.redeemed:
      return "引換済み";
    default:
      return "未提出";
  }
}

function safeSubmitErrorMessage(
  error: ClaimUiError | null,
  minimumAmount: bigint,
  maximumAmount: bigint,
): string | null {
  if (!error) return null;
  if (error.kind === "input" && error.code === "amountOutOfRange") {
    return `支出額は ${minimumAmount.toLocaleString("ja-JP")}〜${maximumAmount.toLocaleString("ja-JP")} の範囲で入力してください。`;
  }
  if (error.kind === "input" && error.code === "missingReceipt") {
    return "ランダムなレシート識別子を確認して再試行してください。";
  }
  if (error.kind === "business" && error.code === "duplicateReceipt") {
    return "この policy では、そのレシート識別子はすでに使用されています。";
  }
  if (error.kind === "business" && error.code === "policyClosed") {
    return "この policy はオンチェーンで受付終了です。";
  }
  if (error.kind === "wallet") {
    return "Lace Wallet と選択中のネットワークを確認して再試行してください。";
  }
  return "秘密の入力値を表示せずに処理できませんでした。安全に再試行できます。";
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
  const [draft, setDraft] = useState<PrivateClaimDraft>(emptyPrivateClaimDraft);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [walletGateRequested, setWalletGateRequested] = useState(false);
  const errors = useMemo(
    () => validatePrivateClaimDraft(draft, minimumAmount, maximumAmount),
    [draft, maximumAmount, minimumAmount],
  );
  const isBusy = isClaimTransactionInFlight(transaction.stage);
  const hasExistingClaim = personalClaim.claim !== null;
  const safeError =
    transaction.operation === "submit"
      ? safeSubmitErrorMessage(transaction.error, minimumAmount, maximumAmount)
      : null;

  const updateDraft = (field: keyof PrivateClaimDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    if (!policyIsOpen || hasExistingClaim) return;

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
    <section className="space-y-4" aria-label="秘密申請">
      <Card className="border-foreground bg-card shadow-[8px_8px_0_#d6c9af]">
        <CardHeader className="border-b border-border/70 pb-4">
          <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
            Private claim
          </p>
          <CardTitle className="text-2xl">秘密の申請を作成</CardTitle>
          <CardDescription>
            入力値は公開画面にも公開 ledger にも表示されません。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="rounded-lg border border-primary/20 bg-primary/8 px-3 py-3 text-xs leading-relaxed text-foreground">
            <p className="font-bold">送信前に理解すること</p>
            <p className="mt-1">
              公開されるのは policy 条件、疑似
              ID、申請状態、commitment、nullifier、件数と集計です。支出額、店舗名、レシート識別子、実ウォレットアドレスは公開しません。
            </p>
            <p className="mt-1">
              入力原文ではなく、引換に必要な額・digest・salt がこのブラウザの
              private state に保存されます。秘密 payload
              を失うと、詳細確認や引換にはバックアップからの復元が必要です。
            </p>
          </div>

          {hasExistingClaim ? (
            <div className="rounded-lg border border-border bg-muted/60 px-3 py-3 text-sm">
              <p className="font-bold text-foreground">この端末の申請状態</p>
              <p className="mt-1 text-muted-foreground">
                {claimStatusLabel(personalClaim.claim.status)} ・
                {personalClaim.claim.hasLocalPayload
                  ? "このブラウザには private payload があります。"
                  : "private payload を確認できません。"}
              </p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit} noValidate>
              <PrivateField
                inputId="claim-amount"
                label={`支出額（${minimumAmount.toLocaleString("ja-JP")}〜${maximumAmount.toLocaleString("ja-JP")}）`}
                error={hasSubmitted ? errors.amount : undefined}
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
                  placeholder="例: 720"
                />
              </PrivateField>
              <PrivateField
                inputId="claim-merchant"
                label="店舗名（ローカルで digest 化）"
                error={hasSubmitted ? errors.merchant : undefined}
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
                  placeholder="例: Sora Coffee"
                />
              </PrivateField>
              <PrivateField
                inputId="claim-receipt-identifier"
                label="ランダムなレシート識別子（ローカルで digest 化）"
                error={hasSubmitted ? errors.receiptIdentifier : undefined}
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
                  placeholder="32 bytes 以上のランダムな識別子"
                />
              </PrivateField>

              <p className="rounded-lg border border-accent/25 bg-accent/7 px-3 py-2 text-xs leading-relaxed text-foreground">
                レシート画像や一般的な短い番号は入力しないでください。同一
                policy
                内での重複防止には、発行済みのランダムな識別子を同じ値で再利用します。
              </p>

              {!policyIsOpen && (
                <p className="text-sm text-destructive">
                  この policy
                  はオンチェーンで受付終了です。新しい申請は送信できません。
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto"
                disabled={!policyIsOpen || isBusy}
              >
                {isBusy && <Loader2 className="animate-spin" />}
                {isWalletConnected
                  ? "秘密申請を送信"
                  : "接続して秘密申請を送信"}
              </Button>
            </form>
          )}

          {walletGateRequested &&
            requiresWalletConnection &&
            !isWalletConnected && (
              <div className="rounded-lg border border-primary/20 bg-primary/8 p-3 text-sm text-foreground">
                <p>
                  申請には Lace Wallet
                  への接続が必要です。接続後、秘密申請をもう一度実行してください。
                </p>
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
          {personalClaim.recoveryError && (
            <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-foreground">
              このブラウザの private payload
              を利用できません。詳細確認や引換には、利用者自身のバックアップからの復元が必要です。
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card/85">
        <CardContent className="space-y-2 pt-4 text-xs leading-relaxed text-muted-foreground">
          <p className="font-bold text-foreground">送信後の公開性と限界</p>
          <p>
            公開上の申請識別子は、この policy 内で操作を関連付けられる疑似 ID
            です。完全な匿名性、本人性、Sybil 耐性を保証するものではありません。
          </p>
          <p>
            送信が失敗した場合、入力値はこの form
            内に残り、安全に再試行できます。成功後は form
            の入力原文を消去します。
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
