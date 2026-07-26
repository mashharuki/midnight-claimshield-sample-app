---
name: prediction-market-architect
description: Comprehensive, language- and blockchain-agnostic guidance for designing, implementing, reviewing, and testing prediction market applications (Polymarket/Kalshi/Augur-style yes/no or multi-outcome markets) — covers financial mechanism design (AMM vs CLOB vs pari-mutuel vs fixed-odds pricing, implied probability, liquidity/slippage), settlement primitives (outcome tokens, split/merge/redeem conservation), oracle/resolution architecture (optimistic vs decentralized vs trusted-admin, dispute windows), backend service decomposition (catalog, indexer, matching engine, settlement relayer), frontend/UX patterns for order entry and position display, and a security/testing checklist (invariant tests, reentrancy, oracle manipulation, rounding exploits). Use this skill whenever the user wants to design, build, extend, audit, or review any part of a prediction market, betting market, forecasting market, or "will X happen" application — including smart contracts on any chain (EVM, Solana, Midnight, Move, or non-blockchain databases), a matching/order-book backend, or a market UI — even if they don't say "prediction market" explicitly but describe outcome tokens, yes/no shares, oracle resolution, or odds-based betting.
---

# Prediction Market Architect

A prediction market lets people trade on the outcome of a real-world event, and the trade price is simultaneously a payment and a probability estimate. Every design decision in this domain — how tokens are minted, how trades clear, how disputes are handled — has both a **financial-correctness** consequence (does money conserve, can someone manipulate the price cheaply) and a **UX** consequence (does a trader understand what they're buying). This skill gives you a framework to reason about both, independent of the tech stack.

It is deliberately implementation-agnostic. It does not assume Solidity, TypeScript, Compact, or any specific chain — the patterns here (conditional tokens, optimistic resolution, CLOB vs AMM) originate from real production systems (mainly Polymarket's Conditional Tokens Framework + UMA oracle + CLOB, and Kalshi's regulated CLOB model) but translate to any execution environment, including this repo's Midnight/Compact contracts. When you need language- or chain-specific implementation help (e.g., actual Compact syntax), pair this skill with the relevant stack-specific skill — use this one to decide *what* to build, the other to decide *how* to write it.

## How to use this skill

1. **Figure out which mode you're in**: designing something new, reviewing/auditing existing code, or debugging a specific mechanism (pricing looks wrong, payouts don't conserve, oracle can be gamed). Each mode below points at the relevant workflow.
2. **Work top-down through the five pillars** (next section) — later pillars depend on earlier decisions, so don't pick a settlement primitive before you've picked a pricing mechanism, and don't design the backend before the settlement primitive is fixed. Skipping this order is the most common source of expensive rework in prediction market projects.
3. **Pull in a reference file** when you need depth on one pillar — each is short, cite specific sections rather than reading the whole thing if you already know which pillar the question is about.

| Reference file | Read this when you need to decide/review... |
|---|---|
| `references/financial-mechanism-design.md` | How prices form, which pricing mechanism to use (CLOB/AMM/LMSR/pari-mutuel/fixed-odds), liquidity seeding, fees, and the limits of "markets aggregate information well" |
| `references/settlement-and-contracts.md` | The token/share model, the split/merge/redeem conservation invariant, multi-outcome (neg-risk) handling, and the on-chain state machine |
| `references/oracle-and-resolution.md` | Who declares the outcome, trusted vs optimistic vs decentralized-vote resolution, dispute windows and bonds, and edge cases (ambiguous events, early resolution) |
| `references/backend-architecture.md` | Service boundaries (catalog, indexer, matching engine, settlement relayer), API surface, real-time data delivery, and off-chain/on-chain division of labor |
| `references/frontend-ux.md` | Market discovery, order entry, position/portfolio display, probability visualization, and UX guardrails for a zero-sum leveraged-feeling product |
| `references/testing-and-security.md` | The invariant tests and adversarial checks every prediction market needs before it touches real money, organized as a checklist |

