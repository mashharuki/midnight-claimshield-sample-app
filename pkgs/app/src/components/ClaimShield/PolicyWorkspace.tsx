import { Loader2 } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type ClaimShieldLedgerState,
  isClaimTransactionInFlight,
  type PolicyInput,
  PolicyState,
} from "shared";
import {
  AdministratorReview,
  publicClaimsForReview,
} from "@/components/ClaimShield/AdministratorReview";
import { ClaimRedemption } from "@/components/ClaimShield/ClaimRedemption";
import { PrivateClaimSubmission } from "@/components/ClaimShield/PrivateClaimSubmission";
import { LanguageToggle } from "@/components/LanguageToggle";
import { NetworkToggle } from "@/components/NetworkToggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useNetwork } from "@/contexts/useNetwork";
import { useClaimShield } from "@/hooks/useClaimShield";
import { NETWORKS } from "@/utils/networks";

const MAX_POLICY_TEXT_BYTES = 32;
const UINT64_MAX = (1n << 64n) - 1n;

export type PolicyDraft = Readonly<{
  label: string;
  category: string;
  startAt: string;
  endAt: string;
  minimumAmount: string;
  maximumAmount: string;
  fixedBenefit: string;
}>;

export type PolicyDraftErrors = Partial<Record<keyof PolicyDraft, string>>;

export type PublicPolicyView = Readonly<{
  label: string;
  category: string;
  startAt: bigint;
  endAt: bigint;
  minimumAmount: bigint;
  maximumAmount: bigint;
  fixedBenefit: bigint;
  submittedCount: bigint;
  approvedCount: bigint;
  plannedBenefitTotal: bigint;
  isOpen: boolean;
}>;

const emptyDraft: PolicyDraft = {
  label: "",
  category: "",
  startAt: "",
  endAt: "",
  minimumAmount: "",
  maximumAmount: "",
  fixedBenefit: "",
};

const inputClassName =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-3 focus:ring-primary/15";

const fieldLabelClassName =
  "mb-1.5 block text-xs font-bold tracking-wide text-foreground";

function textByteLength(value: string): number {
  return new TextEncoder().encode(value.trim()).length;
}

function parseDateTime(value: string): bigint | null {
  if (!value) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return BigInt(Math.floor(milliseconds / 1_000));
}

