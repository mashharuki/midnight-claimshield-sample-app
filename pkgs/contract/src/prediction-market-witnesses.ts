export const PredictionMarketPrivateStateId =
  "predictionMarketPrivateState" as const;

export type PredictionMarketPrivateState = {
  readonly secretKey: Uint8Array;
  readonly selectedTeam: number | null;
  readonly stake: bigint | null;
  readonly salt: Uint8Array | null;
};

type WebCrypto = { getRandomValues<T extends Uint8Array>(array: T): T };
const webCrypto = (globalThis as unknown as { crypto: WebCrypto }).crypto;

export const createInitialPredictionMarketPrivateState = (
  secretKey = webCrypto.getRandomValues(new Uint8Array(32)),
): PredictionMarketPrivateState => ({
  secretKey,
  selectedTeam: null,
  stake: null,
  salt: null,
});

type WitnessContext = { readonly privateState: PredictionMarketPrivateState };

export const predictionMarketWitnesses = {
  local_secret_key: (
    context: WitnessContext,
  ): [PredictionMarketPrivateState, Uint8Array] => [
    context.privateState,
    context.privateState.secretKey,
  ],
  get_selected_team: (
    context: WitnessContext,
  ): [PredictionMarketPrivateState, number] => {
    if (context.privateState.selectedTeam === null) {
      throw new Error("Prediction team is not available in private state");
    }
    return [context.privateState, context.privateState.selectedTeam];
  },
  get_prediction_salt: (
    context: WitnessContext,
  ): [PredictionMarketPrivateState, Uint8Array] => {
    if (context.privateState.salt === null) {
      throw new Error("Prediction salt is not available in private state");
    }
    return [context.privateState, context.privateState.salt];
  },
  store_prediction: (
    context: WitnessContext,
    team: number,
    stake: bigint,
    salt: Uint8Array,
  ): [PredictionMarketPrivateState, []] => [
    { ...context.privateState, selectedTeam: team, stake, salt },
    [],
  ],
};
