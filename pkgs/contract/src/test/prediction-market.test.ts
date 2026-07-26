import { beforeEach, describe, expect, it } from "vitest";
import {
  MarketPhase,
  PredictionMarketSimulator,
  Team,
} from "./prediction-market-simulator.js";

describe("private football prediction market", () => {
  let market: PredictionMarketSimulator;

  beforeEach(() => {
    market = new PredictionMarketSimulator();
    market.addActor("alice", 2);
    market.addActor("bob", 3);
  });

  it("commits public stake while keeping team out of team pools", () => {
    market.setPrediction("alice", Team.amber_foxes, 100n, 11);
    const state = market.commit("alice", 100n);
    expect(state.phase).toBe(MarketPhase.open);
    expect(state.participant_count).toBe(1n);
    expect(state.total_pool).toBe(100n);
    expect(state.amber_foxes_pool).toBe(0n);
  });

  it("rejects duplicate and out-of-range commitments", () => {
    market.setPrediction("alice", Team.amber_foxes, 100n, 11);
    market.commit("alice", 100n);
    expect(() => market.commit("alice", 100n)).toThrow();
    market.setPrediction("bob", Team.cedar_owls, 1n, 12);
    expect(() => market.commit("bob", 1n)).toThrow();
  });

  it("allows only the administrator to advance phases", () => {
    expect(() => market.closePredictions("alice")).toThrow();
    expect(market.closePredictions().phase).toBe(MarketPhase.reveal);
    expect(() => market.closeReveal("bob")).toThrow();
    expect(market.closeReveal().phase).toBe(MarketPhase.awaiting_result);
  });

  it("rejects operations outside their phase and backward transitions", () => {
    market.setPrediction("alice", Team.amber_foxes, 100n, 11);
    expect(() => market.reveal("alice")).toThrow();
    market.commit("alice", 100n);
    expect(() => market.claim("alice", 100n)).toThrow();
    market.closePredictions();
    expect(() => market.commit("alice", 100n)).toThrow();
    expect(() => market.closePredictions()).toThrow();
    expect(() => market.reveal("bob")).toThrow();
  });

  it("reveals committed predictions into team pools", () => {
    market.setPrediction("alice", Team.amber_foxes, 100n, 11);
    market.setPrediction("bob", Team.cedar_owls, 200n, 12);
    market.commit("alice", 100n);
    market.commit("bob", 200n);
    market.closePredictions();
    market.reveal("alice");
    const state = market.reveal("bob");
    expect(state.revealed_count).toBe(2n);
    expect(state.amber_foxes_pool).toBe(100n);
    expect(state.cedar_owls_pool).toBe(200n);
    expect(() => market.reveal("alice")).toThrow();
  });

  it("allows only the administrator to resolve", () => {
    market.setPrediction("alice", Team.amber_foxes, 100n, 11);
    market.commit("alice", 100n);
    market.closePredictions();
    market.reveal("alice");
    market.closeReveal();
    expect(() => market.resolve(Team.amber_foxes, "bob")).toThrow();
  });

  it("rejects a modified private prediction", () => {
    market.setPrediction("alice", Team.amber_foxes, 100n, 11);
    market.commit("alice", 100n);
    market.closePredictions();
    market.setPrediction("alice", Team.cedar_owls, 100n, 99);
    expect(() => market.reveal("alice")).toThrow();
  });

  it("rejects resolving an outcome with no revealed pool", () => {
    market.setPrediction("alice", Team.amber_foxes, 100n, 11);
    market.commit("alice", 100n);
    market.closePredictions();
    market.reveal("alice");
    market.closeReveal();
    expect(() => market.resolve(Team.meadow_bears)).toThrow();
  });

  it("pays floor-rounded pari-mutuel rewards exactly once", () => {
    market.setPrediction("alice", Team.amber_foxes, 100n, 11);
    market.setPrediction("bob", Team.cedar_owls, 200n, 12);
    market.commit("alice", 100n);
    market.commit("bob", 200n);
    market.closePredictions();
    market.reveal("alice");
    market.reveal("bob");
    market.closeReveal();
    market.resolve(Team.amber_foxes);
    expect(() => market.claim("alice", 299n)).toThrow();
    const state = market.claim("alice", 300n);
    expect(state.total_claimed_rewards).toBe(300n);
    expect(() => market.claim("alice", 300n)).toThrow();
    expect(() => market.claim("bob", 300n)).toThrow();
  });

  it("floor-rounds multiple winners without exceeding the pool", () => {
    market.addActor("carol", 4);
    market.setPrediction("alice", Team.amber_foxes, 100n, 11);
    market.setPrediction("bob", Team.amber_foxes, 200n, 12);
    market.setPrediction("carol", Team.cedar_owls, 100n, 13);
    market.commit("alice", 100n);
    market.commit("bob", 200n);
    market.commit("carol", 100n);
    market.closePredictions();
    market.reveal("alice");
    market.reveal("bob");
    market.reveal("carol");
    market.closeReveal();
    market.resolve(Team.amber_foxes);
    market.claim("alice", 133n);
    const state = market.claim("bob", 266n);
    expect(state.total_claimed_rewards).toBe(399n);
    expect(state.total_claimed_rewards).toBeLessThanOrEqual(state.total_pool);
  });
});
