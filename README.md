# Wayfare

> **A trip planned for you from one sentence.**

Wayfare turns a single sentence ("a relaxed 8-day beach trip in Greece in late August for
two, ~€2,500") into a coherent, costed, day-by-day itinerary you refine by chatting — with
the price math always on the table. See [docs/VISION.md](docs/VISION.md).

## Monorepo layout

```
wayfare/
├── docs/               # authoritative specs (the frozen contract lives here)
├── packages/
│   ├── shared/         # @wayfare/shared — TS types + Zod schemas (the wire contract)
│   └── orchestrator/   # @wayfare/orchestrator — self-verifying multi-agent travel engine
└── apps/
    ├── server/         # @wayfare/server — API + planning agent + background orchestration
    └── web/            # React client (frontend session's lane)
```

- **pnpm workspaces, Node 20+, TypeScript everywhere.** API on `:3000`, web on `:5173`
  (proxies `/api` → `:3000`).
- `packages/shared` is the single source of truth for the wire — see
  [docs/API_CONTRACT.md](docs/API_CONTRACT.md). Both apps import it; neither invents fields.

## Quickstart

```bash
corepack enable                 # provides pnpm (pinned in package.json)
pnpm install
pnpm -r build                   # build packages (shared first)
pnpm --filter @wayfare/server dev   # API on http://localhost:3000  (no env required)
```

The server runs the **deterministic mock planner** by default — no API key needed to boot or
test. Set `ANTHROPIC_API_KEY` (and optionally `PLANNER_MODE`) to run the live
`claude-opus-4-8` tool-use loop. Keys live only on the server (NFR-4); copy
`apps/server/.env.example` → `apps/server/.env`.

## Checks

```bash
pnpm -r typecheck
pnpm -r test     # @wayfare/shared: fixture conformance · @wayfare/server: journeys, refine, HTTP
```

The fixtures in [docs/fixtures/](docs/fixtures) are golden tests: the schemas and endpoints
must serialize to exactly their shape.

## Status

> **New here (human or agent)? Start with the control brief:
> [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md)** — what Wayfare is, how to run it, the
> repo map, the non-negotiable rules, and what's next, in one self-contained doc.

MVP is implemented end-to-end and wired together (`VITE_USE_MOCKS=0` talks to the live API):

- **Backend** — the shared wire contract, the API, the planning agent (deterministic mock
  planner by default; live `claude-opus-4-8` tool-use loop when `ANTHROPIC_API_KEY` is set),
  and the global two-tier mock provider (curated + procedural).
- **Frontend** — the azure/Layla web client: a photo-rich marketing **landing** (Hero → how
  it works → trip types → low pricing → past trips → testimonials/FAQ/footer; minimal nav,
  explored by scroll), a standalone **/pricing** cheapest-trips showcase, and the
  conversational **planner** (prompt → clarify → stream → itinerary + budget → refine).
- **Auth** — email+password, **guest-first and optional** (cookie sessions); the planner is
  never gated. See [docs/AUTH_CONTRACT.md](docs/AUTH_CONTRACT.md).
- **Imagery** — frontend-supplied via `apps/web/src/lib/images.ts` (a swap-seam for a real
  provider `imageUrl` later); the wire carries no image fields.
- **Agent orchestration** ([`packages/orchestrator`](packages/orchestrator/README.md)) — the
  base for an AI-native travel agency: a supervisor fans async agents out across flight × stay
  × date combinations and prunes branches against budget before expanding; a verification layer
  cross-checks findings at the source and re-prices the full itinerary before surfacing
  confirmed, bookable options at the low end of the range. It runs as a **background job over
  SSE** in the server (`POST /api/orchestrate` → `GET /api/orchestrate/:id/events`). Bookings
  and hotel calls are staged as approval-required intents — nothing is booked autonomously.
  Implemented as a supervisor *pattern* in TypeScript (no LangGraph/Python).

Next: real pricing providers behind the provider interface, then saved trips for logged-in
users. See [docs/ROADMAP.md](docs/ROADMAP.md), [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md),
and the onboarding brief in [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md).