function parseUnsignedInteger(value: string): bigint | null {
  if (!/^[0-9]+$/.test(value)) return null;
  try {
    const parsed = BigInt(value);
    return parsed <= UINT64_MAX ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Validates only local, deterministic form rules. The Compact constructor is
 * still authoritative and repeats these checks before the policy is created.
 */
export function validatePolicyDraft(draft: PolicyDraft): PolicyDraftErrors {
  const errors: PolicyDraftErrors = {};
  const labelSize = textByteLength(draft.label);
  const categorySize = textByteLength(draft.category);
  const startAt = parseDateTime(draft.startAt);
  const endAt = parseDateTime(draft.endAt);
  const minimumAmount = parseUnsignedInteger(draft.minimumAmount);
  const maximumAmount = parseUnsignedInteger(draft.maximumAmount);
  const fixedBenefit = parseUnsignedInteger(draft.fixedBenefit);

  if (labelSize === 0 || labelSize > MAX_POLICY_TEXT_BYTES) {
    errors.label = "名称は UTF-8 で 1〜32 bytes にしてください。";
  }
  if (categorySize === 0 || categorySize > MAX_POLICY_TEXT_BYTES) {
    errors.category = "カテゴリは UTF-8 で 1〜32 bytes にしてください。";
  }
  if (startAt === null) errors.startAt = "開始日時を入力してください。";
  if (endAt === null) errors.endAt = "終了日時を入力してください。";
  if (startAt !== null && endAt !== null && startAt >= endAt) {
    errors.startAt = "開始日時は終了日時より前にしてください。";
    errors.endAt = "終了日時は開始日時より後にしてください。";
  }
  if (minimumAmount === null) {
    errors.minimumAmount = "0 以上の整数を入力してください。";
  }
  if (maximumAmount === null) {
    errors.maximumAmount = "0 以上の整数を入力してください。";
  }
  if (
    minimumAmount !== null &&
    maximumAmount !== null &&
    minimumAmount > maximumAmount
  ) {
    errors.minimumAmount = "下限は上限以下にしてください。";
    errors.maximumAmount = "上限は下限以上にしてください。";
  }
  if (fixedBenefit === null || fixedBenefit === 0n) {
    errors.fixedBenefit = "固定給付額は 1 以上にしてください。";
  }
  return errors;
}

export function isPolicyDraftDeployable(draft: PolicyDraft): boolean {
  return Object.keys(validatePolicyDraft(draft)).length === 0;
}

function localizePolicyDraftError(
  error: string | undefined,
  t: ReturnType<typeof useTranslation>["t"],
): string | undefined {
  const key = {
    "名称は UTF-8 で 1〜32 bytes にしてください。": "label",
    "カテゴリは UTF-8 で 1〜32 bytes にしてください。": "category",
    "開始日時を入力してください。": "startRequired",
    "終了日時を入力してください。": "endRequired",
    "開始日時は終了日時より前にしてください。": "startBeforeEnd",
    "終了日時は開始日時より後にしてください。": "endAfterStart",
    "0 以上の整数を入力してください。": "nonNegative",
    "下限は上限以下にしてください。": "minimum",
    "上限は下限以上にしてください。": "maximum",
    "固定給付額は 1 以上にしてください。": "benefit",
  }[error ?? ""];
  return key
    ? (t(`claimShield.policy.validation.${key}` as never) as string)
    : error;
}

export function policyInputFromDraft(draft: PolicyDraft): PolicyInput {
  if (!isPolicyDraftDeployable(draft)) {
    throw new Error("Policy draft must be validated before conversion.");
  }
  return {
    label: draft.label.trim(),
    category: draft.category.trim(),
    startAt: parseDateTime(draft.startAt) as bigint,
    endAt: parseDateTime(draft.endAt) as bigint,
    minimumAmount: parseUnsignedInteger(draft.minimumAmount) as bigint,
    maximumAmount: parseUnsignedInteger(draft.maximumAmount) as bigint,
    fixedBenefit: parseUnsignedInteger(draft.fixedBenefit) as bigint,
  };
}

/**
 * The form event delegates here so the deploy boundary has a direct test:
 * invalid input never reaches the SDK operation.
 */
export async function submitPolicyDraft({
  draft,
  isBusy,
  deployPolicy,
}: {
  draft: PolicyDraft;
  isBusy: boolean;
  deployPolicy: (input: PolicyInput) => Promise<unknown>;
}): Promise<boolean> {
  if (!isPolicyDraftDeployable(draft) || isBusy) return false;
  await deployPolicy(policyInputFromDraft(draft));
  return true;
}

/** Device time is advisory only; it must not be used to permit a write. */
export function policyTimingAdvisory(
  startAt: bigint,
  endAt: bigint,
  now: number = Date.now(),
): string | null {
  const currentSeconds = BigInt(Math.floor(now / 1_000));
  if (currentSeconds < startAt) {
    return "この端末の時刻では、表示中の受付開始前です。";
  }
  if (currentSeconds >= endAt) {
    return "この端末の時刻では、表示中の受付期間が終了しています。";
  }
  return null;
}

/** Only the public on-chain state determines whether a policy is open. */
export function policyStateIsOpen(policyState: number): boolean {
  return policyState === PolicyState.open;
}

function decodePolicyText(value: Uint8Array): string {
  const zeroIndex = value.indexOf(0);
  return new TextDecoder().decode(
    zeroIndex === -1 ? value : value.subarray(0, zeroIndex),
  );
}

/** Drops every ledger field except the policy's explicitly public projection. */
export function toPublicPolicyView(
  ledger: ClaimShieldLedgerState,
): PublicPolicyView {
  return {
    label: decodePolicyText(ledger.policyLabel),
    category: decodePolicyText(ledger.policyCategory),
    startAt: ledger.startAt,
    endAt: ledger.endAt,
    minimumAmount: ledger.minimumAmount,
    maximumAmount: ledger.maximumAmount,
    fixedBenefit: ledger.fixedBenefit,
    submittedCount: ledger.submittedCount,
    approvedCount: ledger.approvedCount,
    plannedBenefitTotal: ledger.plannedBenefitTotal,
    isOpen: policyStateIsOpen(ledger.policyState),
  };
}

function formatDateTime(value: bigint, locale: string = "ja-JP"): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(Number(value) * 1_000));
}

