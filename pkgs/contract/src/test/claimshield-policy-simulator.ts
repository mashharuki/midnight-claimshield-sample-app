import {
  type ChargedState,
  type CircuitContext,
  createCircuitContext,
  createConstructorContext,
  type EncodedZswapLocalState,
  sampleContractAddress,
} from "@midnight-ntwrk/compact-runtime";
import {
  type ClaimShieldPrivateState,
  claimShieldWitnesses,
  createInitialClaimShieldPrivateState,
} from "../claimshield-witnesses.js";
import {
  Contract,
  type Ledger,
  ledger,
  PolicyState,
  type Witnesses,
} from "../managed/claimshield/contract/index.js";

export { PolicyState };

export type PolicyConfiguration = {
  label: Uint8Array;
  category: Uint8Array;
  startAt: bigint;
  endAt: bigint;
  minimumAmount: bigint;
  maximumAmount: bigint;
  fixedBenefit: bigint;
  nonce: Uint8Array;
};

type Actor = {
  privateState: ClaimShieldPrivateState;
  zswapState: EncodedZswapLocalState;
};

export const defaultPolicy: PolicyConfiguration = {
  label: new Uint8Array(32).fill(0x4c),
  category: new Uint8Array(32).fill(0x43),
  startAt: 1_000n,
  endAt: 2_000n,
  minimumAmount: 100n,
  maximumAmount: 10_000n,
  fixedBenefit: 500n,
  nonce: new Uint8Array(32).fill(0x4e),
};

export class ClaimShieldPolicySimulator {
  private readonly contract: Contract<ClaimShieldPrivateState>;
  private readonly actors = new Map<string, Actor>();
  private readonly contractAddress = sampleContractAddress();
  private sharedState: ChargedState;

  constructor(
    configuration: PolicyConfiguration = defaultPolicy,
    adminSecret = new Uint8Array(32).fill(1),
  ) {
    this.contract = new Contract<ClaimShieldPrivateState>(
      claimShieldWitnesses as unknown as Witnesses<ClaimShieldPrivateState>,
    );
    const admin = createInitialClaimShieldPrivateState(adminSecret);
    const initial = this.contract.initialState(
      createConstructorContext(admin, "0".repeat(64)),
      configuration.label,
      configuration.category,
      configuration.startAt,
      configuration.endAt,
      configuration.minimumAmount,
      configuration.maximumAmount,
      configuration.fixedBenefit,
      configuration.nonce,
    );
    this.sharedState = initial.currentContractState.data;
    this.actors.set("admin", {
      privateState: initial.currentPrivateState,
      zswapState: initial.currentZswapLocalState,
    });
  }

  addActor(name: string, secretByte: number): void {
    const privateState = createInitialClaimShieldPrivateState(
      new Uint8Array(32).fill(secretByte),
    );
    const initial = this.contract.initialState(
      createConstructorContext(privateState, "0".repeat(64)),
      defaultPolicy.label,
      defaultPolicy.category,
      defaultPolicy.startAt,
      defaultPolicy.endAt,
      defaultPolicy.minimumAmount,
      defaultPolicy.maximumAmount,
      defaultPolicy.fixedBenefit,
      defaultPolicy.nonce,
    );
    this.actors.set(name, {
      privateState,
      zswapState: initial.currentZswapLocalState,
    });
  }

  getLedger(): Ledger {
    return ledger(this.sharedState);
  }

  closePolicy(name = "admin"): Ledger {
    return this.apply(
      name,
      this.contract.impureCircuits.close_policy(this.context(name)),
    );
  }

  private actor(name: string): Actor {
    const actor = this.actors.get(name);
    if (!actor) throw new Error(`Unknown actor: ${name}`);
    return actor;
  }

  private context(name: string): CircuitContext<ClaimShieldPrivateState> {
    const actor = this.actor(name);
    return createCircuitContext(
      this.contractAddress,
      actor.zswapState,
      this.sharedState,
      actor.privateState,
    );
  }

  private apply(
    name: string,
    result: { context: CircuitContext<ClaimShieldPrivateState> },
  ): Ledger {
    this.actors.set(name, {
      privateState: result.context.currentPrivateState,
      zswapState: result.context.currentZswapLocalState,
    });
    this.sharedState = result.context.currentQueryContext.state;
    return this.getLedger();
  }
}
