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
│   └── shared/         # @wayfare/shared — TS types + Zod schemas (the wire contract)
└── apps/
    ├── server/         # @wayfare/server — API + planning agent + mock integrations
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

MVP is implemented end-to-end: the shared contract + API + planning agent + global mock
provider on the backend, and the azure/Layla web client (marketing landing + conversational
planner) on the frontend — wired together (`VITE_USE_MOCKS=0` talks to the live API). See
[docs/ROADMAP.md](docs/ROADMAP.md) and [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).