## The five pillars (work through in this order)

### Pillar 1 — Market definition
Before any code: what is the event, what are the discrete outcomes, what is the resolution source, when does trading stop, and when/how does the market resolve? An ambiguous question ("Will it rain tomorrow?" — where? whose definition of rain?) breaks every downstream layer, because the resolver has no unambiguous ground truth to point at. Write the resolution criteria down as if a stranger with no context has to adjudicate it later — that's genuinely who will be doing it (an oracle, a bot, or a bonded challenger). See `references/oracle-and-resolution.md` for how production systems phrase resolution criteria.

### Pillar 2 — Financial mechanism (pricing)
Decide *how price is discovered*: continuous order matching (CLOB), an automated market maker curve (constant-product AMM or LMSR), pari-mutuel pooling, or fixed-odds against a bookmaker. This choice is driven by expected liquidity, number of outcomes, and whether you need continuous real-time pricing or just an end-of-period payout split. Read `references/financial-mechanism-design.md` before committing — the wrong choice here (e.g., a naive linear AMM formula) creates path-dependent pricing bugs (splitting one trade into two costs more than one trade) that are expensive to retrofit.

If the execution environment has its own cost model (a ZK circuit's proving cost, an EVM gas limit, a resource-metered runtime), re-check the mechanism against it here, not later: on-chain order matching and log/exponential math (LMSR) get expensive or impractical in constrained/proving environments, while pari-mutuel and constant-product AMMs use only cheap arithmetic and tend to be the safer default when circuit/gas cost is a binding constraint. Pull in the stack-specific skill for this project at this exact decision point (not just once at the start) if one is available — it'll know the concrete cost characteristics this file can't.

### Pillar 3 — Settlement primitive (the accounting invariant)
Regardless of pricing mechanism, you need an answer to: what does 1 unit of collateral become, and how does it come back? The reusable pattern from Polymarket's Conditional Tokens Framework is: collateral **splits** into a complete set of complementary outcome tokens (1 unit in → 1 Yes + 1 No out), those tokens can **merge** back into collateral at any time pre-resolution (which is what keeps `price(Yes) + price(No)` anchored near 1 via arbitrage), and post-resolution winning tokens **redeem** 1:1 for collateral while losing tokens redeem for zero. This split/merge/redeem triad is the single most important invariant to get right — see `references/settlement-and-contracts.md`. Multi-outcome markets with correlated outcomes (e.g., "which of these 5 candidates wins") are best decomposed into independent binary markets plus a conversion adapter, not a single N-way AMM — also covered there.

### Pillar 4 — Resolution & oracle architecture
Who has the authority to say "the answer was Yes", and what stops them from lying or being wrong? Three tiers, in increasing cost and trust-minimization: **trusted admin** (fine for prototypes/internal tools, a single point of failure for anything with real money), **optimistic oracle** (anyone proposes an answer with a bond, a liveness window lets challengers dispute, escalating tiers of dispute resolve to a slower decentralized process — this is what lets Polymarket run thousands of markets without a human resolving each one), and **decentralized vote / native consensus** (e.g., Hyperliquid HIP-4 uses validator consensus directly — faster, but concentrates trust in a smaller validator set). Never let the market creator and the resolver be the same unaccountable party once real money is involved — see `references/oracle-and-resolution.md` for the bond/liveness/dispute pattern in detail.

### Pillar 5 — Application layers (backend + frontend)
Once the first four pillars are fixed, the backend and frontend are largely mechanical, but two architectural decisions matter: (a) split your backend into a **catalog/metadata service**, an **indexer/analytics service** reading chain or ledger state, and a **matching/trading service** with its own auth model — don't build one monolith, because these have different consistency and latency requirements (see `references/backend-architecture.md`); (b) the frontend's job is to make an inherently probabilistic, zero-sum, capped-loss instrument legible to a trader who may not think in probabilities — price *is* probability, and the UI should say so explicitly rather than just showing a number (see `references/frontend-ux.md`).

## Mode: designing something new

1. Interview the user (or infer from their prompt) on Pillar 1 — get the resolution criteria explicit before anything else. If it's genuinely ambiguous, say so and propose a tightened version rather than silently picking one.
2. Walk Pillars 2–4 as a sequence of explicit decisions with tradeoffs stated, not a single recommendation dropped without reasoning — the user needs to own these choices since they affect regulatory exposure, capital requirements, and audit surface. If the user's actual question is scoped to just one or two pillars, give those full treatment and cover the others briefly as context rather than expanding every pillar to the same depth — the goal is a complete mental model, not a maximal essay.
3. Only after 1–4 are settled, sketch the backend/frontend shape (Pillar 5). Use pseudocode or structural diagrams to communicate architecture — don't default to generating a full implementation unless the user asks for runnable code in a specific stack.
4. Flag which decisions are hard to reverse post-launch (the settlement primitive and the collateral asset are the hardest; pricing mechanism and UI are easier to iterate on) so the user prioritizes getting those right first.

## Mode: reviewing / auditing existing code

1. Identify which of the five pillars the code under review touches, and load the matching reference file(s).
2. Check the settlement invariant first, always: does every code path that mints outcome tokens have a corresponding path that conserves collateral (split → complementary pair, merge → collateral back, redeem → payout only for winners)? A break here is a direct loss of funds, not a UX bug.
3. Check the oracle/resolution boundary: can the entity that resolves the market also profit from resolving it a particular way? Is there a dispute window, or is resolution instant and final?
4. Run through `references/testing-and-security.md` as a checklist — treat every unchecked item as a finding to report, not a nice-to-have.
5. Report findings ranked by financial impact (funds-at-risk > logic bugs > UX issues), with a concrete exploit scenario for anything security-relevant, not just "this looks risky."

## Mode: debugging a specific mechanism

Go straight to the relevant reference file rather than the full five-pillar walk:
- "Payouts don't add up" / "collateral is leaking" → `references/settlement-and-contracts.md`
- "Price moves in a way that doesn't make sense" / "splitting a trade changes the cost" → `references/financial-mechanism-design.md`
- "Market resolved to the wrong outcome" / "resolution can be front-run or manipulated" → `references/oracle-and-resolution.md`
- "Order book / matching is slow or drops orders" → `references/backend-architecture.md`
- "Users don't understand what they're buying" / "position display is confusing" → `references/frontend-ux.md`

## Anti-patterns to call out proactively

These recur across real tutorials and production postmortems (see reference files for the specific mechanism each one breaks):

- **Creator-as-oracle with no dispute path.** Fine for a demo, a liability for anything real — flag it even if the user didn't ask about security.
- **Linear/naive AMM pricing formulas.** They look correct in a happy-path test but create trade-splitting arbitrage and path-dependent costs; production systems use log-scoring-rule (LMSR-style) curves or an order book, not a linear price-per-token formula.
- **Missing reentrancy guards on redeem/claim functions.** Any function that moves value out based on a stored balance is a reentrancy target.
- **No trading deadline / unclear "when does this stop trading" boundary.** Without it, trades can land after the event outcome is effectively known.
- **One N-way AMM for correlated multi-outcome markets** instead of decomposing into binaries + a conversion adapter — capital-inefficient and harder to reason about than the neg-risk pattern.
- **Treating price as pure "wisdom of crowds"** in user-facing copy or business assumptions. Real data (see `references/financial-mechanism-design.md`) shows profit and information concentrate in a small fraction of sophisticated/well-capitalized participants; markets aggregate information *unevenly*, and thin/niche markets can be dominated by a single large trader. Don't let the user overstate accuracy guarantees to end users or stakeholders.
- **Monolithic backend mixing trading-engine latency requirements with catalog/CMS-style metadata.** These belong in separate services with different scaling and consistency needs.
