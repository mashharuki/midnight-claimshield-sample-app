# Frontend & UX patterns

A prediction market's frontend has one job the underlying finance makes unusually hard: present a probabilistic, zero-sum, capped-loss instrument in a way a non-specialist trader can actually reason about. Price *is* probability (see `financial-mechanism-design.md`) — the UI should say that outright rather than leaving it implicit in a number.

## Market discovery

- Lead with the **question and resolution criteria**, not just a price. A trader needs to know exactly what they're betting on before the price means anything to them — surface "resolves via [source] by [date]" prominently, not buried in a details tab.
- Show **liquidity/confidence signals alongside price**: volume, number of unique traders, spread width. A market at "73%" with $50 of volume and two traders is a very different signal than one at "73%" with $2M of volume and thousands of traders — don't present both the same way (see `financial-mechanism-design.md`'s note on the limits of "wisdom of crowds").
- For markets nearing their trading deadline or awaiting resolution, make the state visually distinct (trading / awaiting resolution / disputed / resolved) — a trader placing an order should never be surprised that a market is actually about to stop taking trades.

## Price & probability display

- Show price **as a probability** (e.g., "68% chance," not just "$0.68") somewhere prominent — many users won't automatically make that translation, and it's the single most important piece of context on the page.
- Distinguish **quoted price** (top of book / current AMM price) from **expected fill price** for the size the user is actually about to trade — for anything beyond trivial size, the two diverge (slippage), and showing only the quoted price sets a false expectation.
- Chart price history so users can see how a probability has moved over time, not just its current value — a market that moved from 20% to 70% over a week tells a very different story than one that's been steady at 70%, even though the current number is identical.
- If you support both Yes and No as separately displayed prices, keep their relationship visible (`price(Yes) + price(No) ≈ 1` should be visually obvious, e.g. by showing both on the same bar) — showing them as two unrelated numbers invites confusion about what's actually being priced.

## Order entry

- Show max loss and max gain for the specific order being placed, computed from the actual price and size — "you could lose up to $X, gain up to $Y" is more useful to a first-time prediction-market trader than assuming they'll derive it from a price and a quantity field.
- If using a CLOB, clearly separate limit orders (set your price, may not fill immediately) from market orders (fill now at the best available price, size-dependent slippage) — conflating them is a common source of "why didn't my order fill" support tickets.
- Confirm orders with the actual terms being signed (price, size, expiry) before submission, especially if the underlying flow requires a wallet signature — don't let a UI-displayed price and a signed-order price silently diverge.
- After settlement/redemption becomes available (market resolved), surface a clear, low-friction "claim your winnings" action — don't make users hunt for how to redeem tokens they already know they won.

## Position & portfolio display

- Show **unrealized P&L marked to current market price**, not just the amount staked — a trader wants to know what their position is worth *now*, which requires live price data, not just their entry cost.
- Distinguish clearly between an **open position** (still tradable/mergeable), a **position in a market awaiting resolution** (can't trade further, payout not yet known), and a **redeemable position** (market resolved, funds claimable) — these have genuinely different available actions and should look different, not just carry a status label buried in a table.
- Show trade/activity history per position so users can reconstruct how they got to their current holding — useful for both trust and basic tax/record-keeping needs.

## UX guardrails for a zero-sum, no-recourse product

- Because this is capped-loss but genuinely zero-sum (someone's gain is someone else's loss, see `financial-mechanism-design.md`), avoid gamified UX patterns that obscure the real financial stakes (streaks, celebratory animations on wins without equally salient loss framing, infinite-scroll market discovery optimized purely for engagement) — these read as manipulative in a product where a meaningful fraction of participants lose money by construction (real data shows a large majority of retail participants on real platforms net-lose while a small fraction of sophisticated/well-capitalized accounts capture most of the profit).
- Make resolution disputes/ambiguity visible in the UI, not just in a backend dispute-tracking table — if a market is in a disputed state (see `oracle-and-resolution.md`), a trader trying to exit or a viewer checking the price needs to see that the current price/state is provisional.
- If your platform serves users in regulated jurisdictions, treat resolution-criteria clarity and fee/spread transparency as UX requirements, not just legal fine print — the Antier/Kalshi-style regulated-platform pattern is to make market rules, surveillance status, and integrity controls visibly part of the product, which also tends to build user trust independent of any regulatory requirement.

## Real-time updates

- Prefer a push channel (WebSocket/SSE) over polling for price/book updates — a trading UI that updates on a multi-second poll interval reads as broken once a user has seen a real-time one, and stale prices displayed during active trading are a direct source of "the price I saw wasn't the price I got" complaints.
- Reconcile optimistic UI updates (showing an order as placed immediately on submission) against the authoritative backend state once confirmed — don't leave a UI showing a phantom order if the backend rejected it (insufficient balance, price moved past a limit, etc.), and surface the rejection reason rather than silently reverting.
