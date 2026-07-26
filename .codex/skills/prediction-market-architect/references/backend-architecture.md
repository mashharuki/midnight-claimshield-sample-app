# Backend architecture

Once the settlement primitive and resolution model are fixed (see `settlement-and-contracts.md` and `oracle-and-resolution.md`), the backend's job is to make that on-chain/on-ledger truth fast to query, make trading feel real-time, and keep services with different latency/consistency needs from contaminating each other. This file describes a service decomposition that generalizes across stacks (it's what a production system like Polymarket runs, described generically rather than in its specific tech choices).

## Service boundaries — don't build one monolith

Split into services with genuinely different requirements rather than one API surface:

1. **Catalog / metadata service** — market questions, categories/tags, descriptions, images, comments, search. This is read-heavy, tolerant of eventual consistency (a market description doesn't need to be sub-second fresh), and can be cached aggressively or even served from a CDN. No auth needed for reads.
2. **Indexer / analytics service** — positions, trade history, open interest, holder counts, leaderboards. Built by ingesting chain/ledger events (trades, splits, merges, redemptions) into a queryable store — this is fundamentally an ETL/indexing problem, not a live-transaction problem, so it can lag the chain by seconds without breaking anything. Keep this separate from the trading path so a slow analytics query never blocks an order from being placed.
3. **Matching / trading service** — order book state, order placement/cancellation, price/spread/midpoint queries, real-time book updates. This has the tightest latency requirements and its own auth model (users must prove they can cover the order — signature + balance check — before it's accepted). If you're running an off-chain-order + on-chain-settlement model (below), this service owns the order book and matching logic entirely off-chain.
4. **Settlement / relayer service** — takes matched orders (or accumulated batches) and submits them to the chain/ledger for final settlement. Decoupling this from the matching service means matching can run at in-memory speed while settlement respects chain finality/gas/fee constraints.
5. **Bridge / fiat on-off-ramp** (if applicable) — isolate this as its own service/proxy, since it usually depends on a third-party provider with its own compliance and uptime characteristics you don't want coupled to your core trading path.

Map this to whatever your actual stack supports — these can be separate deployables, separate modules in a monorepo, or separate logical layers within one process for a small prototype — but keep the *boundaries* even if the deployment topology is simpler. The reason to keep boundaries even in a small system: it's much easier to later split a well-bounded module into its own service than to untangle a monolith once the trading service is under load and the analytics queries are slowing it down.

## Off-chain order book + on-chain settlement (if using a CLOB)

If you chose a CLOB pricing mechanism (see `financial-mechanism-design.md`), the standard production pattern avoids putting every order placement/cancellation on-chain (too slow, too expensive):

1. Users sign orders **off-chain** (a typed/structured signature over order fields: token/outcome, side, amount, price, expiry, nonce) and submit to the matching service over a normal API call — no chain transaction yet.
2. The matching service validates the signature, checks the signer's on-chain/ledger balance is sufficient, checks tick size / order validity, and inserts into the in-memory book if unmatched, or matches immediately against resting orders.
3. **Only matched trades hit the chain.** A relayer submits the matched order pair (both signatures) to a settlement contract/circuit, which independently re-verifies both signatures and enforces that the executed price/amount matches what was actually signed — the relayer/operator can never move funds outside what the two parties actually signed, and user assets stay in the settlement contract rather than a custodial hot wallet the operator controls.
4. Push book/trade updates to clients over a persistent connection (WebSocket or equivalent) for a real-time feel — polling a REST endpoint for order book state produces a visibly laggy trading UI.

This pattern is chain-agnostic: "sign off-chain, match off-chain, settle on-chain with re-verification" works the same whether settlement is an EVM contract, a Move module, or a Compact circuit — the signature scheme and settlement call shape are the only stack-specific parts.

### Match types worth modeling explicitly

Beyond simple "buyer meets seller of the same token," a mature matching engine that understands the split/merge settlement primitive supports:
- **Complementary match**: a straightforward token swap between a Yes-buyer and Yes-seller (or equivalently, opposing sides of the same outcome).
- **Mint match**: two *buyers* of complementary outcomes (someone buying Yes, someone buying No) can be matched against each other by having the settlement layer `split` their combined collateral into a fresh complementary pair — this means liquidity doesn't require an existing seller to already hold the exact token being bought, deepening effective liquidity beyond what's actually resting in the book.
- **Merge match**: two *sellers* of complementary outcomes can be matched by `merge`-ing their tokens back into collateral, again without needing a counterparty already holding the other side.

Supporting mint/merge matches (not just complementary matches) meaningfully increases capital efficiency and is worth the added matching-engine complexity once you're past a prototype.

## API surface — a reasonable default shape

Regardless of stack, a prediction market backend generally needs to expose:

- **Market/catalog reads**: list markets, get market detail, search/filter by category or status, get resolution criteria and status.
- **Market data**: current price/probability per outcome, order book depth (if CLOB), recent trade history, volume, open interest.
- **Trading**: place order / submit trade intent, cancel order, get order status — authenticated, tied to a wallet/identity that can prove funds.
- **Positions/portfolio**: a user's current holdings across markets, unrealized P&L (mark-to-market against current price), trade/activity history, claimable/redeemable balances post-resolution.
- **Real-time feed**: a push channel (WebSocket or SSE) for book updates, trade prints, and price changes — poll-based UIs feel broken for anything trading-adjacent.

Keep read endpoints public/unauthenticated where the data is genuinely public (market prices, order book depth) — unauthenticated access lets third parties build on top of your data (arbitrage bots, dashboards, signal-extraction tools) which deepens liquidity and adoption, at the cost of needing rate-limiting/caching to protect the backend from scraping load.

## Data model notes

- Persist raw chain/ledger events (trade executed, split, merge, redeemed, market resolved) as the source of truth for the indexer, and derive everything else (positions, P&L, leaderboards) from replaying/aggregating those events rather than mutating a "current state" table directly — this makes the indexer re-buildable from scratch if a bug is found, and makes audit/dispute investigation tractable ("show me every event that touched this position").
- Cache aggressively for read-heavy catalog/market-data endpoints, but make sure trading-critical numbers (the price used to validate an order signature) are read from a source that can't be stale relative to what's about to be signed/settled — a cached price used to validate a trade is a bug waiting to be exploited via a race condition.
