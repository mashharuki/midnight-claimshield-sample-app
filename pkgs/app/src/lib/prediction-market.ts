import * as CompactJs from "@midnight-ntwrk/compact-js";
import type { ContractAddress } from "@midnight-ntwrk/compact-runtime";
import {
  deployContract,
  findDeployedContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import {
  createInitialPredictionMarketPrivateState,
  PredictionMarket,
  type PredictionMarketPrivateState,
  predictionMarketWitnesses,
} from "contract";
import * as Rx from "rxjs";
import {
  type DeployedPredictionMarketContract,
  floorReward,
  type PredictionMarketContractInstance,
  type PredictionMarketLedgerState,
  PredictionMarketPrivateStateId,
  type PredictionMarketProviders,
  type Team,
  teamPool,
} from "shared";
import { toHex } from "./hex";

const initialPrivateState = createInitialPredictionMarketPrivateState();

// biome-ignore lint/suspicious/noExplicitAny: generated Compact constructor generic is not exposed
const base = CompactJs.CompiledContract.make(
  "prediction-market",
  PredictionMarket.Contract as any,
) as any;
export const predictionMarketContractInstance =
  // biome-ignore lint/suspicious/noExplicitAny: TS6 conditional witness type resolves to never
  (CompactJs.CompiledContract.withWitnesses as any)(
    base,
    predictionMarketWitnesses,
  ) as unknown as PredictionMarketContractInstance;

export const deployPredictionMarket = async (
  providers: PredictionMarketProviders,
): Promise<DeployedPredictionMarketContract> =>
  deployContract(providers, {
    // biome-ignore lint/suspicious/noExplicitAny: SDK requires generated circuit mapping
    compiledContract: predictionMarketContractInstance as any,
    privateStateId: PredictionMarketPrivateStateId,
    initialPrivateState,
    args: [],
  }) as unknown as Promise<DeployedPredictionMarketContract>;

export const joinPredictionMarket = async (
  providers: PredictionMarketProviders,
  contractAddress: string,
): Promise<DeployedPredictionMarketContract> =>
  findDeployedContract(providers, {
    // biome-ignore lint/suspicious/noExplicitAny: SDK requires generated circuit mapping
    compiledContract: predictionMarketContractInstance as any,
    contractAddress: contractAddress as ContractAddress,
    privateStateId: PredictionMarketPrivateStateId,
    initialPrivateState,
  }) as unknown as Promise<DeployedPredictionMarketContract>;

export const savePrediction = async (
  providers: PredictionMarketProviders,
  team: Team,
  stake: bigint,
): Promise<void> => {
  const current =
    (await providers.privateStateProvider.get(
      PredictionMarketPrivateStateId,
    )) ?? initialPrivateState;
  const salt = current.salt ?? crypto.getRandomValues(new Uint8Array(32));
  const next: PredictionMarketPrivateState = {
    ...current,
    selectedTeam: team,
    stake,
    salt,
  };
  await providers.privateStateProvider.set(
    PredictionMarketPrivateStateId,
    next,
  );
};

export const getPredictionIdentity = async (
  providers: PredictionMarketProviders,
): Promise<{
  publicKeyHex: string;
  privateState: PredictionMarketPrivateState;
}> => {
  const privateState =
    (await providers.privateStateProvider.get(
      PredictionMarketPrivateStateId,
    )) ?? initialPrivateState;
  return {
    publicKeyHex: toHex(
      PredictionMarket.pureCircuits.derive_participant_key(
        privateState.secretKey,
      ),
    ),
    privateState,
  };
};

const call = async (
  contract: DeployedPredictionMarketContract,
  circuit: string,
  ...args: unknown[]
): Promise<void> => {
  // biome-ignore lint/suspicious/noExplicitAny: callTx keys are generated dynamically
  await (contract as any).callTx[circuit](...args);
};

export const commitPrediction = (
  contract: DeployedPredictionMarketContract,
  stake: bigint,
) => call(contract, "commit_prediction", stake);
export const revealPrediction = (contract: DeployedPredictionMarketContract) =>
  call(contract, "reveal_prediction");
export const closePredictions = (contract: DeployedPredictionMarketContract) =>
  call(contract, "close_predictions");
export const closeReveal = (contract: DeployedPredictionMarketContract) =>
  call(contract, "close_reveal");
export const resolveMarket = (
  contract: DeployedPredictionMarketContract,
  winner: Team,
) => call(contract, "resolve_market", winner);
export const claimReward = async (
  contract: DeployedPredictionMarketContract,
  state: PredictionMarketLedgerState,
  stake: bigint,
): Promise<void> => {
  const reward = floorReward(
    state.total_pool,
    stake,
    teamPool(state, state.winning_team),
  );
  await call(contract, "claim_reward", reward);
};

export const subscribeToPredictionMarket = (
  providers: PredictionMarketProviders,
  contractAddress: ContractAddress,
): Rx.Observable<PredictionMarketLedgerState> => {
  return providers.publicDataProvider
    .contractStateObservable(contractAddress, { type: "latest" })
    .pipe(
      Rx.map(
        (state) =>
          // biome-ignore lint/suspicious/noExplicitAny: generated ledger accepts runtime state union
          PredictionMarket.ledger(
            state.data as any,
          ) as unknown as PredictionMarketLedgerState,
      ),
    );
};
