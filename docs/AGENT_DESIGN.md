# Agent Design

The planning agent is the engine that turns structured constraints into a costed,
day-by-day trip. It is an Anthropic tool-use loop with a **small, least-privilege toolset**
and deterministic code doing the math. The model orchestrates; it does not invent prices.

Design tenets:

- **Least privilege.** The agent can _search_ and _read_ prices and _compute_ budgets. It
  cannot book, pay, write to arbitrary stores, or call providers directly — only the four
  bounded tools below, which themselves go through the integration interface
  ([INTEGRATIONS.md](./INTEGRATIONS.md)).
- **Deterministic math.** Budgets, sums, and distances are computed in code, not by the
  model. The model decides _what_ to assemble; code decides _what it costs_.
- **Bounded loops.** Hard caps on turns and tool calls per plan (NFR-5) cap cost and
  prevent runaway loops; the agent returns the best plan so far on exhaustion.
- **Honesty preserved.** The agent must carry each Listing's `source`/`freshness` through
  to the final plan; it may not relabel an estimate as live.

---

## Tools (the entire toolset)

| Tool | Input | Output | Side effects |
|---|---|---|---|
| `search_flights` | `FlightQuery` | `Flight[]` (Listing-wrapped) | none (read) |
| `search_stays` | `StayQuery` | `Stay[]` (Listing-wrapped) | none (read) |
| `search_activities` | `ActivityQuery` | `Activity[]` (Listing-wrapped) | none (read) |
| `compute_budget` | `{ items: Listing[], target?, currency }` | `Budget` (categorized, summed, status) | none (pure) |

That's it. Four read/compute tools, no write/booking tools. Each is schema-validated (Zod)
on input and output. The agent's "memory" of the trip-in-progress is the conversation +
the server-held draft, not a tool it can mutate freely.

Why `compute_budget` is a tool and not free-form model math: it guarantees the running
total is **deterministic and always equal to the sum of the chosen listings** — the model
can't fat-finger a sum or drift from the displayed sources (NFR honesty + NFR-6).

---

## The plan loop (scour → rank → assemble)

```
                ┌─────────────────────────────────────────────┐
   constraints  │  SYSTEM PROMPT: role, budget discipline,     │
   (TripRequest)│  honesty rules, pace/vibe, tool contract     │
        │       └─────────────────────────────────────────────┘
        ▼
   ┌─────────┐   1. RESOLVE     If destination is a region/vibe, pick a concrete place
   │  Agent  │   ─────────────  (curated > procedural), justify briefly.
   │  loop   │
   │         │   2. SCOUR       Call search_flights, search_stays, search_activities
   │         │   ─────────────  with queries derived from constraints. May call more than
   │         │                  once (e.g. flexible dates → a few date variants).
   │         │
   │         │   3. RANK        For each slot, score candidates against budget + prefs
   │         │   ─────────────  (see scoring below). Keep top options per slot.
   │         │
   │         │   4. ASSEMBLE    Choose a coherent combination: flights + stay + a
   │         │   ─────────────  day-by-day plan honoring pace, geography (walking
   │         │                  distances), and must-haves.
   │         │
   │         │   5. COST        compute_budget over chosen listings. Check vs target.
   │         │   ─────────────
   │         │
   │         │   6. OPTIMIZE    If over budget (or leaving easy savings), adjust the
   │         │   ─────────────  cheapest-impact slot and re-cost. Bounded iterations.
   │         │
   │         │   7. EXPLAIN     Emit summary, ≥1 saving/tradeoff hint, and the
   │         └─────────────────  assumptions taken. Stream throughout.
        ▼
   complete Trip (itinerary + budget + assumptions), persisted as a TripVersion
```

Progress at each step is streamed to the client as `status`/`partial` SSE events so the
user watches the trip take shape (NFR-2), not a spinner.

---

## Ranking & optimization

