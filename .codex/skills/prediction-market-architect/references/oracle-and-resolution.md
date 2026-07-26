# Oracle & resolution architecture

Every prediction market eventually needs an answer to "what actually happened." How that answer gets into the system — and what stops it from being wrong or manipulated — is the trust foundation the entire market sits on. A perfect settlement contract with a corruptible resolver is still a broken market.

## Three tiers of resolution, by trust-minimization

### 1. Trusted admin / creator-reports
The market creator (or a designated admin) calls a `resolve(outcome)` function directly, no bond, no dispute window.

- **When it's fine**: prototypes, internal tools, markets among a closed group who already trust the resolver socially (e.g., a company's internal forecasting tool), or genuinely low-stakes demos.
- **When it's not**: anything with real external money and an unaccountable resolver. Flag this as a finding whenever you see it in a review of a production-intended system — even if the creator is well-intentioned today, the code doesn't encode any protection against them (or a compromised key) reporting falsely later.
- **Minimum upgrade if you must keep a trusted-admin model**: use a multisig instead of a single key, and publish resolution criteria publicly and immutably (e.g., hashed into the market creation transaction) so a wrong resolution is at least publicly falsifiable even if not automatically preventable.

### 2. Optimistic oracle (propose — dispute — escalate)
This is the pattern that lets a platform run thousands of markets without a human manually resolving each one, popularized by UMA's Optimistic Oracle and used by Polymarket via an adapter contract.

Mechanics:
1. At market creation, store the resolution criteria as data the oracle can later reference (ancillary data), plus a **reward** (payment for whoever successfully proposes the correct answer) and a **proposal bond** requirement.
2. After the event resolves in the real world, **anyone** can call `propose(outcome)` and post the bond. This permissionless-propose design means you don't need to pre-select a resolver — market participants and third-party bots are economically incentivized to propose correct answers to earn the reward.
3. A **liveness window** (Polymarket defaults to roughly 2 hours for standard markets, longer for high-value ones) starts. If nobody disputes, the proposal finalizes automatically at window's end.
4. **Anyone can dispute** by posting a matching bond within the liveness window. A well-designed system uses **tiered escalation** to keep costs proportionate: a first dispute simply resets the proposal round (cheap, fast — often just resolves an honest disagreement or a typo), while a second dispute on the same market escalates to a slower, heavier process (e.g., a token-holder vote, taking 48–72 hours) that produces a final, hard-to-reverse answer.
5. Whoever proposed/disputed incorrectly loses their bond to whoever was right — this is what makes propose-and-dispute self-policing without needing a trusted resolver up front.

Translate the oracle's raw output into your settlement primitive's payout weights explicitly (e.g., a 3-way raw output of yes/no/ambiguous maps to CTF-style payout numerators `[1,0]`, `[0,1]`, `[1,1]` for a genuine punt/void where all stakes are refunded proportionally) — don't assume the oracle's answer format matches your payout format 1:1.

**When to use this tier**: any market with real money and an open/permissionless market-creation model, where you can't guarantee a single trusted resolver exists for every market.

### 3. Decentralized vote / native consensus
Resolution happens via a vote among a fixed validator/token-holder set rather than an external oracle protocol — e.g., Hyperliquid's HIP-4 design resolves prediction markets through its own validator consensus rather than depending on an external oracle.

- **Advantage over optimistic oracle**: faster finality (no liveness window needed for the common case), no dependency on an external protocol being available/correctly priced.
- **Disadvantage**: trust concentrates in whatever validator/voter set you have — a small validator set (dozens, not thousands) is a meaningfully smaller trust base than a broad token-holder dispute pool, and validators may have positions in the markets they're voting on resolution for, which is a conflict of interest worth explicitly addressing (e.g., barring resolvers from holding positions in markets they'll vote on, or requiring disclosure).
- **When to use this tier**: you're building inside a platform that already has a validator/consensus layer with acceptable decentralization for this purpose, and you want faster settlement than an external oracle's dispute window allows.

## Writing resolution criteria that actually resolve unambiguously

The most common real-world failure isn't the oracle mechanism — it's a badly written question. Before wiring up any resolution tier, write the criteria as if a stranger with zero context has to adjudicate it months later (because that's genuinely who often does: a bonded proposer, a disputing challenger, or a validator voting blind). Concretely:

- Name the **exact source of truth** ("the outcome as reported by [specific named source] as of [specific time in a specific timezone]"), not a vague appeal to "what actually happened."
- Handle **ambiguous/void scenarios explicitly** up front: what happens if the event is cancelled, the source never reports, or the question becomes moot (e.g., a candidate drops out before an election)? Decide whether void means "refund all stakes proportionally" and make sure your settlement primitive supports that payout shape (see `settlement-and-contracts.md`'s note on fractional payout weights).
- Set the **resolution source as immutable/hashed at creation time**, not something that can be silently edited after trading has started — otherwise you've created a mechanism for the market creator to retroactively change what they're being asked to adjudicate.
- If the event has a **known but distant date**, decide and publish the trading-deadline-to-resolution-attempt gap explicitly (don't let it be "whenever the admin gets around to it") — an unresolved market with no clear timeline is a liquidity trap for anyone still holding a position.

## What to check in a review

- Is the resolver identity fixed and embedded in the market/condition ID at creation (see `settlement-and-contracts.md`), or is it a mutable field someone could change later?
- If optimistic: are the bond size and liveness window large enough relative to the market's expected volume that a bad-faith proposal isn't cheaper than the profit from a wrong resolution? A $10 bond guarding a $1M market is not a deterrent.
- Is there **any** dispute path at all, or is resolution single-shot and final the moment one party calls it?
- Can the resolver (or a colluding proposer/disputer pair) profit from a specific position they hold in the market they're resolving? If resolvers aren't barred from holding positions, that's a conflict of interest worth flagging even if no exploit is proven.
- Does the emergency-override path (if one exists) have its own delay, or can an admin instantly override a resolution that's about to go against them?
