import type { ClaimInput } from "shared";

const UINT64_MAX = (1n << 64n) - 1n;
const MIN_RECEIPT_IDENTIFIER_BYTES = 32;

export type PrivateClaimDraft = Readonly<{
  amount: string;
  merchant: string;
  receiptIdentifier: string;
}>;

export type PrivateClaimDraftErrors = Partial<
  Record<keyof PrivateClaimDraft, string>
>;

const normalizedPrivateText = (value: string): string =>
  value.trim().normalize("NFKC");

const parseAmount = (value: string): bigint | null => {
  if (!/^[0-9]+$/.test(value)) return null;
  try {
    const amount = BigInt(value);
    return amount <= UINT64_MAX ? amount : null;
  } catch {
    return null;
  }
};

const receiptIdentifierByteLength = (value: string): number =>
  new TextEncoder().encode(normalizedPrivateText(value)).length;

const digestPrivateText = async (
  domain: string,
  value: string,
): Promise<Uint8Array<ArrayBuffer>> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Private claim digest is unavailable.");
  }
  const payload = new TextEncoder().encode(
    `${domain}\0${normalizedPrivateText(value)}`,
  );
  return new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", payload),
  );
};

/** Validates only browser-local input; Compact repeats the amount proof check. */
export function validatePrivateClaimDraft(
  draft: PrivateClaimDraft,
  minimumAmount: bigint,
  maximumAmount: bigint,
): PrivateClaimDraftErrors {
  const errors: PrivateClaimDraftErrors = {};
  const amount = parseAmount(draft.amount);

  if (amount === null || amount < minimumAmount || amount > maximumAmount) {
    errors.amount = `支出額は ${minimumAmount.toLocaleString("ja-JP")}〜${maximumAmount.toLocaleString("ja-JP")} の範囲で入力してください。`;
  }
  if (normalizedPrivateText(draft.merchant).length === 0) {
    errors.merchant = "店舗名を入力してください。";
  }
  if (
    receiptIdentifierByteLength(draft.receiptIdentifier) <
    MIN_RECEIPT_IDENTIFIER_BYTES
  ) {
    errors.receiptIdentifier =
      "ランダムなレシート識別子を UTF-8 で 32 bytes 以上入力してください。";
  }
  return errors;
}

/**
 * Reduces raw browser input to the exact witness input accepted by the SDK.
 * Merchant and receipt use independent domains; their digest values are never
 * rendered by the UI or copied to the public ledger.
 */
export async function createPrivateClaimInput(
  draft: PrivateClaimDraft,
): Promise<ClaimInput> {
  const amount = parseAmount(draft.amount);
  if (
    amount === null ||
    normalizedPrivateText(draft.merchant).length === 0 ||
    receiptIdentifierByteLength(draft.receiptIdentifier) <
      MIN_RECEIPT_IDENTIFIER_BYTES
  ) {
    throw new Error("Private claim form is invalid.");
  }

  const [merchantDigest, evidenceDigest, opaqueReceiptIdentifier] =
    await Promise.all([
      digestPrivateText("claimshield:merchant:v1", draft.merchant),
      digestPrivateText("claimshield:evidence:v1", draft.receiptIdentifier),
      digestPrivateText("claimshield:receipt:v1", draft.receiptIdentifier),
    ]);

  return {
    amount,
    merchantDigest,
    evidenceDigest,
    opaqueReceiptIdentifier,
  };
}

/** The form event calls this guard before a private input crosses to the hook. */
export async function submitPrivateClaimDraft({
  draft,
  minimumAmount,
  maximumAmount,
  isBusy,
  submitClaim,
}: {
  draft: PrivateClaimDraft;
  minimumAmount: bigint;
  maximumAmount: bigint;
  isBusy: boolean;
  submitClaim: (input: ClaimInput) => Promise<unknown>;
}): Promise<boolean> {
  if (
    isBusy ||
    Object.keys(validatePrivateClaimDraft(draft, minimumAmount, maximumAmount))
      .length > 0
  ) {
    return false;
  }
  await submitClaim(await createPrivateClaimInput(draft));
  return true;
}
