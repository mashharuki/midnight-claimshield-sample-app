import { beforeEach, describe, expect, it } from "vitest";
import {
  ClaimShieldPolicySimulator,
  defaultPolicy,
  PolicyState,
} from "./claimshield-policy-simulator.js";

describe("ClaimShield policy lifecycle", () => {
  let policy: ClaimShieldPolicySimulator;

  beforeEach(() => {
    policy = new ClaimShieldPolicySimulator();
  });

  it("publishes a valid open policy and zeroed public aggregates", () => {
    const ledger = policy.getLedger();

    expect(ledger.policy_state).toBe(PolicyState.open);
    expect(ledger.policy_label).toEqual(defaultPolicy.label);
    expect(ledger.policy_category).toEqual(defaultPolicy.category);
    expect(ledger.start_at).toBe(defaultPolicy.startAt);
    expect(ledger.end_at).toBe(defaultPolicy.endAt);
    expect(ledger.minimum_amount).toBe(defaultPolicy.minimumAmount);
    expect(ledger.maximum_amount).toBe(defaultPolicy.maximumAmount);
    expect(ledger.fixed_benefit).toBe(defaultPolicy.fixedBenefit);
    expect(ledger.submitted_count).toBe(0n);
    expect(ledger.approved_count).toBe(0n);
    expect(ledger.planned_benefit_total).toBe(0n);
  });

  it.each([
    ["an empty policy label", { label: new Uint8Array(32) }],
    ["an empty policy category", { category: new Uint8Array(32) }],
    ["an end time equal to the start time", { startAt: 1_000n, endAt: 1_000n }],
    ["an end time before the start time", { startAt: 1_000n, endAt: 999n }],
    [
      "a minimum above the maximum",
      { minimumAmount: 101n, maximumAmount: 100n },
    ],
    ["a zero fixed benefit", { fixedBenefit: 0n }],
  ])("rejects policy creation with %s", (_reason, patch) => {
    expect(
      () => new ClaimShieldPolicySimulator({ ...defaultPolicy, ...patch }),
    ).toThrow();
  });

  it("allows only the administrator to close an open policy", () => {
    policy.addActor("applicant", 2);

    expect(() => policy.closePolicy("applicant")).toThrow();
    expect(policy.closePolicy()).toMatchObject({
      policy_state: PolicyState.closed,
    });
  });

  it("rejects a second close operation", () => {
    policy.closePolicy();

    expect(() => policy.closePolicy()).toThrow();
  });
});
