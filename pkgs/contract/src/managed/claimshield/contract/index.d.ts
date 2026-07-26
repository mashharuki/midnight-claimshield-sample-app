import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum PolicyState { open = 0, closed = 1 }

export enum ClaimStatus { none = 0,
                          submitted = 1,
                          approved = 2,
                          rejected = 3,
                          redeemed = 4
}

export type Witnesses<PS> = {
  local_secret_key(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_claim_amount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  get_merchant_digest(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_evidence_digest(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_opaque_receipt_identifier(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_claim_salt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  store_claim(context: __compactRuntime.WitnessContext<Ledger, PS>,
              amount_0: bigint,
              merchant_digest_0: Uint8Array,
              evidence_digest_0: Uint8Array,
              opaque_receipt_identifier_0: Uint8Array,
              salt_0: Uint8Array): [PS, []];
}

export type ImpureCircuits<PS> = {
  close_policy(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  submit_claim(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  approve_claim(context: __compactRuntime.CircuitContext<PS>,
                claimant_key_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  reject_claim(context: __compactRuntime.CircuitContext<PS>,
               claimant_key_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  redeem_claim(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  close_policy(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  submit_claim(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  approve_claim(context: __compactRuntime.CircuitContext<PS>,
                claimant_key_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  reject_claim(context: __compactRuntime.CircuitContext<PS>,
               claimant_key_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  redeem_claim(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  derive_claimant_key(nonce_0: Uint8Array, secret_key_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  derive_claimant_key(context: __compactRuntime.CircuitContext<PS>,
                      nonce_0: Uint8Array,
                      secret_key_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  close_policy(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  submit_claim(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  approve_claim(context: __compactRuntime.CircuitContext<PS>,
                claimant_key_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  reject_claim(context: __compactRuntime.CircuitContext<PS>,
               claimant_key_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  redeem_claim(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
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
  claims: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): ClaimStatus;
    [Symbol.iterator](): Iterator<[Uint8Array, ClaimStatus]>
  };
  commitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  used_receipt_nullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
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
