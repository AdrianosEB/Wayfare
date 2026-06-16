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

**Phase 0 — specs.** This `/docs` folder is the product and engineering spec. No
application code exists yet. The MVP will run entirely on **mock pricing data** behind a
clean integration interface, then swap in real providers without touching the agent or
UI. Scope is **global** from day one (see the two-tier mock strategy in
[INTEGRATIONS.md](./INTEGRATIONS.md)).

## How to run it (once built)

> Placeholder — the scaffold lands in Phase 1. Expected shape:

```bash
# 1. Install
npm install

# 2. Configure — server-side keys only, never exposed to the client
cp .env.example .env        # ANTHROPIC_API_KEY, provider keys (optional in mock mode)

# 3. Run the API server + web client (mock pricing by default)
npm run dev

# Open http://localhost:5173
```

Mock mode requires only `ANTHROPIC_API_KEY`. Real pricing providers are opt-in per
[INTEGRATIONS.md](./INTEGRATIONS.md).

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
| [fixtures/](./fixtures) | Canonical JSON payloads both sessions build against |
| [BACKEND_BRIEF.md](./BACKEND_BRIEF.md) | Scoped kickoff brief for the backend session |
| [FRONTEND_BRIEF.md](./FRONTEND_BRIEF.md) | Scoped kickoff brief for the frontend session |

## Design principles

- **Prompt-first, minimal friction.** Conversation is the interface. Forms are a last resort.
- **Pricing realism.** Real pricing is the hard part. Degrade gracefully (mock → real),
  and _always_ show the source and freshness of a price.
- **Budget-aware & honest.** The running total and its tradeoffs are always visible.
- **Re-planning is cheap.** A refinement touches only the affected parts of the trip.
- **Keys stay server-side.** Pricing and model keys never reach the client.
