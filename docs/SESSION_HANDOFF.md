# Session handoff — start here

A crisp onboarding brief so the next session can get productive in minutes. For the deep
specs, follow the links into the rest of `/docs`.

## What Wayfare is

A trip planner that turns **one sentence** ("a relaxed 8-day beach trip in Greece in late
August for two, ~€2,500") into a complete, costed, day-by-day itinerary you refine by
chatting — with every price showing its source + freshness and the running budget always on
the table.

## Current state — what's built & working

The MVP is implemented end-to-end (Phase 1 in [ROADMAP.md](./ROADMAP.md)) and the two apps
are wired together.

- **Shared contract** (`@wayfare/shared`) — TS types + Zod schemas for the entire wire
  (`Trip`/`Itinerary`/`Listing`/`Budget`/SSE events/auth). The single source of truth.
- **API server** (`@wayfare/server`) — session state, the planning agent, the mock provider,
  and auth routes. Boots with **no env**.
  - **Planner has two modes** (`apps/server/src/config.ts`): a **deterministic, seeded mock
    planner** (default, offline, repeatable) and the **live `claude-opus-4-8` tool-use loop**
    (only when `ANTHROPIC_API_KEY` is set, or `PLANNER_MODE=agent`). `auto` picks the agent
    iff a key is present.
  - **Global mock provider** — two tiers (`apps/server/src/integrations`): curated hero
    destinations + a procedural generator for everywhere else; deterministic per
    (destination, dates, party).
- **Web client** (`apps/web`) — the azure/Layla design system (white-dominant, sky-azure
  `#2F80ED`, photo-rich). Three routes via a tiny history-API router (`lib/router.ts`, no
  router dep — see `App.tsx`):
  - **`/` — marketing landing** (`components/landing/Landing.tsx`): Hero (a *live prompt box*,
    not just a button) → Where to go → value cards → all-in-one → trip types → **low pricing**
    → **past trips** → partners/press → testimonials → FAQ → footer. **Minimal nav, explored
    by scroll** (no jump-tabs; logo + section links route home from any page).
  - **`/pricing`** (`components/pricing/PricingPage.tsx`): a cheapest-trips showcase; tapping
    a card seeds the planner (`planHref({ seed, autostart })`) and auto-starts.
  - **`/plan` (+ `/plan/:type`) — the planner**: prompt → clarifying cards → streamed agent
    status → itinerary + budget panel → refine chat. Streams over SSE.
- **Auth** — email+password, **guest-first** (cookie sessions). The `AuthModal` opens from the
  TopBar; logged-out shows Log in / Sign up, logged-in shows an avatar menu. See
  [AUTH_CONTRACT.md](./AUTH_CONTRACT.md). Stores are in-memory (swap to a DB later).
- **Imagery is frontend-supplied** (`apps/web/src/lib/images.ts`) — the wire carries no image
  fields.

## Repo / monorepo layout

```
wayfare/                      pnpm workspaces · Node 20+ · TypeScript everywhere
├── docs/                     authoritative specs (this folder) + design/ + fixtures/
├── packages/
│   └── shared/               @wayfare/shared — TS types + Zod schemas (THE wire contract)
└── apps/
    ├── server/               @wayfare/server — API + planning agent + mock integrations + auth
    │   src/agent/            planner, agent loop, tools, refine, clarify, merge
    │   src/integrations/     mock provider (curated/ + mock/), provider interface, composite
    │   src/auth/             userStore, sessionStore, password (bcrypt), cookies, routes
    │   src/session/          in-memory trip/session store + versioning
    └── web/                  React + Vite + Tailwind + Framer Motion; Zustand + React Query
        src/components/landing/   marketing sections
        src/components/pricing/   /pricing page
        src/components/            planner UI (Planner, ItineraryPanel, BudgetPanel, …)
        src/lib/               router, images, api, sse, content, format, motion
        src/store/             session.ts, auth.ts (Zustand)
        src/mocks/             MSW handlers + fixtures (mock-mode wire replay)
```

API on `:3000`, web on `:5173` (Vite proxies `/api` → `:3000`).

## How to run

```bash
corepack enable && pnpm install
pnpm -r build                          # build packages (shared first)

# Web only, mock-driven — no server, no keys (MSW replays docs/fixtures)
pnpm --filter web dev                  # http://localhost:5173

# Full stack — web hits the live API
pnpm --filter @wayfare/server dev      # http://localhost:3000  (boots with NO env)
VITE_USE_MOCKS=0 pnpm --filter web dev # web → Vite proxy → :3000

# Live agent (optional): set ANTHROPIC_API_KEY in apps/server/.env, then
PLANNER_MODE=agent pnpm --filter @wayfare/server dev
```

Checks: `pnpm -r typecheck` · `pnpm -r test`. The JSON in [fixtures/](./fixtures) are golden
tests — schemas/endpoints must serialize to exactly those shapes.

- **`VITE_USE_MOCKS`** (web): default on in dev, off in prod. `0`/`false` → hit the live API.
- **Backend needs no key** to run the deterministic planner. `ANTHROPIC_API_KEY` is
  **optional** and only enables the live agent. Keys live server-side only (NFR-4).

## The contract-first rule (non-negotiable)

**`@wayfare/shared` is the single source of truth for the wire.** Both apps import it; neither
invents fields.

- Web imports wire types from `@wayfare/shared` via the `@/types` barrel. **There is no local
  mirror** (`wire.ts` was deleted). Never redefine a wire shape in `apps/web`.
- To change the wire: edit `packages/shared` **+** [API_CONTRACT.md](./API_CONTRACT.md) /
  [AUTH_CONTRACT.md](./AUTH_CONTRACT.md) **+** the fixtures, together — then both apps follow.

## Key gotchas & lessons (read before touching the frontend)

1. **The "disappearing UI" bug — critical content must render VISIBLE BY DEFAULT.** Do **not**
   gate load-bearing content behind `opacity: 0` Framer Motion entrance animations. Under
   React StrictMode (or a paused/backgrounded tab) the staggered-entrance orchestration
   (`staggerChildren`) can stall, leaving cards/itinerary items frozen near `opacity: 0` —
   i.e. an invisible page. Animate *enhancements*, not visibility. The landing/pricing cards
   render solid by default and only add a subtle hover lift.
2. **StrictMode is intentionally removed** in `apps/web/src/main.tsx` for exactly that reason
   (its dev-only double-mount triggered the stall). It's a no-op in prod, so removing it makes
   dev match prod. Don't re-add it without re-checking the entrance animations.
3. **Auth is guest-first / optional — never gate the planner.** A guest is just "no valid
   session cookie"; `GET /api/auth/me` returns `{ user: null }` with **200** (not 401). Auth
   only personalizes the TopBar. No auth middleware on `/api/session*`.
4. **Imagery is frontend-supplied** via `lib/images.ts` — the swap-seam for a real provider
   `imageUrl`. The wire carries **no** image fields; do not add one to `@wayfare/shared`, the
   server, or the fixtures. When the backend later supplies `imageUrl`, only `images.ts` + its
   call sites change; components stay identical.
5. **The repo is PRIVATE.** Contributions need the GitHub **"Private contributions"** profile
   toggle enabled for them to show up.
6. **Push only when the user explicitly says so** (that turn). Commit locally; never `git
   push` on your own initiative.
7. **Where the docs live:** everything is under `/docs`. Specs in the top level, the
   implementation-ready design package in [design/](./design), golden payloads in
   [fixtures/](./fixtures). Index: [docs/README.md](./README.md).

## What's next

- **v1 — real pricing providers** behind the existing provider interface (`PricingProvider` /
  `CompositeProvider`), one category at a time (flights first via Amadeus), with mock fallback
  and honest source/freshness labels. Swapping mock→real must require no agent or UI change.
- **Saved trips for logged-in users** — persist the in-memory user/session/trip stores to a
  real DB; saving a planned trip makes the landing's **"Past trips"** section real.
- **Later:** interactive map, PDF/offline export, i18n, booking hand-off (affiliate deep
  links). See [ROADMAP.md](./ROADMAP.md) and [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §3.
