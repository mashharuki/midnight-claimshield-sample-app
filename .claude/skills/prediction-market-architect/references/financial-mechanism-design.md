# Financial mechanism design

How a prediction market discovers price, and what that price means, is the first real design decision after the market question itself is fixed. This file covers the pricing mechanisms, the math behind them, liquidity/seeding, fees, and the honest limits of what these markets actually measure.

## Price *is* probability — the core identity

A binary outcome token that redeems for $1 if the event happens and $0 otherwise trades, by no-arbitrage, at a price equal to the market's implied probability of that event. A token at $0.65 is a claim that the market currently assesses ~65% odds. This identity is what makes the whole instrument legible: you're not pricing a derivative on an underlying, the price *is* the thing being estimated.

Consequences worth stating explicitly in any design doc or UI:
- Expected value of a position: `EV = gain × P(win) − loss × P(lose)`. A trader who believes true probability is 60% but sees a market price of 40% has positive EV buying at 40%, purely from the mispricing — this is the mechanism that's supposed to pull prices toward accuracy.
- The instrument is capped-loss, capped-gain, no-leverage by construction: max loss is what you paid, max gain is `$1 − price paid`. Don't let leveraged-trading UX conventions (margin, liquidation warnings) leak in where they don't apply — and don't let users mistake it for a lottery ticket with unlimited upside either.
- The market is zero-sum before fees: one side's gain is exactly the other side's loss. This is a useful gut-check for any settlement math — total payouts across all positions in a resolved market should exactly equal total collateral collected, minus fees taken out.

## Choosing a pricing mechanism

Four mechanisms cover essentially every production and prototype system. Pick based on expected liquidity depth, number of outcomes, and whether you need continuous intra-period pricing or just an end-of-period split.

| Mechanism | How it works | Best for | Watch out for |
|---|---|---|---|
| **CLOB** (central limit order book) | Users post limit orders (price, size); matching engine pairs opposing orders; unmatched liquidity sits in the book. | High-volume markets with enough independent participants to form a real book; regulated venues (Kalshi runs ~81% of markets this way for auditability). | Needs bootstrapped liquidity — a fresh market with an empty book has no price at all. Usually paired with market-maker incentives or an AMM to seed early liquidity, then transitions to CLOB. |
| **AMM / CFMM** (constant-product or similar) | A pool of both outcome tokens; price moves along a curve as one side is bought down. | Long-tail markets, permissionless market creation where you can't guarantee a market maker shows up. | A *naive linear* pricing formula (`price = k × probability × amount`) is path-dependent — splitting a large trade into several smaller ones costs a different total than one trade, which is both a UX surprise and an exploitable inconsistency. Prefer a proper cost-function-based curve (log-scoring-rule / LMSR-style, or a standard constant-product curve) over an ad hoc linear formula. |
| **LMSR** (logarithmic market scoring rule) | A market-maker cost function `C(q) = b·ln(Σ e^(q_i/b))`; price of outcome i is `∂C/∂q_i`; a designated "market maker" bears bounded, calculable loss (bounded by `b·ln(n)` for n outcomes). | Markets that need guaranteed liquidity at every price point even with zero organic traders, and bounded/predictable subsidy cost. | Requires choosing the liquidity parameter `b` up front — too small and prices swing wildly on small trades, too large and the subsidy cost is wasted on markets nobody trades. |
| **Pari-mutuel / pooled** | All stakes for an outcome go into a shared pool; at resolution, `payout per winning share = total pool / winning shares`. Price (odds) floats based on pool composition but isn't tradable mid-market the way an order book or AMM position is. | Simple win/lose markets, especially where "price" doesn't need to be continuously tradable (classic sports betting pools). | No continuous exit before resolution in the pure form — if you want traders to close positions early, you need a hybrid (seed pari-mutuel with synthetic shares, let price float AMM-style, still pay out pari-mutuel at the end). |

