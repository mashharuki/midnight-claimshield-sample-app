import {
  type ChargedState,
  type CircuitContext,
  createCircuitContext,
  createConstructorContext,
  type EncodedZswapLocalState,
  sampleContractAddress,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
  MarketPhase,
  Team,
  type Witnesses,
} from "../managed/prediction-market/contract/index.js";
import {
  createInitialPredictionMarketPrivateState,
  type PredictionMarketPrivateState,
  predictionMarketWitnesses,
} from "../prediction-market-witnesses.js";

type Actor = {
  privateState: PredictionMarketPrivateState;
  zswapState: EncodedZswapLocalState;
};

export { MarketPhase, Team };

export class PredictionMarketSimulator {
  private readonly contract: Contract<PredictionMarketPrivateState>;
  private readonly actors = new Map<string, Actor>();
  private sharedState: ChargedState;
  private readonly contractAddress = sampleContractAddress();

  constructor(adminSecret = new Uint8Array(32).fill(1)) {
    this.contract = new Contract<PredictionMarketPrivateState>(
      predictionMarketWitnesses as unknown as Witnesses<PredictionMarketPrivateState>,
    );
    const admin = createInitialPredictionMarketPrivateState(adminSecret);
    const initial = this.contract.initialState(
      createConstructorContext(admin, "0".repeat(64)),
    );
    this.sharedState = initial.currentContractState.data;
    this.actors.set("admin", {
      privateState: initial.currentPrivateState,
      zswapState: initial.currentZswapLocalState,
    });
  }

  addActor(name: string, secretByte: number): void {
    const privateState = createInitialPredictionMarketPrivateState(
      new Uint8Array(32).fill(secretByte),
    );
    const initial = this.contract.initialState(
      createConstructorContext(privateState, "0".repeat(64)),
    );
    this.actors.set(name, {
      privateState,
      zswapState: initial.currentZswapLocalState,
    });
  }

  getLedger(): Ledger {
    return ledger(this.sharedState);
  }

  private actor(name: string): Actor {
    const actor = this.actors.get(name);
    if (!actor) throw new Error(`Unknown actor: ${name}`);
    return actor;
  }

  private context(name: string): CircuitContext<PredictionMarketPrivateState> {
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
    result: { context: CircuitContext<PredictionMarketPrivateState> },
  ): Ledger {
    this.actors.set(name, {
      privateState: result.context.currentPrivateState,
      zswapState: result.context.currentZswapLocalState,
    });
    this.sharedState = result.context.currentQueryContext.state;
    return this.getLedger();
  }

  setPrediction(
    name: string,
    team: Team,
    stake: bigint,
    saltByte: number,
  ): void {
    const actor = this.actor(name);
    actor.privateState = {
      ...actor.privateState,
      selectedTeam: team,
      stake,
      salt: new Uint8Array(32).fill(saltByte),
    };
  }

  commit(name: string, stake: bigint): Ledger {
    return this.apply(
      name,
      this.contract.impureCircuits.commit_prediction(this.context(name), stake),
    );
  }

  reveal(name: string): Ledger {
    return this.apply(
      name,
      this.contract.impureCircuits.reveal_prediction(this.context(name)),
    );
  }

  closePredictions(name = "admin"): Ledger {
    return this.apply(
      name,
      this.contract.impureCircuits.close_predictions(this.context(name)),
    );
  }

  closeReveal(name = "admin"): Ledger {
    return this.apply(
      name,
      this.contract.impureCircuits.close_reveal(this.context(name)),
    );
  }

  resolve(winner: Team, name = "admin"): Ledger {
    return this.apply(
      name,
      this.contract.impureCircuits.resolve_market(this.context(name), winner),
    );
  }

  claim(name: string, reward: bigint): Ledger {
    return this.apply(
      name,
      this.contract.impureCircuits.claim_reward(this.context(name), reward),
    );
  }
}
