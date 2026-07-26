import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type ClaimShieldClaimPayload = {
  readonly amount: bigint;
  readonly merchantDigest: Uint8Array;
  readonly evidenceDigest: Uint8Array;
  readonly opaqueReceiptIdentifier: Uint8Array;
  readonly salt: Uint8Array;
};

export type ClaimShieldPrivateState = {
  readonly secretKey: Uint8Array;
  readonly claim: ClaimShieldClaimPayload | null;
};

export const createInitialClaimShieldPrivateState = (
  secretKey = new Uint8Array(32),
): ClaimShieldPrivateState => ({ secretKey, claim: null });

type ClaimShieldWitnessContext = WitnessContext<
  unknown,
  ClaimShieldPrivateState
>;

const requireClaimPayload = (
  context: ClaimShieldWitnessContext,
): ClaimShieldClaimPayload => {
  if (context.privateState.claim === null) {
    throw new Error("Claim private payload is unavailable");
  }

  return context.privateState.claim;
};

export const claimShieldWitnesses = {
  local_secret_key: (
    context: ClaimShieldWitnessContext,
  ): [ClaimShieldPrivateState, Uint8Array] => [
    context.privateState,
    context.privateState.secretKey,
  ],
  get_claim_amount: (
    context: ClaimShieldWitnessContext,
  ): [ClaimShieldPrivateState, bigint] => [
    context.privateState,
    requireClaimPayload(context).amount,
  ],
  get_merchant_digest: (
    context: ClaimShieldWitnessContext,
  ): [ClaimShieldPrivateState, Uint8Array] => [
    context.privateState,
    requireClaimPayload(context).merchantDigest,
  ],
  get_evidence_digest: (
    context: ClaimShieldWitnessContext,
  ): [ClaimShieldPrivateState, Uint8Array] => [
    context.privateState,
    requireClaimPayload(context).evidenceDigest,
  ],
  get_opaque_receipt_identifier: (
    context: ClaimShieldWitnessContext,
  ): [ClaimShieldPrivateState, Uint8Array] => [
    context.privateState,
    requireClaimPayload(context).opaqueReceiptIdentifier,
  ],
  get_claim_salt: (
    context: ClaimShieldWitnessContext,
  ): [ClaimShieldPrivateState, Uint8Array] => [
    context.privateState,
    requireClaimPayload(context).salt,
  ],
  store_claim: (
    context: ClaimShieldWitnessContext,
    amount: bigint,
    merchantDigest: Uint8Array,
    evidenceDigest: Uint8Array,
    opaqueReceiptIdentifier: Uint8Array,
    salt: Uint8Array,
  ): [ClaimShieldPrivateState, []] => [
    {
      ...context.privateState,
      claim: {
        amount,
        merchantDigest: new Uint8Array(merchantDigest),
        evidenceDigest: new Uint8Array(evidenceDigest),
        opaqueReceiptIdentifier: new Uint8Array(opaqueReceiptIdentifier),
        salt: new Uint8Array(salt),
      },
    },
    [],
  ],
};