The agent ranks candidates per slot with an explicit, explainable scoring rubric (the model
applies it; it's not a black box):

```
score(option) =
      w_budget   · budgetFit(option)        // closeness to leaving the trip within target
    + w_pref     · prefMatch(option)        // vibe/interests/lodging-style match
    + w_quality  · qualitySignal(option)    // rating, stops (flights), location
    + w_logistics· logisticsFit(option)     // walking distance, transfer time, pace fit
    − penalties                             // exceeds hard cap, violates an `avoid`, etc.
```

- **Budget discipline.** For a **hard** cap, exceeding it is a hard penalty — the agent
  must return within it or, if truly infeasible, return the closest plan _flagged as over_
  with concrete trims (US-4.3), never silently over. For a **soft** target, small overage
  is allowed but surfaced.
- **Whole-trip optimization, not greedy per-slot.** The agent costs the _combination_; a
  pricier flight that unlocks a much cheaper stay can win. `compute_budget` over the full
  set is the arbiter.
- **Persona-aware weighting.** A tight student budget pushes `w_budget` up and favors free
  POIs/hostels; a family trip raises `w_logistics`/kid-suitability; a "relaxed" pace caps
  activities-per-day. Weights derive from `TripRequest`/`Preferences`, not hardcoded.
- **Always leave a tradeoff on the table.** The agent surfaces ≥1 `SavingHint` (US-3.5)
  — the next cheapest meaningful lever — so the money stays transparent.

---

## Partial re-planning (the cheap-refinement contract)

Refinements are classified into a **scope** (see [CONVERSATION_FLOW.md](./CONVERSATION_FLOW.md))
before any model planning happens. The scope determines which tools may run and which parts
of the existing trip are **frozen**.

```
refinement utterance
        │
        ▼
  classify(scope, intent)   ── one fast structured call ──►  { scope, params }
        │
        ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ scope → allowed tools (least privilege, per-refinement)           │
  │  lodging       → search_stays   (+ recompute walking-dependent     │
  │                   activity items), compute_budget                  │
  │  flights       → search_flights, compute_budget                    │
  │  activity_day  → search_activities (that day only), compute_budget │
  │  dates         → search_flights + search_stays, compute_budget     │
  │  budget_global → any search tool, but directed cheapest-impact-first│
  │  destination   → full re-plan (new region)                         │
  │  info          → NO tools — answer in chat                         │
  └──────────────────────────────────────────────────────────────────┘
        │
        ▼
  re-plan ONLY the scoped slice, with the rest of the Trip passed as
  immutable context ("keep everything else byte-identical")
        │
        ▼
  diff vs current version → mark changes, show budget delta → persist vN+1
```

Concretely, "swap the hotel" runs **only** `search_stays` + `compute_budget`; flights and
unaffected days are passed in as frozen context and returned unchanged (US-4.2). This is
both faster and cheaper (fewer tool calls, smaller token footprint) and is what makes
exploration feel free.

`info`-scope messages are the safety valve against over-eager re-planning: a question gets
an answer and changes nothing until the user explicitly opts in.

---

## System prompt shape (sketch)

The agent's system prompt encodes, in priority order:

1. **Role & honesty rules** — plan whole trips; never present estimates as live prices;
   always carry source/freshness; state assumptions.
2. **Budget discipline** — hard vs soft semantics; never silently exceed a hard cap.
3. **Pace/vibe → activities-per-day** mapping and persona-aware weighting.
4. **Tool contract** — what each tool does, that booking/payment are out of scope, that
   `compute_budget` is the only source of totals.
5. **Output contract** — produce a `Trip` matching the shared schema; emit a summary, a
   saving hint, and assumptions.
6. **Bounds** — respect max turns/tool calls; if exhausted, return best-so-far with a note.

---

## Guardrails & limits

- **Bounded:** max ~N turns and ~M tool calls per initial plan, fewer for refinements
  (NFR-5). Configurable; tuned for < 15 s mock plans (NFR-1).
- **Validated I/O:** every tool call's input and output is Zod-checked; malformed model
  output triggers a single corrective retry, then a graceful "couldn't complete" with
  partial results.
- **No privilege escalation:** the agent literally has no booking/payment/write tool to
  call; least-privilege is enforced by the toolset, not by prompt alone.
- **Determinism in mock mode** (NFR-6) makes agent behavior reproducible for tests and
  demos — same constraints → same trip.
- **Degradation aware:** if a tool returns `degraded`/mock fallbacks, the agent proceeds and
  the resulting Trip is marked `status: 'degraded'` with affected prices labeled (NFR-3).