function formatAmount(value: bigint, locale: string = "ja-JP"): string {
  return new Intl.NumberFormat(locale).format(value);
}

function Field({
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
    <div className="block">
      <label className={fieldLabelClassName} htmlFor={inputId}>
        {label}
      </label>
      {children}
      {error && (
        <span className="mt-1 block text-xs leading-relaxed text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

export function TransactionProgress({
  operation,
  stage,
  error,
}: {
  operation: ReturnType<typeof useClaimShield>["transaction"]["operation"];
  stage: ReturnType<typeof useClaimShield>["transaction"]["stage"];
  error: ReturnType<typeof useClaimShield>["transaction"]["error"];
}) {
  const { t } = useTranslation();
  if (stage === "idle") return null;
  const messages = {
    preparing: t("claimShield.transaction.preparing"),
    proving: t("claimShield.transaction.proving"),
    awaitingSignature: t("claimShield.transaction.awaitingSignature"),
    submitting: t("claimShield.transaction.submitting"),
    confirming: t("claimShield.transaction.confirming"),
    succeeded: t("claimShield.transaction.succeeded"),
    failed: t("claimShield.transaction.failed"),
    idle: "",
  } as const;
  const isBusy = isClaimTransactionInFlight(stage);
  const message = (() => {
    if (operation === "submit") {
      return {
        ...messages,
        confirming: t("claimShield.transaction.submitConfirming"),
        succeeded: t("claimShield.transaction.submitSucceeded"),
      }[stage];
    }
    if (operation === "close") {
      return {
        ...messages,
        confirming: t("claimShield.transaction.closeConfirming"),
        succeeded: t("claimShield.transaction.closeSucceeded"),
      }[stage];
    }
    if (operation === "review") {
      return {
        ...messages,
        confirming: t("claimShield.transaction.reviewConfirming"),
        succeeded: t("claimShield.transaction.reviewSucceeded"),
      }[stage];
    }
    if (operation === "redeem") {
      return {
        ...messages,
        confirming: t("claimShield.transaction.redeemConfirming"),
        succeeded: t("claimShield.transaction.redeemSucceeded"),
      }[stage];
    }
    return messages[stage];
  })();

  return (
    <div
      className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
        stage === "failed"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-primary/20 bg-primary/8 text-primary"
      }`}
      role="status"
      aria-live="polite"
    >
      {isBusy && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />}
      <span>
        {message}
        {error && t("claimShield.transaction.retry")}
      </span>
    </div>
  );
}

export function PublicPolicyDashboard({
  policy,
  contractAddress,
}: {
  policy: PublicPolicyView;
  contractAddress: string;
}) {
  const { t, i18n } = useTranslation();
  const advisory = policyTimingAdvisory(policy.startAt, policy.endAt);
  const statistics = [
    [
      t("claimShield.policy.submittedCount"),
      formatAmount(policy.submittedCount, i18n.language),
    ],
    [
      t("claimShield.policy.approvedCount"),
      formatAmount(policy.approvedCount, i18n.language),
    ],
    [
      t("claimShield.policy.plannedBenefitTotal"),
      formatAmount(policy.plannedBenefitTotal, i18n.language),
    ],
  ] as const;

  return (
    <section
      id="policy"
      className="space-y-4"
      aria-label={t("claimShield.policy.ariaLabel")}
    >
      <Card className="border-primary/20 bg-card shadow-[8px_8px_0_#d6c9af]">
        <CardHeader className="gap-3 border-b border-border/70 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
                {t("claimShield.policy.publicPolicy")}
              </p>
              <CardTitle className="mt-1 text-2xl font-bold">
                {policy.label}
              </CardTitle>
              <CardDescription className="mt-1">
                {policy.category}
              </CardDescription>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                policy.isOpen
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {policy.isOpen
                ? t("claimShield.policy.open")
                : t("claimShield.policy.closed")}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">
                {t("claimShield.policy.contractAddress")}
              </dt>
              <dd className="mt-1 break-all rounded-md bg-muted px-2 py-1 font-mono text-xs">
                {contractAddress}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("claimShield.policy.intakePeriod")}
              </dt>
              <dd className="mt-1 font-medium">
                {formatDateTime(policy.startAt, i18n.language)} 〜{" "}
                {formatDateTime(policy.endAt, i18n.language)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("claimShield.policy.amountRange")}
              </dt>
              <dd className="mt-1 font-medium">
                {formatAmount(policy.minimumAmount, i18n.language)} 〜{" "}
                {formatAmount(policy.maximumAmount, i18n.language)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("claimShield.policy.fixedBenefit")}
              </dt>
              <dd className="mt-1 font-medium">
                {formatAmount(policy.fixedBenefit, i18n.language)}
              </dd>
            </div>
          </dl>

          {advisory && (
            <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs leading-relaxed text-foreground">
              {i18n.language === "en" && advisory
                ? policy.startAt > BigInt(Math.floor(Date.now() / 1_000))
                  ? t("claimShield.policy.beforeStart")
                  : t("claimShield.policy.afterEnd")
                : advisory}{" "}
              {t("claimShield.policy.advisorySuffix")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {statistics.map(([label, value]) => (
          <Card key={label} size="sm" className="border-border/80 bg-card/80">
            <CardContent className="pt-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-mono text-xl font-bold text-primary">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {t("claimShield.policy.publicBoundary")}
      </p>
    </section>
  );
}

export function PolicyWorkspace() {
  const { t } = useTranslation();
  const { networkId } = useNetwork();
  const {
    isWalletConnected,
    requiresWalletConnection,
    contractAddress,
    ledger,
    personalClaim,
    transaction,
    readError,
    connectWallet,
    deployPolicy,
    joinPolicy,
    submitClaim,
    closePolicy,
    approveClaim,
    rejectClaim,
    redeemClaim,
  } = useClaimShield();
  const [draft, setDraft] = useState<PolicyDraft>(emptyDraft);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [walletGateRequested, setWalletGateRequested] = useState(false);
  const [policyAddress, setPolicyAddress] = useState("");
  const [addressGuidance, setAddressGuidance] = useState<string | null>(null);
  const errors = useMemo(() => validatePolicyDraft(draft), [draft]);
  const isBusy = isClaimTransactionInFlight(transaction.stage);
  const publicPolicy = ledger ? toPublicPolicyView(ledger) : null;
  const publicReviewClaims = ledger ? publicClaimsForReview(ledger.claims) : [];

  const updateDraft = (field: keyof PolicyDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasSubmitted(true);
    const submitted = await submitPolicyDraft({ draft, isBusy, deployPolicy });
    if (submitted) setWalletGateRequested(true);
  };

  const handleOpenPolicy = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!policyAddress.trim()) {
      setAddressGuidance(t("claimShield.policy.addressRequired"));
      return;
    }
    setAddressGuidance(null);
    setWalletGateRequested(true);
    await joinPolicy(policyAddress.trim());
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-5 border-b-2 border-foreground pb-5">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-primary uppercase">
              {t("claimShield.workspace.eyebrow")}
            </p>
            <h1 className="mt-1 font-serif text-4xl leading-none text-foreground sm:text-5xl">
              ClaimShield
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t("claimShield.workspace.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {!isWalletConnected && <NetworkToggle />}
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                {NETWORKS[networkId].label} ・{" "}
                {isWalletConnected
                  ? t("claimShield.workspace.walletConnected")
                  : t("claimShield.workspace.walletRequired")}
              </span>
              <LanguageToggle />
            </div>
          </div>
        </header>

        <nav
          className="mb-6 flex flex-wrap gap-2 text-xs font-semibold"
          aria-label={t("claimShield.navigation.ariaLabel")}
        >
          {[
            ["#policy", t("claimShield.navigation.policy")],
            ["#claim", t("claimShield.navigation.claim")],
            ["#review", t("claimShield.navigation.review")],
            ["#redeem", t("claimShield.navigation.redeem")],
          ].map(([href, label]) => (
            <a
              key={href}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-muted-foreground transition hover:border-primary hover:text-foreground"
              href={href}
            >
              {label}
            </a>
          ))}
        </nav>

        {publicPolicy ? (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.82fr)]">
            <div>
              <PublicPolicyDashboard
                policy={publicPolicy}
                contractAddress={contractAddress ?? ""}
              />
              <TransactionProgress
                operation={transaction.operation}
                stage={transaction.stage}
                error={transaction.error}
              />
              {readError && readError.kind !== "privateState" && (
                <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {t("claimShield.policy.readError")}
                </p>
              )}
            </div>
            <div className="space-y-6">
              <PrivateClaimSubmission
                minimumAmount={publicPolicy.minimumAmount}
                maximumAmount={publicPolicy.maximumAmount}
                policyIsOpen={publicPolicy.isOpen}
                isWalletConnected={isWalletConnected}
                requiresWalletConnection={requiresWalletConnection}
                personalClaim={personalClaim}
                transaction={transaction}
                connectWallet={connectWallet}
                submitClaim={submitClaim}
              />
              <AdministratorReview
                policyIsOpen={publicPolicy.isOpen}
                claims={publicReviewClaims}
                isWalletConnected={isWalletConnected}
                requiresWalletConnection={requiresWalletConnection}
                transaction={transaction}
                connectWallet={connectWallet}
                closePolicy={closePolicy}
                approveClaim={approveClaim}
                rejectClaim={rejectClaim}
              />
              <ClaimRedemption
                personalClaim={personalClaim}
                readError={readError}
                transaction={transaction}
                isWalletConnected={isWalletConnected}
                requiresWalletConnection={requiresWalletConnection}
                connectWallet={connectWallet}
                redeemClaim={redeemClaim}
              />
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
            <Card className="border-foreground bg-card shadow-[8px_8px_0_#d6c9af]">
              <CardHeader className="border-b border-border/70 pb-4">
                <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
                  {t("claimShield.workspace.administratorSetup")}
                </p>
                <CardTitle className="text-2xl">
                  {t("claimShield.policy.createTitle")}
                </CardTitle>
                <CardDescription>
                  {t("claimShield.policy.createDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <form className="space-y-5" onSubmit={handleCreate} noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      inputId="policy-label"
                      label={t("claimShield.policy.label")}
                      error={
                        hasSubmitted
                          ? localizePolicyDraftError(errors.label, t)
                          : undefined
                      }
                    >
                      <input
                        id="policy-label"
                        className={inputClassName}
                        value={draft.label}
                        onChange={(event) =>
                          updateDraft("label", event.target.value)
                        }
                        aria-invalid={Boolean(hasSubmitted && errors.label)}
                        placeholder={t("claimShield.policy.labelPlaceholder")}
                      />
                    </Field>
                    <Field
                      inputId="policy-category"
                      label={t("claimShield.policy.category")}
                      error={
                        hasSubmitted
                          ? localizePolicyDraftError(errors.category, t)
                          : undefined
                      }
                    >
                      <input
                        id="policy-category"
                        className={inputClassName}
                        value={draft.category}
                        onChange={(event) =>
                          updateDraft("category", event.target.value)
                        }
                        aria-invalid={Boolean(hasSubmitted && errors.category)}
                        placeholder={t(
                          "claimShield.policy.categoryPlaceholder",
                        )}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      inputId="policy-start-at"
                      label={t("claimShield.policy.startAt")}
                      error={
                        hasSubmitted
                          ? localizePolicyDraftError(errors.startAt, t)
                          : undefined
                      }
                    >
                      <input
                        id="policy-start-at"
                        className={inputClassName}
                        type="datetime-local"
                        value={draft.startAt}
                        onChange={(event) =>
                          updateDraft("startAt", event.target.value)
                        }
                        aria-invalid={Boolean(hasSubmitted && errors.startAt)}
                      />
                    </Field>
                    <Field
                      inputId="policy-end-at"
                      label={t("claimShield.policy.endAt")}
                      error={
                        hasSubmitted
                          ? localizePolicyDraftError(errors.endAt, t)
                          : undefined
                      }
                    >
                      <input
                        id="policy-end-at"
                        className={inputClassName}
                        type="datetime-local"
                        value={draft.endAt}
                        onChange={(event) =>
                          updateDraft("endAt", event.target.value)
                        }
                        aria-invalid={Boolean(hasSubmitted && errors.endAt)}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field
                      inputId="policy-minimum-amount"
                      label={t("claimShield.policy.minimumAmount")}
                      error={
                        hasSubmitted
                          ? localizePolicyDraftError(errors.minimumAmount, t)
                          : undefined
                      }
                    >
                      <input
                        id="policy-minimum-amount"
                        className={inputClassName}
                        inputMode="numeric"
                        value={draft.minimumAmount}
                        onChange={(event) =>
                          updateDraft("minimumAmount", event.target.value)
                        }
                        aria-invalid={Boolean(
                          hasSubmitted && errors.minimumAmount,
                        )}
                        placeholder="500"
                      />
                    </Field>
                    <Field
                      inputId="policy-maximum-amount"
                      label={t("claimShield.policy.maximumAmount")}
                      error={
                        hasSubmitted
                          ? localizePolicyDraftError(errors.maximumAmount, t)
                          : undefined
                      }
                    >
                      <input
                        id="policy-maximum-amount"
                        className={inputClassName}
                        inputMode="numeric"
                        value={draft.maximumAmount}
                        onChange={(event) =>
                          updateDraft("maximumAmount", event.target.value)
                        }
                        aria-invalid={Boolean(
                          hasSubmitted && errors.maximumAmount,
                        )}
                        placeholder="1500"
                      />
                    </Field>
                    <Field
                      inputId="policy-fixed-benefit"
                      label={t("claimShield.policy.fixedBenefit")}
                      error={
                        hasSubmitted
                          ? localizePolicyDraftError(errors.fixedBenefit, t)
                          : undefined
                      }
                    >
                      <input
                        id="policy-fixed-benefit"
                        className={inputClassName}
                        inputMode="numeric"
                        value={draft.fixedBenefit}
                        onChange={(event) =>
                          updateDraft("fixedBenefit", event.target.value)
                        }
                        aria-invalid={Boolean(
                          hasSubmitted && errors.fixedBenefit,
                        )}
                        placeholder="300"
                      />
                    </Field>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                    {t("claimShield.policy.timingNote")}
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={isBusy}
                  >
                    {isBusy && <Loader2 className="animate-spin" />}
                    {isWalletConnected
                      ? t("claimShield.policy.create")
                      : t("claimShield.policy.connectAndCreate")}
                  </Button>
                </form>
                <TransactionProgress
                  operation={transaction.operation}
                  stage={transaction.stage}
                  error={transaction.error}
                />
                {walletGateRequested &&
                  requiresWalletConnection &&
                  !isWalletConnected && (
                    <div className="mt-4 rounded-lg border border-primary/20 bg-primary/8 p-3 text-sm text-foreground">
                      <p>{t("claimShield.policy.walletRequired")}</p>
                      <Button
                        type="button"
                        className="mt-3"
                        onClick={() => void connectWallet()}
                      >
                        {t("claimShield.policy.connectWallet")}
                      </Button>
                    </div>
                  )}
              </CardContent>
            </Card>

            <aside className="space-y-4">
              <Card className="border-border bg-card/85">
                <CardHeader>
                  <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
                    {t("claimShield.workspace.publicView")}
                  </p>
                  <CardTitle>{t("claimShield.policy.openTitle")}</CardTitle>
                  <CardDescription>
                    {t("claimShield.policy.openDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-3"
                    onSubmit={handleOpenPolicy}
                    noValidate
                  >
                    <Field
                      inputId="policy-contract-address"
                      label={t("claimShield.policy.address")}
                      error={addressGuidance ?? undefined}
                    >
                      <input
                        id="policy-contract-address"
                        className={inputClassName}
                        value={policyAddress}
                        onChange={(event) =>
                          setPolicyAddress(event.target.value)
                        }
                        placeholder="addr_test..."
                        aria-invalid={Boolean(addressGuidance)}
                      />
                    </Field>
                    <Button
                      type="submit"
                      variant="outline"
                      className="w-full"
                      disabled={isBusy}
                    >
                      {t("claimShield.policy.show")}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="border-accent/25 bg-accent/7">
                <CardHeader>
                  <CardTitle className="text-base">
                    {t("claimShield.policy.boundaryTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                  <p>{t("claimShield.policy.boundaryPublic")}</p>
                  <p>{t("claimShield.policy.boundaryPrivate")}</p>
                </CardContent>
              </Card>

              {readError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {t("claimShield.policy.readError")}
                </p>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
