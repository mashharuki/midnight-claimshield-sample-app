import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum PolicyState { open = 0, closed = 1 }

export type Witnesses<PS> = {
  local_secret_key(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  close_policy(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  close_policy(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  derive_claimant_key(nonce_0: Uint8Array, secret_key_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  derive_claimant_key(context: __compactRuntime.CircuitContext<PS>,
                      nonce_0: Uint8Array,
                      secret_key_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  close_policy(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly policy_state: PolicyState;
  readonly admin_key: Uint8Array;
  readonly policy_nonce: Uint8Array;
  readonly policy_label: Uint8Array;
  readonly policy_category: Uint8Array;
  readonly start_at: bigint;
  readonly end_at: bigint;
  readonly minimum_amount: bigint;
  readonly maximum_amount: bigint;
  readonly fixed_benefit: bigint;
  readonly submitted_count: bigint;
  readonly approved_count: bigint;
  readonly planned_benefit_total: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               label_0: Uint8Array,
               category_0: Uint8Array,
               policy_start_at_0: bigint,
               policy_end_at_0: bigint,
               policy_minimum_amount_0: bigint,
               policy_maximum_amount_0: bigint,
               policy_fixed_benefit_0: bigint,
               nonce_0: Uint8Array): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
