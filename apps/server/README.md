# @wayfare/server

The Wayfare API: the four endpoints in [API_CONTRACT.md](../../../docs/API_CONTRACT.md), the
planning agent, and the mock integration layer. Express + Zod, TypeScript, Node 20+.

```bash
pnpm --filter @wayfare/server dev    # boots on :3000 (tsx watch)
pnpm --filter @wayfare/server test   # vitest — fixtures, journeys, refine, HTTP
```

The only env is `ANTHROPIC_API_KEY` (optional — see below). Copy `.env.example` → `.env`.

## How it's wired

```
routes/session.ts        4 endpoints + SSE framing, uniform errors
  agent/parse.ts         prompt → TripRequest (heuristic; LLM-swappable)
  agent/clarify.ts       leverage-ranked clarifying questions (≤4, skippable)
  agent/merge.ts         clarifying answers → TripRequest (source=answer)
  agent/run.ts           picks the planner ↓
    agent/planner.ts     deterministic engine: resolve→scour→rank→assemble→cost (default)
    agent/agentLoop.ts   Anthropic claude-opus-4-8 tool-use loop (when key set)
  agent/refine.ts        scope classify → partial re-plan → diff + budgetDelta
  agent/tools.ts         the 4 tools (search_flights/stays/activities, compute_budget)
  agent/budget.ts        compute_budget — the ONLY place totals are summed
  integrations/          PricingProvider + mock (curated Greece + procedural global) + composite
  session/store.ts       in-memory sessions + trip versioning (pluggable)
```

## Two planners, one contract

Planning is **dual-path**, both driving the same four tools and emitting the same SSE events:

- **Deterministic engine** (default) — pure, seeded code. No key needed, so the server boots
  and tests run offline; this is what guarantees determinism (NFR-6) and fixture conformance.
- **Anthropic tool-use loop** — the production path (AGENT_DESIGN.md), used when
  `ANTHROPIC_API_KEY` is set. The **model orchestrates** (resolve, search, choose); **code does
  the math** (`compute_budget` is the only summer) and assembles a schema-valid Trip. Bounded
  turns/tool-calls; falls back to the deterministic best-so-far on exhaustion or bad output.

Select explicitly with `PLANNER_MODE=auto|deterministic|agent` (auto = agent iff a key is set).

## Honesty & integrations

Every price is a `Listing` carrying `source` + `freshness`; in MVP all are `mock`
(`mock:curated` for the Greek hero pack, `mock:procedural` everywhere else), labeled
"Estimated price" — never presented as live. The mock provider is global: a curated hero
destination set plus a deterministic procedural generator for any place on Earth. Real
providers slot in behind `PricingProvider` per category via `CompositeProvider`, which falls
back to mock and marks the trip `degraded` if one misbehaves (NFR-3/NFR-7). No key ever
reaches the client (NFR-4).