A hybrid worth knowing: some systems seed a market with **synthetic/virtual shares** at creation (a fake initial trade history) so the very first real trade doesn't see an undefined or wildly unstable price, then let real trading proceed against an AMM curve. If you do this, document explicitly how the synthetic shares are excluded from final payouts — conflating seed liquidity with real trader stakes at settlement is a recurring bug.

## Liquidity, spread, and slippage

- **Spread** (best-ask − best-bid) is the direct cost of trading in a CLOB; a wide spread means either low participation or market makers pricing in adverse-selection risk (informed traders picking off stale quotes).
- **Slippage**: a market order that's larger than the top of book walks through multiple price levels, so the average execution price is worse than the quoted price. Any UI showing a "price" should distinguish the quoted top-of-book price from the expected fill price for the size being traded.
- **Depth/liquidity risk for AMM-style markets**: whoever seeds the pool (a designated LP or the protocol treasury) bears real, asymmetric financial risk — realistic modeling shows an LP can lose a meaningfully larger fraction than they can gain, depending on how trading skews toward one outcome. Don't treat LP seeding as a free action in the design; size it and account for it explicitly.
- Thin/niche markets are dominated by whichever trader shows up with the most capital — this is expected, not a bug, but it means "price = crowd wisdom" framing breaks down exactly where liquidity is thinnest, which tends to be the most interesting/specialized questions.

## Fees

Design fees to avoid creating an arbitrage between an outcome and its complement. A common pattern: fee scales with `min(price, 1 − price)` (symmetric around 50/50, since that's where a market maker's inventory risk is highest and directional certainty is lowest), and maker orders (adding liquidity to the book) often pay zero or negative fees to incentivize resting liquidity, while taker orders (consuming liquidity) pay the fee. If you charge a flat fee regardless of price, check that it doesn't let someone buy both outcomes for less than $1 combined and lock in a riskless profit at settlement — that's a design bug, not just a suboptimal fee schedule.

## The honest limits of "markets aggregate information"

Prediction markets are often sold as "wisdom of crowds." Real data complicates that framing, and a good design/review should push back on overclaiming it:

- Profit and price-moving influence concentrate heavily: large-scale analysis of real platforms shows a small fraction of accounts capture most of the profit, and individual large traders can single-handedly move prices in thin markets. This is closer to **wealth-weighted, incentive-aligned aggregation** than an egalitarian poll.
- Genuine collective-intelligence benefits need four things to actually hold: participant diversity, independent judgment (no herding), distributed private information, and sufficient liquidity. Markets dominated by entertainment/gambling volume (e.g., sports) rather than information-discovery motives, or markets with too few informed participants, don't reliably satisfy these — expect noisier, less accurate prices there.
- The self-correcting mechanism *is* real: mispricing creates an arbitrage/EV opportunity that sophisticated capital is incentivized to close, which is what nudges prices toward calibrated probabilities over time — but this is a claim about efficiency under sufficient participation, not a guarantee for any specific thin or manipulable market.
- If you're building UI copy, dashboards, or stakeholder-facing claims about "what the market thinks," prefer showing confidence signals (volume, number of unique traders, spread width) alongside the price, rather than presenting a bare probability number as ground truth.

## Novel/hybrid designs worth knowing about

- **Merged order books for complementary outcomes** (e.g., Hyperliquid's HIP-4 approach): instead of separate Yes and No books, treat "buy Yes at $0.65" and "sell No at $0.35" as the same liquidity, consolidating what would otherwise be fragmented depth across two books into one. Worth considering whenever your settlement primitive already guarantees `Yes + No = $1` (see `settlement-and-contracts.md`), since it's then a UI/matching-engine optimization rather than a new financial primitive.
- **Shared collateral/account infrastructure with other derivatives** (also HIP-4): if you're building inside an existing trading platform, letting prediction-market positions share margin/collateral accounting with other products (perps, options) lets traders hedge across product types in one account — but it also means a bug in one product's accounting can bleed into another's; isolate the settlement logic even if the account/collateral layer is shared.
