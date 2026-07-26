# Settlement primitive & contract architecture

This is the accounting core of a prediction market: what collateral becomes, how it's represented while a market is open, and how it converts back to value at resolution. Get this wrong and you have a funds-loss bug, not a UX issue — treat every claim in this file as something to verify with an invariant test (see `testing-and-security.md`), not just read and trust.

## The split / merge / redeem triad

The most battle-tested, reusable pattern (originating from Gnosis's Conditional Tokens Framework, used by Polymarket) is:

1. **Split**: lock N units of collateral, mint N units of *each* outcome token in a complete set. E.g., 100 USDC in → 100 "Yes" tokens + 100 "No" tokens out. This is the only way new outcome tokens enter circulation — there is no free mint.
2. **Merge**: burn one complete complementary set (1 Yes + 1 No, or one of each outcome in an N-way market), reclaim 1 unit of collateral. Crucially, **this works before resolution too** — anyone holding a complete set can always unwind back to collateral regardless of what happens in the market. This is what anchors `price(Yes) + price(No) ≈ 1`: if the combined price ever drifts below 1, buying both and merging is a riskless arbitrage; if it drifts above 1, splitting and selling both is riskless. The merge path is what makes that arbitrage possible — without it, prices can drift arbitrarily and there's no correction mechanism.
3. **Redeem**: after resolution, the resolver sets payout weights per outcome (e.g., `[1, 0]` for Yes winning, `[0, 1]` for No, and in principle fractional splits like `[0.5, 0.5]` for a genuinely ambiguous/void outcome if your design supports it). Holders burn their outcome tokens for `payout_weight × collateral_per_token`. Winning tokens redeem 1:1; losing tokens redeem for zero.

**The invariant to test, always**: total collateral held by the contract/ledger must equal total outstanding outcome-token value at every point in time. Splitting moves collateral into token form (not out of the system), merging moves it back, redeeming pays out exactly what payout weights authorize and nothing paid to a holder should ever exceed their token balance's entitled share. If you can construct a sequence of split/merge/redeem/trade operations that leaves the contract holding less collateral than outstanding tokens are owed, that's a critical finding, not a nitpick.

**If you chose pari-mutuel pooling instead** (see `financial-mechanism-design.md`) rather than a CTF-style token, there's no split/merge step — stakes go directly into a pool per outcome — but the same conservation invariant still applies in a simpler form: total pool balance held by the contract must equal the sum of all recorded stakes at every point, and `payout per winning share = total pool / winning-side pool` must exactly exhaust the pool (no dust left permanently stranded, no payout that would overdraw it). The redeem-side checks below (double-redeem guards, exact-balance checks, rounding direction) apply identically; only split/merge are specific to the token model.



## Representing positions (the token/share model)

Two broad approaches, in increasing sophistication:

- **Direct mapping accounting** (simplest, seen in minimal tutorials): a `mapping(user => mapping(outcome => amount))`-style ledger with no transferable token. Fast to build, but positions aren't tradable/transferable without extra machinery, and it doesn't compose with other contracts or wallets.
- **Fungible tokens per outcome** (ERC20-style, one token contract per outcome): simple to reason about and trade, but doesn't scale to many markets or combinatorial/multi-outcome positions without deploying a new token contract per outcome per market.
- **Single multi-token contract keyed by position ID** (ERC1155-style, the CTF approach): one contract handles every position across every market; a position's ID is derived deterministically from `(collateral asset, condition, outcome index set)`. This scales to many markets without new deployments and lets a single wallet hold arbitrary combinations of positions across markets. This is the right default if you expect more than a handful of markets.

Whichever you choose, derive the market/condition identifier so that it **embeds the resolver's identity** in the ID itself (e.g., `conditionId = hash(resolverAddress, questionId, outcomeCount)`). This gives you access control "for free" on the redemption/resolution path — only the address baked into the ID can ever report payouts for that specific condition, without needing a separate permission-check table that could drift out of sync.

## Multi-outcome and correlated markets (the neg-risk pattern)

Don't build a single N-way AMM or order book for markets with many correlated, mutually-exclusive outcomes (e.g., "which of these 8 candidates wins the election" — exactly one can be true). Instead:

1. Model each outcome as its own **independent binary market** (Candidate A: Yes/No, Candidate B: Yes/No, ...). This reuses all your binary-market infrastructure unchanged.
2. Add a **conversion adapter** that enforces the group-level logical constraint and lets holders convert efficiently: holding "No" on every outcome except one is logically equivalent to holding "Yes" on the remaining outcome, so the adapter lets a user burn N−1 "No" tokens (one per other outcome) and mint the equivalent "Yes" token on the remaining outcome, refunding the surplus collateral this frees up.
3. Send converted-away tokens to a non-spendable burn path so the conversion is one-directional — this prevents a reverse-conversion replay that would let someone mint value out of nothing.

This decomposition is more capital-efficient than requiring separate collateral pools per outcome, and it's easier to audit than a bespoke N-way pricing curve, because each individual market still obeys the simple binary split/merge/redeem invariant — the adapter is the only new piece of logic to scrutinize.

## Market/contract state machine

Regardless of pricing mechanism, gate every state-changing function behind an explicit state check rather than relying on convention:

```
CREATED → TRADING → (trading deadline reached) → AWAITING_RESOLUTION → RESOLVED → (redemptions proceed)
                                                          ↓
                                                    DISPUTED (if using optimistic resolution — see oracle-and-resolution.md)
```

- Trading functions (`split`, buy/sell, order placement) should require `state == TRADING` and current time before the trading deadline.
- Resolution functions should require `state == AWAITING_RESOLUTION` (or `DISPUTED` resolving back to it) and caller == the resolver baked into the condition/market ID.
- Redemption should require `state == RESOLVED` and check the caller actually holds the tokens being burned — don't trust a caller-supplied amount without checking balance.
- Merge should remain available in `TRADING` and `AWAITING_RESOLUTION` (arbitrage/exit should work right up until resolution) but naturally becomes moot after `RESOLVED` since redeem is more direct at that point.

A market with no explicit trading deadline is a common defect: without one, trades can land after the real-world outcome is already effectively known but before the resolver has formally reported it, letting informed traders extract value from anyone still willing to take the other side. Always require an explicit cutover time between `TRADING` and `AWAITING_RESOLUTION`.

## Access control and safety checklist for this layer

- **Reentrancy guards on every function that transfers value out** (merge, redeem, order settlement) — these are the highest-value targets in the contract.
- **The resolver role must be distinct from, or at minimum accountable separately from, the market creator/admin role.** A creator who can also unilaterally resolve their own market has no incentive alignment problem preventing them from lying — see `oracle-and-resolution.md` for how to structure this properly.
- **Bounded emergency admin powers, not unbounded ones.** If you need a pause/emergency-resolve path for genuinely broken markets, gate it with its own delay/timelock so it can't be used to front-run a resolution that's about to go against the admin's interest.
- **Exact-amount checks on every value-moving call** — verify the caller actually transferred/holds what a function assumes, rather than trusting a parameter.
- **Rounding direction matters at scale.** When splitting collateral into fractional shares or computing pari-mutuel payouts, always round in the contract's favor (down) for amounts paid out and in the user's favor (up, i.e. charge slightly more) for amounts collected, never the reverse — otherwise repeated small transactions can be used to drain dust at the protocol's expense.
