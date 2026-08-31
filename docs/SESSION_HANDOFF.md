# Session handoff — control brief (START HERE)

> **You are the next agent on Wayfare. Read this one doc and you can be productive in 5
> minutes.** It is self-contained; the previous session is gone. For deep specs, follow the
> links into the rest of `/docs`. Repo: `/Users/adrianosbotsios/Desktop/tripPlanner`, branch
> `main`.

---

## 1. What Wayfare is

Wayfare is an **AI trip planner**: you describe a trip in **one sentence** ("a relaxed 8-day
beach trip in Greece in late August for two, ~€2,500") and it returns a complete, **costed,
day-by-day itinerary** you then **refine by chatting** ("swap the hotel", "add a day trip") —
with the **running budget always visible** and every price showing its source + freshness. The
front door is one prompt box, not a form.

---

## 2. Current state — what's built & working

**The MVP is done end-to-end on mock data** (Phase 1 in [ROADMAP.md](./ROADMAP.md)); both apps
are wired together and everything is on `main`.

- **Monorepo** — pnpm workspaces, Node 20+, TypeScript for the app: `packages/shared`,
  `packages/orchestrator`, `packages/orchestrator-llm`, `apps/server`, `apps/web`; plus
  `training/` (Python 3.11 + MLX) for the model distillation.
- **Conversational planner, full loop** — prompt → clarifying questions → **SSE-streamed**
  agent progress → itinerary + budget panel → refine chat (partial re-plan + "what changed"
  diff + budget delta).
- **Global two-tier mock pricing provider** — curated hero destinations + a procedural
  generator for everywhere else; **deterministic/seeded** per (destination, dates, party).
- **Two planner modes** — a **deterministic mock planner** (default, offline, repeatable) and a
  **live `claude-opus-4-8` tool-use agent** that runs only when `ANTHROPIC_API_KEY` is set (or
  `PLANNER_MODE=agent`).
- **Marketing landing** (`/`) — azure/Layla design system (white-dominant, sky-azure `#2F80ED`,
  photo-rich). **Minimal nav, explored by scrolling**: hero (a live prompt box) → how it works →
  trip types → low pricing → past trips → testimonials → FAQ → footer. Plus a standalone
  **`/pricing`** cheapest-trips showcase (tapping a card seeds + auto-starts the planner).
- **Email + password auth, guest-first** — httpOnly cookie sessions, bcrypt hashing; opens from
  the TopBar; **never gates the planner**. Stores are in-memory. See
  [AUTH_CONTRACT.md](./AUTH_CONTRACT.md).
- **Imagery is frontend-supplied** via `apps/web/src/lib/images.ts` — the wire carries **no**
  image fields.
- **Agent orchestration, two implementations of one pipeline** — `packages/orchestrator` is a
  supervisor *pattern* in pure TypeScript (zod-only, no graph runtime): it fans out across
  flight × stay × date combinations, prunes branches against budget before expanding,
  cross-checks findings at the source, and re-prices the whole itinerary before surfacing it.
  It is the default and the fail-safe, and runs in the server as a background job over SSE
  (`POST /api/orchestrate` → `GET /api/orchestrate/:id/events`). `packages/orchestrator-llm` is
  the same pipeline with every agent a **real LLM agent** on a **10-node LangGraph
  `StateGraph`**, whose critic loops back to `planQueries` with widened breadth on failure;
  opt-in behind `WAYFARE_LLM_ORCHESTRATOR`, spend-capped, emitting the identical `PlanResult`.
  Bookings are staged as `requires_approval` intents — nothing books autonomously.
- **Persona distillation** (`training/`) — the `persona` agent distilled from a Claude teacher
  into a local **Qwen2.5-1.5B** via **LoRA on MLX**, with a stdlib-Python eval harness (schema
  validity, Spearman ρ / Kendall τ-b rank agreement, per-slice error vs. constant- and
  majority-class baselines). Read [`training/RESULTS.md`](../training/RESULTS.md) before
  touching it: round 1 failed and the write-up says exactly why.

---

## 3. How to run

```bash
corepack enable          # provides pnpm (pinned in package.json)
pnpm install
pnpm -r build            # build packages — shared first

# A) Web only, mock-driven — no server, no keys (MSW replays docs/fixtures)
pnpm --filter web dev                       # http://localhost:5173

# B) Full stack — web hits the live API
pnpm --filter server dev                    # http://localhost:3000  (boots with NO env)
VITE_USE_MOCKS=0 pnpm --filter web dev      # web → Vite proxy /api → :3000
```

**Switch to the live agent (optional):** copy `apps/server/.env.example` → `apps/server/.env`,
set `ANTHROPIC_API_KEY=…`, then run the server. `PLANNER_MODE` (in that `.env`) is `auto` |
`deterministic` | `agent` — `auto` uses the agent **iff a key is present**; `agent` without a
key throws; `deterministic` always uses the mock planner. Model defaults to `claude-opus-4-8`.

**Checks (run before declaring done):**

```bash
pnpm -r typecheck
pnpm -r test                # shared: fixture conformance · server: journeys/refine/HTTP/auth
pnpm --filter web build     # catch web type/build breaks
```

The JSON in [`docs/fixtures/`](./fixtures) are **golden tests** — schemas/endpoints must
serialize to exactly those shapes.

---

## 4. Repo map

```
wayfare/
├── docs/                         authoritative specs + design/ + fixtures/  (index: docs/README.md)
├── packages/
│   ├── shared/src/               @wayfare/shared — THE frozen wire contract (TS types + Zod)
│   │   common · listing · request · trip · budget · refinement · session · api · sse · auth
│   ├── orchestrator/             @wayfare/orchestrator — the deterministic supervisor (DEFAULT)
│   │   src/                      orchestrator · agents/ · providers/ · types · demo
│   │   bench/fanout.ts           the bounded-fan-out benchmark (see the package README)
│   └── orchestrator-llm/         @wayfare/orchestrator-llm — the same pipeline as LangGraph
│       src/                      graph · nodes · state · tools · prompts · model · budget ·
│                                 config · factory      (10 agent nodes + a widen step)
│       scripts/                  gen-persona-data.ts — teacher labelling for training/
├── training/                     Python 3.11 + MLX — persona distillation (Apple Silicon only)
│   RESULTS.md                    the written-up result: two rounds, incl. a failed one
│   train.sh · fuse.sh            LoRA train → fuse (⚠ --dequantize on a quantized base)
│   eval.py · arm_stats.py        the eval harness + per-arm stats (pure stdlib; `--self-test`)
└── apps/
    ├── server/src/               @wayfare/server — API + agent + mock integrations + auth
    │   index · app · config · errors · sse · dates · ids · rng
    │   routes/session.ts         the /api/session* endpoints
    │   agent/                     parse · clarify · merge · planner · agentLoop · tools ·
    │                              assemble · refine · resolve · run · budget · prompts
    │   integrations/             provider · composite · mockProvider · listingFactory ·
    │                              geo · costIndex · curated/ · mock/
    │   auth/                      userStore · sessionStore · password (bcrypt) · cookies · routes
    │   session/store.ts          in-memory trip/session store + versioning
    └── web/src/                  React + Vite + Tailwind + Framer Motion; Zustand + React Query
        App.tsx · main.tsx        tiny history-API router (no router dep) — see lib/router.ts
        types/index.ts            the @/types barrel → re-exports @wayfare/shared (NO local mirror)
        components/landing/       Hero · WhereToGo · ValueCards · AllInOne · TripTypeGrid ·
                                  LowPricing · PastTrips · LogoStrips · TestimonialCarousel ·
                                  FAQAccordion · SiteFooter · TopNav · TripCard · Landing
        components/pricing/       PricingPage.tsx
        components/               planner UI — Planner · ItineraryPanel · BudgetPanel ·
                                  DayTimeline · FlightCard · StayCard · ActivityItem ·
                                  AgentStatusLine · QuestionCardStack · RefineComposer ·
                                  SourceChip · Price · AuthModal · TopBar · …
        store/                    session.ts · auth.ts  (Zustand)
        lib/                      router · sse · api · images · content · format · motion ·
                                  mergePatch · cn
        mocks/                    MSW handlers + fixtures (mock-mode wire replay)
```

API on `:3000`, web on `:5173` (Vite proxies `/api` → `:3000`).

**Wire endpoints** (see [API_CONTRACT.md](./API_CONTRACT.md) / [AUTH_CONTRACT.md](./AUTH_CONTRACT.md)):
`POST /api/session` (parse + clarify) · `POST /api/session/:id/answers` (SSE, initial plan) ·
`POST /api/session/:id/refine` (SSE, partial re-plan) · `GET /api/session/:id` · auth:
`POST /api/auth/{signup,login,logout}` · `GET /api/auth/me`. SSE events: `status`, `partial`,
`assumption`, `message`, `complete`, `error`. The web client streams via `fetch` +
`ReadableStream` against the POST endpoints (no GET-stream endpoint in v1).

---

## 5. Rules & conventions you MUST follow

1. **NEVER `git push`** (or anything that publishes to GitHub) unless the user **explicitly
   says "push" in that same turn.** Commit locally only and hand the user the push command.
   This is a hard standing rule the user set — do not infer it from "I'm done."
2. **`@wayfare/shared` is the SINGLE SOURCE OF TRUTH for the FE↔BE wire.** Both apps import it
   (web via the `@/types` barrel — there is **no** local `wire.ts` mirror). To add/rename a
   field: change `packages/shared` **+** [API_CONTRACT.md](./API_CONTRACT.md) /
   [AUTH_CONTRACT.md](./AUTH_CONTRACT.md) **+** the fixtures **first**, together — then both
   apps follow. Never redefine a wire shape locally.
3. **Guest-first.** Auth is optional/additive; **never gate the planner behind login.** A guest
   is "no valid session cookie"; `GET /api/auth/me` returns `{ user: null }` with **200** (not
   401). No auth middleware on `/api/session*`.
4. **UI renders VISIBLE BY DEFAULT.** Do **not** gate load-bearing content behind `opacity: 0`
   Framer entrance animations — they can stall hidden (this caused the "disappearing UI" bug).
   Animate *enhancements*, not visibility. **StrictMode is intentionally omitted** in
   `apps/web/src/main.tsx` (its dev double-mount triggered the stall); don't re-add it without
   re-auditing entrance animations.
5. **Images are frontend-supplied** via `lib/images.ts`. The wire carries no image fields — do
   not add one to `@wayfare/shared`, the server, or the fixtures.
6. **Security invariants:** keys live **server-side only**; `compute_budget` is the **only**
   place totals are summed; **no password ever crosses the wire** (`User` has no password
   field); login **never reveals whether an email exists** (`invalid_credentials` either way).
7. **Price provenance:** never hardcode the word "mock" in the UI — render the `SourceChip` from
   `Listing.source` / `Listing.freshness` so the same component shows `"Amadeus · 2h ago"` later
   with zero changes.
8. **The repo is PRIVATE.** GitHub contributions only appear with the profile's **"Private
   contributions"** toggle enabled.

---

## 6. Known gotchas / lessons

- **Headless/background preview pauses ALL animations** (Framer *and* CSS), so any `opacity: 0`
  reading taken there is an **artifact**, not a real bug — verify visibility in a real
  foreground tab before "fixing" it.
- **Worktree-isolated subagents branch off `origin/main` (pushed state).** If you spawn one, it
  will **not** have your unpushed commits. Either push the relevant contract commits **before**
  spawning (only if the user authorized a push), or keep the work in this session.
- **Split parallel agents on clean boundaries only** — contracts or disjoint files. Keep coupled
  work (e.g. a single landing file) inside one agent to avoid merge thrash.
- **Stale worktrees exist** under `.claude/worktrees/` (`backend`, `frontend`, and a detached
  `friendly-shannon-78edda`) from earlier parallel sessions. They are not part of the live tree;
  ignore them unless the user asks to clean them up.
- **Stale dir to ignore:** `apps/server/src/integrations 2/` is an empty leftover (note the space
  in the name). The real code is in `apps/server/src/integrations/`.
- **Minor copy quirk:** the deterministic planner has a small "for you" vs. party-size wording
  inconsistency — noted for a later polish pass, not blocking.

---

## 7. What's next (Phase 2)

See [ROADMAP.md](./ROADMAP.md). Replace mock with real data **behind the same provider
interface** (`PricingProvider` / `CompositeProvider`), one category at a time, each with a mock
fallback and honest source/freshness labels — **no agent or UI change required**:

1. **Amadeus flights** behind `searchFlights` (test tier → prod) — lowest risk first.
2. Then **hotels** behind `searchStays`.
3. Then **activities** via Google Places / OSM behind `searchActivities`.

After pricing: **persistence / saved trips for logged-in users** — swap the in-memory
user/session/trip stores for a real DB; saving a planned trip makes the landing's "Past trips"
section real.

---

## 8. Repo / branch state

- Everything is on **`main`**, pushed to the **private** repo **`AdrianosEB/Trip-Planner`**.
- Stale worktrees (`backend`, `frontend`, `friendly-shannon-78edda`) linger under
  `.claude/worktrees/` — not the live tree (see §6).
- Working tree is clean at handoff time. Confirm with `git status` before starting.

---

### Where the rest of the docs live

Index: [docs/README.md](./README.md). Deep specs: [ARCHITECTURE.md](./ARCHITECTURE.md) ·
[API_CONTRACT.md](./API_CONTRACT.md) · [AUTH_CONTRACT.md](./AUTH_CONTRACT.md) ·
[DATA_MODEL.md](./DATA_MODEL.md) · [AGENT_DESIGN.md](./AGENT_DESIGN.md) ·
[CONVERSATION_FLOW.md](./CONVERSATION_FLOW.md) · [INTEGRATIONS.md](./INTEGRATIONS.md) ·
[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [ROADMAP.md](./ROADMAP.md) ·
[REQUIREMENTS.md](./REQUIREMENTS.md) · [VISION.md](./VISION.md). Implementation-ready design
package: [design/](./design). Golden payloads: [fixtures/](./fixtures).
</content>
</invoke>
