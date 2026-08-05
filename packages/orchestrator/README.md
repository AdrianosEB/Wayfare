# @wayfare/orchestrator

An orchestration of independent agents that plans and books travel end to end, and is the base
for an AI-native travel agency. A **supervisor fans async agents out across flight × stay ×
date combinations and prunes branches against budget before expanding**; a **verification
layer cross-checks findings at the source and re-prices the full itinerary before surfacing
it**, returning confirmed, bookable options at the low end of the price range — matched to the
traveler's budget and personality, and graded by a self-check that re-runs on failure.

> **Stack note:** this is implemented as a supervisor *pattern* in **TypeScript/Node** (with a
> React client elsewhere in the monorepo), not a third-party graph runtime — there is no
> LangGraph or Python here. The behavior below (supervisor fan-out, budget-pruned
> branch-and-bound, source re-pricing) is real and tested; the technology names are called out
> honestly so the code and its description match.

> **This package stages, it never executes.** No booking is completed, no form is submitted,
> and no hotel is called autonomously. Bookings and calls come out as `BookingIntent`s with
> `status: "requires_approval"` — a hand-off for a human (or an explicitly approval-gated tool)
> to authorize.

## The pipeline

```
   one sentence   ┌─────────┐   ┌──────────┐  who is this traveler, and what do
   + profile   ─► │ intake  ├──►│ persona  │  they actually weight? (price/quality/
                  └─────────┘   └────┬─────┘  location/vibe/flexibility)
                                     │
   ┌─────────────────────────────────┼───────────────────────────────────────────┐
   │  self-correcting loop (up to maxPasses)                                        │
   │  ┌────────┐  ┌────────┐  ┌──────┐  ┌────────────┐  ┌────────┐                  │
   │  │ search │─►│ verify │─►│ rank │─►│ supervisor │─►│ critic │─┐                │
   │  │ (fan-  │  │(cross- │  │      │  │ (fan out    │  │ (self- │ │                │
   │  │  out)  │  │ check) │  │      │  │  flight×stay│  │ check) │ │                │
   │  │        │  │        │  │      │  │  ×date,     │  │        │ │                │
   │  │        │  │        │  │      │  │  prune on   │  │        │ │                │
   │  │        │  │        │  │      │  │  budget)    │  │        │ │                │
   │  └────────┘  └────────┘  └──────┘  └────────────┘  └───┬────┘ │                │
   │      ▲                                                  │ pass?│                │
   │      └────────────── broaden / relax on failure ◄───────┘  no │                │
   └───────────────────────────────────────────────────────yes────┘                │
                                     │
                          ┌──────────▼──────────┐   re-price every leg at its source;
                          │ reprice (confirm at │   confirm the whole-itinerary total
                          │ source)             │   holds → "bookable"
                          └──────────┬──────────┘
                          ┌──────────▼──────────┐   stage web deep-links + hotel-call
                          │ booking             │   scripts for the confirmed itinerary
                          └─────────────────────┘   (status: requires_approval)
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
| **Match** | [`agents/match.ts`](src/agents/match.ts) | Ranks on the persona's weights; builds an honest `Budget` from the chosen legs. |
| **Supervisor** | [`agents/supervisor.ts`](src/agents/supervisor.ts) | Fans out flight × stay × date combinations, prunes branches on budget **before** expanding with activities, returns whole-trip combinations best-first. |
| **Reprice** | [`agents/reprice.ts`](src/agents/reprice.ts) | Re-fetches every leg at its source and recomputes the total; only a no-drift itinerary is `confirmed` bookable. |
| **Critic** | [`agents/critic.ts`](src/agents/critic.ts) | Self-checks the plan against invariants; returns remedies that drive a re-run. |
| **Booking** | [`agents/booking.ts`](src/agents/booking.ts) | Stages bookings + hotel-call scripts as approval-required intents. |

## Whole-trip composition & confirmation

The supervisor is what makes this plan *trips*, not parts. It builds the cross-product of the
top flight, stay, and date-window candidates, prices each branch on its flight+stay partial,
and runs **branch-and-bound**: a branch over budget is pruned *before* it is expanded with
activities, so the expensive expansion only runs for branches that can still land on budget.
The survivors (a bounded beam) are expanded, scored on the persona's weights, and returned
affordable-first (`SupervisorStats` reports `expanded` / `prunedOnBudget` / `kept`).

Before anything is surfaced, the **reprice** agent goes back to each leg's *source*, re-fetches
the current price for that exact entity, and recomputes the whole-itinerary total. Only if
every leg is still there and nothing drifted past tolerance is the itinerary `confirmed` — i.e.
actually bookable at the number quoted (`ItineraryConfirmation`).

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

plan.itinerary;      // the chosen whole-trip combination (flight + stay + activities + dates)
plan.itineraries;    // every combination the supervisor kept, affordable-first
plan.supervisor;     // { expanded, prunedOnBudget, kept } — the branch-and-bound accounting
plan.confirmation;   // reprice-at-source ruling: confirmed?, drift, per-leg lines
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
