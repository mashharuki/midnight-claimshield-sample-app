import type { CompiledContract } from "@midnight-ntwrk/compact-js";
import type {
  DeployedContract,
  FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import type {
  AnyProvableCircuitId,
  MidnightProviders,
} from "@midnight-ntwrk/midnight-js-types";
import {
  type PredictionMarketPrivateState,
  PredictionMarketPrivateStateId,
} from "contract";

export { PredictionMarketPrivateStateId };

export const Team = {
  amber_foxes: 0,
  cedar_owls: 1,
  harbor_whales: 2,
  meadow_bears: 3,
} as const;
export type Team = (typeof Team)[keyof typeof Team];
export const TEAM_KEYS = Object.keys(Team) as readonly (keyof typeof Team)[];

export const MarketPhase = {
  open: 0,
  reveal: 1,
  awaiting_result: 2,
  resolved: 3,
} as const;
export type MarketPhase = (typeof MarketPhase)[keyof typeof MarketPhase];

export type PredictionMarketCircuits = AnyProvableCircuitId;
export type PredictionMarketProviders = MidnightProviders<
  PredictionMarketCircuits,
  typeof PredictionMarketPrivateStateId,
  PredictionMarketPrivateState
>;
export type PredictionMarketContractInstance =
  // biome-ignore lint/suspicious/noExplicitAny: generated Compact Contract generic is not externally accessible
  CompiledContract.CompiledContract<any, PredictionMarketPrivateState>;
export type DeployedPredictionMarketContract =
  // biome-ignore lint/suspicious/noExplicitAny: SDK deployment type requires generated circuit mapping
  | DeployedContract<any>
  // biome-ignore lint/suspicious/noExplicitAny: SDK deployment type requires generated circuit mapping
  | FoundContract<any>;

/**
 * Compact's map representation is iterable and provides lookup/member methods,
 * but is not a JavaScript Map (it does not expose entries()).
 */
export type CompactMap<K, V> = Iterable<readonly [K, V]> & {
  isEmpty(): boolean;
  size(): bigint;
  member(key: K): boolean;
  lookup(key: K): V;
};

export type CompactSet<T> = Iterable<T> & {
  isEmpty(): boolean;
  size(): bigint;
  member(value: T): boolean;
};

export type PredictionMarketLedgerState = {
  phase: MarketPhase;
  admin_key: Uint8Array;
  participant_count: bigint;
  revealed_count: bigint;
  total_pool: bigint;
  amber_foxes_pool: bigint;
  cedar_owls_pool: bigint;
  harbor_whales_pool: bigint;
  meadow_bears_pool: bigint;
  winning_team: Team;
  result_set: boolean;
  total_claimed_rewards: bigint;
  commitments: CompactMap<Uint8Array, Uint8Array>;
  stakes: CompactMap<Uint8Array, bigint>;
  participants: CompactSet<Uint8Array>;
  revealed: CompactSet<Uint8Array>;
  claimed: CompactSet<Uint8Array>;
  rewards: CompactMap<Uint8Array, bigint>;
};

export const teamPool = (
  state: PredictionMarketLedgerState,
  team: Team,
): bigint => {
  if (team === Team.amber_foxes) return state.amber_foxes_pool;
  if (team === Team.cedar_owls) return state.cedar_owls_pool;
  if (team === Team.harbor_whales) return state.harbor_whales_pool;
  return state.meadow_bears_pool;
};

export const floorReward = (
  totalPool: bigint,
  stake: bigint,
  winningPool: bigint,
): bigint => (winningPool === 0n ? 0n : (totalPool * stake) / winningPool);
