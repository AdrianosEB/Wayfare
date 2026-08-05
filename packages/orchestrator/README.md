# @wayfare/orchestrator

An orchestration of independent agents that plans travel end to end, and is the base for an
AI-native travel agency. It searches many sources in parallel, **cross-checks the listings
against each other** to confirm they are real and priced as listed, matches what survives to a
traveler's budget and personality, and **grades its own plan and re-runs** before returning
options at the low end of the market.

> **This package stages, it never executes.** No booking is completed, no form is submitted,
> and no hotel is called autonomously. Bookings and calls come out as `BookingIntent`s with
> `status: "requires_approval"` — a hand-off for a human (or an explicitly approval-gated tool)
> to authorize.

## The pipeline

```
                 ┌─────────┐   ┌──────────┐
   one sentence  │ intake  │   │ persona  │   who is this traveler, and what do
   + profile  ─► │ agent   ├──►│ agent    │   they actually weight? (price/quality/
                 └─────────┘   └────┬─────┘   location/vibe/flexibility)
                                    │
        ┌───────────────────────────┼──────────────────────────────┐
        │   self-correcting loop (up to maxPasses)                   │
        │   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
        │   │ search   │  │ verify   │  │ match    │  │ critic   │   │
        │   │ (parallel│─►│ (cross-  │─►│ (rank +  │─►│ (self-   │─┐ │
        │   │  fan-out)│  │  check)  │  │  budget) │  │  check)  │ │ │
        │   └──────────┘  └──────────┘  └──────────┘  └────┬─────┘ │ │
        │        ▲                                          │ pass? │ │
        │        └───────── broaden / relax on failure ◄────┘  no   │ │
        └───────────────────────────────────────────────────yes────┘ │
                                    │                                  │
                              ┌─────▼─────┐                            │
                              │ booking   │  stage web deep-links +    │
                              │ agent     │  hotel-call scripts        │
                              └───────────┘  (requires_approval)       │
```

Every agent is independent and single-purpose, communicates only through typed shapes in
[`src/types.ts`](src/types.ts), and can be composed or replaced piecemeal (all are exported).

## The agents

| Agent | File | Responsibility |
|-------|------|----------------|
| **Intake** | [`agents/intake.ts`](src/agents/intake.ts) | Sentence + profile → provenance-tracked `TripRequest`. |
| **Persona** | [`agents/persona.ts`](src/agents/persona.ts) | Free-text signals → `PersonaWeights` + `Preferences`. Reads the *personality*. |
| **Search** | [`agents/search.ts`](src/agents/search.ts) | Plans queries, fans them out to every provider **in parallel**. |
| **Verify** | [`agents/verify.ts`](src/agents/verify.ts) | Cross-checks listings per real-world entity: corroboration, price agreement, direct-vs-aggregator deals. The trust boundary. |
| **Match** | [`agents/match.ts`](src/agents/match.ts) | Ranks on the persona's weights within budget; builds an honest `Budget`. |
| **Critic** | [`agents/critic.ts`](src/agents/critic.ts) | Self-checks the plan against invariants; returns remedies that drive a re-run. |
| **Booking** | [`agents/booking.ts`](src/agents/booking.ts) | Stages bookings + hotel-call scripts as approval-required intents. |

## Verification — why this is an *agency*

Every provider is treated as an unreliable witness. The verifier groups candidates by the
real-world entity they point at (the same hotel, regardless of who listed it) and rules on each:

- **`verified`** — independent sources corroborate it at ~the same price.
- **`unconfirmed`** — only one source lists it; the price isn't corroborated.
- **`suspect`** — sources disagree wildly (a bait price or a stale quote); never led with.

It also surfaces **`DirectDeal`s**: when a hotel's own rate undercuts the aggregators (its
"separate listing from Booking"), that saving is flagged and a call to lock it in is drafted.

"Low end of the market" is not hardcoded — it falls out of the default price weight plus a
trust gate, so the cheapest *trustworthy* option wins, not the cheapest bait.

## Providers — the pluggable seam

A [`SearchProvider`](src/providers/types.ts) is any source of priced candidates. This package
ships [`mockProviderRegistry()`](src/providers/mock.ts): deterministic, dependency-free sources
(two aggregators + one direct source per bookable kind) that reproduce every case verification
exists for. **Drop real providers (Amadeus, Booking, an airline's site, Google Places) in
behind the same interface and nothing downstream changes.**

Every mock price is stamped `freshness: "mock"` — honest sample data. Per the project's
price-provenance rule, render `Listing.source` / `freshness`; never assume a number is live.

## Run it

```bash
pnpm --filter @wayfare/orchestrator demo        # end-to-end walkthrough, printed
pnpm --filter @wayfare/orchestrator test        # unit + e2e (vitest)
pnpm --filter @wayfare/orchestrator typecheck
```

```ts
import { Orchestrator, mockProviderRegistry } from "@wayfare/orchestrator";

const orchestrator = new Orchestrator(mockProviderRegistry(), { maxPasses: 3 });
const plan = await orchestrator.plan(
  "5 day foodie trip to Naxos in September, budget around €1800 for two",
  { id: "u1", homeCity: "London", signals: ["foodie on a budget", "wants to be central"],
    budget: { amount: 1800, currency: "EUR", type: "soft" }, partySize: { adults: 2 },
    mustHaves: [], avoid: [] },
);

plan.selection;      // the leading verified pick per kind
plan.options;        // full ranked lists, low-end-first
plan.budget;         // total === sum of lines
plan.bookingIntents; // all status: "requires_approval"
plan.trace;          // full audit trail of who did what
```

## Status & roadmap

This is a **scaffold wired to real domain types** (`@wayfare/shared`), fully typed and tested,
running today against mock providers. To take it to production:

1. Implement real `SearchProvider`s (Amadeus, Booking, airline direct, Google Places).
2. Swap the heuristic intake/persona agents for LLM-backed ones (same signatures).
3. Add entity resolution (fuzzy matching so "The Blue Studios" == "Aegean Blue Studios").
4. Wire `BookingIntent`s to an approval-gated action layer — the human stays in the loop.
