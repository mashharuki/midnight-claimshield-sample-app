import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type ClaimShieldPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createInitialClaimShieldPrivateState = (
  secretKey = new Uint8Array(32),
): ClaimShieldPrivateState => ({ secretKey });

type ClaimShieldWitnessContext = WitnessContext<
  unknown,
  ClaimShieldPrivateState
>;

export const claimShieldWitnesses = {
  local_secret_key: (
    context: ClaimShieldWitnessContext,
  ): [ClaimShieldPrivateState, Uint8Array] => [
    context.privateState,
    context.privateState.secretKey,
  ],
};
