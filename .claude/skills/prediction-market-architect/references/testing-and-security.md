# Testing & security checklist

Treat every unchecked item below as a finding to report when reviewing a prediction market, not a nice-to-have. Organized by the layer it primarily protects — cross-reference the matching design file for *why* each check matters.

## Settlement invariant tests (highest priority — direct funds-at-risk)

- [ ] **Conservation**: for any sequence of split/merge/trade/redeem operations, total collateral held by the contract/ledger equals total outstanding outcome-token value at every point. Write this as a property-based/fuzz test if your tooling supports it (random sequences of operations, assert the invariant after each step) rather than only a handful of hand-picked scenarios — settlement bugs are usually triggered by an unusual *order* of operations, not an unusual single operation.
- [ ] **Split then merge round-trips exactly**: splitting N collateral then immediately merging the resulting complete set returns exactly N collateral (minus any explicitly-designed fee) — no value created or destroyed.
- [ ] **Redeem only pays winners, exactly once**: after resolution, redeeming winning tokens pays out `payout_weight × amount`, redeeming losing tokens pays zero, and a token cannot be redeemed twice (burn-before-payout or an equivalent double-redeem guard).
- [ ] **No path mints outcome tokens without corresponding locked collateral.** Audit every function that increases a user's token balance — each one should trace back to either a `split` locking collateral or a legitimate transfer from another holder, never a bare mint.
- [ ] **Rounding never favors the user at the protocol's expense across repeated small transactions.** Simulate many small trades/splits/merges and confirm accumulated rounding doesn't let someone extract more than they put in.

## Pricing mechanism tests

- [ ] **Trade-splitting neutrality**: for AMM/curve-based pricing, confirm that splitting one trade into several smaller ones costs the same (up to fees) as one large trade — a naive linear pricing formula fails this and creates a real, exploitable arbitrage (see `financial-mechanism-design.md`).
- [ ] **No riskless arbitrage from fee structure**: confirm you cannot buy a complete set (one of every outcome) for less than what it redeems for post-resolution once fees are included — this would be a direct, repeatable, risk-free extraction from the protocol.
- [ ] **Price stays within [0, 1] (or the equivalent bound for your token's redemption value)** under all reachable trade sequences — a pricing bug that lets an outcome token trade above its maximum redemption value or below zero is a critical finding.
- [ ] **LP/seed-liquidity accounting is isolated from real trader payouts** if you seed markets with synthetic/virtual shares — confirm seed shares are excluded from the pool that determines real payouts, and test the exclusion explicitly rather than assuming it falls out of the general formula.

## Oracle / resolution tests

- [ ] **Only the resolver identity embedded in the market/condition ID can report an outcome** — attempt resolution from an unauthorized address and confirm it reverts/rejects.
- [ ] **Dispute window actually blocks early finalization** — attempt to redeem or treat a proposal as final before the liveness window elapses and confirm it's rejected.
- [ ] **A valid dispute correctly resets or escalates** or resolution, per your design — confirm the specific outcome-changing path (re-propose vs. escalate to vote) behaves as documented, not just that "a dispute was recorded."
- [ ] **Bond amounts are enforced** — a proposal/dispute without the required bond posted should be rejected, not accepted with a smaller or missing bond.
- [ ] **Void/ambiguous resolution path works end-to-end** if your design supports it (fractional payout weights / full refund) — this path is often implemented but never actually tested since it's the "unhappy path" nobody exercises in a demo.

## Access control & reentrancy

- [ ] **Reentrancy guard present on every function that transfers value out** (merge, redeem, order settlement, claim). Write an explicit reentrancy attempt test (a malicious receiver that re-enters on receipt) for each, don't just confirm a guard modifier is present in the source — modifiers can be misapplied or bypassed by a code path that doesn't go through them.
- [ ] **State-machine gating is enforced, not just documented**: attempt trading after the deadline, attempt resolution before the trading deadline, attempt redemption before resolution — each should be rejected by the contract/circuit itself, not rely on the frontend to prevent it.
- [ ] **Admin/emergency powers are bounded**: if a pause or emergency-resolve path exists, confirm it has its own timelock/delay separate from normal resolution, and that it cannot be used to override a resolution that's already past its dispute window.
- [ ] **Exact-amount / balance checks on every value-moving call** — attempt to redeem/transfer more than the caller's actual balance and confirm rejection; don't trust caller-supplied amounts.

## Backend / matching engine tests

- [ ] **Signature verification is re-checked at settlement time**, not only at order-acceptance time in the off-chain matching service — an order accepted off-chain must still be independently verified by the on-chain/on-ledger settlement layer before funds move (see `backend-architecture.md`).
- [ ] **Stale-price race conditions**: confirm a cached/stale price cannot be used to validate or settle a trade whose actual execution price has since moved — test by mutating price between order submission and settlement in a test harness.
- [ ] **Order cancellation is race-safe**: a cancel request racing against a near-simultaneous match should have a deterministic, tested outcome (either the cancel wins and the match is rejected, or vice versa) rather than an undefined interleaving.
- [ ] **Indexer replay produces identical state to live processing** — rebuilding the analytics/position store from the raw event log from scratch should match the state built incrementally; if it doesn't, your indexer has a hidden mutation path that isn't reflected in the event log, which breaks auditability.

## Load / adversarial scenarios worth simulating

- [ ] A single large trader moving a thin market's price sharply, then attempting to exploit the resulting mispricing before the market can correct (relevant to both pricing-mechanism design and UX — see `financial-mechanism-design.md`'s note on capital concentration).
- [ ] A wash-trading pattern (same actor as both sides of repeated trades) — decide up front whether this is a problem for your design (it can be used to fake volume/liquidity signals shown to other users) and whether you need detection/mitigation.
- [ ] Market resolution landing exactly at a trading-deadline boundary — confirm there's no window where a trade can be accepted after the real-world outcome is known but before the contract's deadline check triggers (clock skew, block-timestamp vs. wall-clock mismatches, etc.).
- [ ] Burst order cancellation/replacement (a market maker repricing rapidly) — confirm the matching engine's throughput and consistency hold up, not just its correctness on a single order.

## Reporting findings

When this checklist surfaces an issue, report it as: **the specific mechanism that breaks**, **a concrete sequence of actions that triggers it** (not just "this seems risky"), and **the financial impact** (funds directly at risk vs. a UX/trust issue vs. a hardening recommendation for defense-in-depth). Rank funds-at-risk findings above logic bugs above UX issues — a reviewer's time and the reader's attention are both limited, and burying a critical settlement-invariant break under a list of minor style notes does the user a disservice.
