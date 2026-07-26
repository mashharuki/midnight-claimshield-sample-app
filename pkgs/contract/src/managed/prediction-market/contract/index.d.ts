import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum MarketPhase { open = 0,
                          reveal = 1,
                          awaiting_result = 2,
                          resolved = 3
}

export enum Team { amber_foxes = 0,
                   cedar_owls = 1,
                   harbor_whales = 2,
                   meadow_bears = 3
}

export type Witnesses<PS> = {
  local_secret_key(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_selected_team(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Team];
  get_prediction_salt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  store_prediction(context: __compactRuntime.WitnessContext<Ledger, PS>,
                   team_0: Team,
                   stake_0: bigint,
                   salt_0: Uint8Array): [PS, []];
}

export type ImpureCircuits<PS> = {
  commit_prediction(context: __compactRuntime.CircuitContext<PS>,
                    stake_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  close_predictions(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  reveal_prediction(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  close_reveal(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  resolve_market(context: __compactRuntime.CircuitContext<PS>, winner_0: Team): __compactRuntime.CircuitResults<PS, []>;
  claim_reward(context: __compactRuntime.CircuitContext<PS>, reward_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  commit_prediction(context: __compactRuntime.CircuitContext<PS>,
                    stake_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  close_predictions(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  reveal_prediction(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  close_reveal(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  resolve_market(context: __compactRuntime.CircuitContext<PS>, winner_0: Team): __compactRuntime.CircuitResults<PS, []>;
  claim_reward(context: __compactRuntime.CircuitContext<PS>, reward_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  derive_participant_key(sk_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  derive_participant_key(context: __compactRuntime.CircuitContext<PS>,
                         sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  commit_prediction(context: __compactRuntime.CircuitContext<PS>,
                    stake_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  close_predictions(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  reveal_prediction(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  close_reveal(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  resolve_market(context: __compactRuntime.CircuitContext<PS>, winner_0: Team): __compactRuntime.CircuitResults<PS, []>;
  claim_reward(context: __compactRuntime.CircuitContext<PS>, reward_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly phase: MarketPhase;
  readonly admin_key: Uint8Array;
  readonly participant_count: bigint;
  readonly revealed_count: bigint;
  readonly total_pool: bigint;
  readonly amber_foxes_pool: bigint;
  readonly cedar_owls_pool: bigint;
  readonly harbor_whales_pool: bigint;
  readonly meadow_bears_pool: bigint;
  readonly winning_team: Team;
  readonly result_set: boolean;
  readonly total_claimed_rewards: bigint;
  commitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  stakes: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
  participants: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  revealed: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  claimed: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  rewards: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): bigint;
    [Symbol.iterator](): Iterator<[Uint8Array, bigint]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
