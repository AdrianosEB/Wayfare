# Wayfare

**Plan a complete vacation from one sentence.**

Wayfare turns a sentence like _"I want a relaxed 8-day beach trip in Greece in late
August for two people, around €2,500 total"_ into a complete, ready-to-book vacation
plan: flights, accommodation, a day-by-day itinerary of activities, and a transparent
running budget — every price tagged with its source and freshness.

There are no mandatory forms. You describe the trip you want, Wayfare asks a short set
of smart clarifying questions to fill the gaps, then a planning agent scours real price
listings and assembles an itinerary that fits your dates, budget, pace, and taste. From
there you keep chatting to refine it — _"make it cheaper," "swap the hotel for something
nearer the beach," "add a day trip to Hydra"_ — and only the affected parts re-plan.

---

## Who it's for

Budget-conscious travelers who want a great trip without doing the research grind —
students stretching a tight budget, couples and friends planning a getaway, families
who don't want to juggle twelve browser tabs. Wayfare is money-aware by default: the
running total and the tradeoffs behind it are always visible and honest.

## The core loop

1. **Prompt in** — You type where/what you want in free text. No forms.
2. **Clarify** — Wayfare extracts what it can, then asks _only_ the missing
   high-leverage questions (dates & flexibility, budget, travelers, origin, vibe,
   must-haves). Minimal friction — never an interrogation.
3. **Scour** — The planning agent searches real listings for flights, stays, and
   activities, comparing options against your constraints.
4. **Assemble** — It returns a full itinerary: flights, lodging, a day-by-day plan,
   and a transparent running budget with price sources.
5. **Refine** — You chat to adjust; the agent re-plans only the affected parts.

## Status

**MVP is built end-to-end** (Phase 1 complete). The monorepo is live: `@wayfare/shared`
(the wire contract), the API server (planning agent + global mock provider), and the
azure/Layla web client (marketing landing + `/pricing` showcase + conversational planner).
Email+password auth (guest-first, cookie sessions) is wired. Everything runs on **mock
pricing data** behind a clean integration interface; real providers swap in next without
touching the agent or UI. Scope is **global** from day one (see the two-tier mock strategy in
[INTEGRATIONS.md](./INTEGRATIONS.md)). For a fast onboarding brief, read
[SESSION_HANDOFF.md](./SESSION_HANDOFF.md).

## How to run it

```bash
# 1. Install (pnpm workspaces, Node 20+)
corepack enable && pnpm install
pnpm -r build                          # build packages (shared first)

# 2. Web only, mock-driven (no server, no keys) — default in dev
pnpm --filter web dev                  # http://localhost:5173 (MSW replays fixtures)

# 3. Full stack — web talks to the live API
pnpm --filter @wayfare/server dev      # http://localhost:3000 (no key required to boot)
VITE_USE_MOCKS=0 pnpm --filter web dev # web → Vite proxy → :3000
```

The server boots and plans with the **deterministic mock planner** with no env at all.
Set `ANTHROPIC_API_KEY` (optionally `PLANNER_MODE=agent`) to run the live `claude-opus-4-8`
tool-use loop. Keys live only on the server (NFR-4); copy `apps/server/.env.example` →
`apps/server/.env`. Real pricing providers are opt-in per [INTEGRATIONS.md](./INTEGRATIONS.md).

## The docs

| Doc | What's in it |
|-----|--------------|
| [VISION.md](./VISION.md) | Product vision, target user, value prop, worked example journeys |
| [REQUIREMENTS.md](./REQUIREMENTS.md) | Functional & non-functional requirements as user stories; out-of-scope |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, tech stack & reasoning, request lifecycle |
| [CONVERSATION_FLOW.md](./CONVERSATION_FLOW.md) | Prompt parsing, clarifying questions, the refine loop, example dialogues |
| [DATA_MODEL.md](./DATA_MODEL.md) | Core entities, fields, and relationships |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | Pricing data sources, honest tradeoffs, the provider interface, mock strategy |
| [AGENT_DESIGN.md](./AGENT_DESIGN.md) | The planning agent: tools, scour/rank loop, optimization, partial re-planning |
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Visual direction, key screens, component inventory, feel |
| [ROADMAP.md](./ROADMAP.md) | Phased milestones: MVP → v1 → later |
| [API_CONTRACT.md](./API_CONTRACT.md) | **Frozen** FE↔BE wire contract: endpoints, SSE protocol, errors |
| [AUTH_CONTRACT.md](./AUTH_CONTRACT.md) | **Frozen** auth wire: email+password, guest-optional cookie sessions |
| [design/](./design) | Implementation-ready design package (tokens, components, screens, landing, voice) |
| [fixtures/](./fixtures) | Canonical JSON payloads both sessions build against |
| [SESSION_HANDOFF.md](./SESSION_HANDOFF.md) | **Start here** — onboarding brief for the next session: state, run, gotchas, what's next |
| [BACKEND_BRIEF.md](./BACKEND_BRIEF.md) | Scoped kickoff brief for the backend session |
| [FRONTEND_BRIEF.md](./FRONTEND_BRIEF.md) | Scoped kickoff brief for the frontend session |

## Design principles

- **Prompt-first, minimal friction.** Conversation is the interface. Forms are a last resort.
- **Pricing realism.** Real pricing is the hard part. Degrade gracefully (mock → real),
  and _always_ show the source and freshness of a price.
- **Budget-aware & honest.** The running total and its tradeoffs are always visible.
- **Re-planning is cheap.** A refinement touches only the affected parts of the trip.
- **Keys stay server-side.** Pricing and model keys never reach the client.
- **Guest-first.** Auth is optional and additive — the planner is never gated behind login.
