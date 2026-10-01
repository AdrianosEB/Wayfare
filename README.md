# Wayfare

[![CI](https://github.com/AdrianosEB/Wayfare/actions/workflows/ci.yml/badge.svg)](https://github.com/AdrianosEB/Wayfare/actions/workflows/ci.yml)

Wayfare plans a trip from one sentence. Type something like "a relaxed 8-day beach trip in
Greece in late August for two, around €2,500" and you get a costed, day-by-day itinerary that
you can then adjust by chatting. The price breakdown stays visible the whole time.

The longer pitch is in [docs/VISION.md](docs/VISION.md).

## Repo layout

```
wayfare/
├── docs/                    # specs, including the frozen API contract
├── packages/
│   ├── shared/              # @wayfare/shared: TS types and Zod schemas for the wire format
│   ├── orchestrator/        # @wayfare/orchestrator: multi-agent travel engine that verifies its own results
│   └── orchestrator-llm/    # @wayfare/orchestrator-llm: the same pipeline as a LangGraph
│                            #   state graph with LLM agents (opt-in)
├── apps/
│   ├── server/              # @wayfare/server: API, planning agent, background orchestration
│   └── web/                 # React client
└── training/                # Python/MLX scripts that train the LoRA adapter for the local
                             #   1.5B persona model
```

The app is TypeScript on Node 20+ with pnpm workspaces. The model training in `training/` is
Python 3.11 with MLX. The API runs on `:3000` and the web client on `:5173`, which proxies
`/api` to `:3000`.

`packages/shared` defines the wire format, and both apps import it instead of declaring their
own fields. See [docs/API_CONTRACT.md](docs/API_CONTRACT.md).

## Quickstart

```bash
corepack enable                     # provides pnpm (pinned in package.json)
pnpm install
pnpm -r build                       # builds the packages, shared first
pnpm --filter @wayfare/server dev   # API on http://localhost:3000, no env needed
```

By default the server uses a deterministic mock planner, so it boots and passes its tests with
no API key, offline and at no cost. To run the live `claude-opus-4-8` tool-use loop, copy
`apps/server/.env.example` to `apps/server/.env` and set `ANTHROPIC_API_KEY` (and `PLANNER_MODE`
if you want to force a mode). Keys stay on the server and are never sent to the client.

### Running everything on one server

```bash
pnpm serve                          # builds everything, then serves on http://localhost:3000
```

This serves the built SPA and `/api` from a single Node process, with no Vite, proxy, or CORS
involved. Use `PORT=8080 pnpm serve` to change the port. The production build turns the MSW
fixture mocks off, so the browser talks to the real API.

`GET /api/health` returns `{ status, planner }`, which tells you whether the deterministic or
the live planner is active. It is worth checking before you send real traffic.

For frontend work, `pnpm dev` is still the better loop because Vite gives you HMR. The
single-server mode is for checking the real wiring and for deployment.

## Checks

```bash
pnpm -r typecheck
pnpm -r test
```

The tests cover fixture conformance in `@wayfare/shared` and journeys, refine, and HTTP in
`@wayfare/server`. The fixtures in [docs/fixtures/](docs/fixtures) are golden tests: the
schemas and endpoints have to serialize to exactly that shape.

## Status

If you are new to the repo, read [docs/SESSION_HANDOFF.md](docs/SESSION_HANDOFF.md) first. It
covers what Wayfare is, how to run it, where things live, the rules that can't be broken, and
what comes next.

The MVP works end to end. Setting `VITE_USE_MOCKS=0` makes the web client talk to the live API.

### Backend

The shared wire contract, the API, and the planning agent are in place. The planner is the
deterministic mock unless `ANTHROPIC_API_KEY` is set, in which case it runs the live
`claude-opus-4-8` tool-use loop. Prices come from a global two-tier mock provider (curated and
procedural).

### Frontend

The web client has three parts:

- A marketing landing page with a lot of photography and minimal navigation, meant to be
  scrolled through: hero, how it works, trip types, pricing, past trips, testimonials, FAQ.
- A standalone `/pricing` page showing the cheapest trips.
- The conversational planner: prompt, clarifying questions, streamed itinerary with budget,
  then refinement.

Images are supplied by the frontend through `apps/web/src/lib/images.ts`. The wire format has
no image fields, so a real provider `imageUrl` can be swapped in there later.

### Auth

Email and password with cookie sessions. Signing in is optional and the planner is never gated
behind it, so guests can use everything. See [docs/AUTH_CONTRACT.md](docs/AUTH_CONTRACT.md).

### Agent orchestration

[`packages/orchestrator`](packages/orchestrator/README.md) is the base for the travel-agency
side of the product. A supervisor fans async agents out across combinations of flights, stays,
and dates, and prunes branches that exceed the budget before expanding them. A verification
layer then checks the findings against the source and re-prices the full itinerary. Only
confirmed, bookable options at the low end of the range are shown.

It runs in the server as a background job over SSE (`POST /api/orchestrate`, then
`GET /api/orchestrate/:id/events`). Bookings and hotel calls are staged as intents that need
approval, so nothing is booked automatically.

This package is plain TypeScript with zod and no graph runtime. It is the default path and the
fallback.

### The LangGraph path

[`packages/orchestrator-llm`](packages/orchestrator-llm/README.md) is the same pipeline with
every agent backed by an LLM, wired as a LangGraph `StateGraph` with 10 agents:

```
intake, persona, planQueries, search, verify, match, supervisor, select, reprice, critic
```

There is also a `widen` step on the retry edge that is not an agent, which makes 11 nodes. When
the critic rejects a result, its conditional edge loops back to `planQueries` with a wider
search. That cycle over changing state is the reason this is a graph and not a chain.

Every node follows one rule: the agent decides and a tool computes. No model does arithmetic or
ranking itself. It calls a tool exported from `@wayfare/orchestrator`.

This path is opt-in behind `WAYFARE_LLM_ORCHESTRATOR`, has a hard spending cap, and emits the
same `PlanResult` as the default path.

### Local LoRA model

The `persona` agent, which turns a traveller's free-text preferences into weights the rest of
the pipeline uses, can run on a small local model in place of Claude. The model is
Qwen2.5-1.5B fine-tuned with a LoRA adapter using MLX, and it exists to cut inference cost: it
runs on your own machine and needs no API key.

Serve it with `pnpm serve:student`, then set `WAYFARE_LOCAL_MODEL_URL` to that server. When the
variable is unset, the agent uses Anthropic as usual. The scripts that train and fuse the
adapter are in [`training/`](training/README.md).

## What's next

Real pricing providers behind the provider interface, then saved trips for logged-in users. See
[docs/ROADMAP.md](docs/ROADMAP.md) and [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).
