# Frontend Session Brief

Paste this into the frontend session as its anchoring instructions. Read it fully before
writing code. If you've already started with a different stack, package manager, or your own
data types, **stop and align to this first** — it's cheap now.

## Your mission

Build the **chat-first web client** for Wayfare: prompt entry → clarifying-question cards →
streaming itinerary + running budget → refine chat. See
[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the visual language and component inventory.

## You own these (and only these)

- `apps/web/` — the entire React client.
- Components per [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md): `PromptInput`,
  `ExamplePromptChips`, `ChatThread`, `AgentStatusLine`, `QuestionCardStack` (+ inputs),
  `ItineraryPanel` (`FlightCard`/`StayCard`/`DayTimeline`/`ActivityItem`), `SourceChip`,
  `AssumptionsReveal`, `BudgetPanel`/`BudgetBar`/`BudgetLineRow`, `SavingHintChip`,
  `ChangedBadge`/`DiffHighlight`, `QuickRefineChips`.

## You must NOT

- Touch `apps/server/` or `packages/shared` (backend's lane). You **import** the shared
  types; you don't define them.
- Invent your own request/response or `Trip`/`Listing` shapes. The wire is frozen in
  [API_CONTRACT.md](./API_CONTRACT.md). If you need a field that isn't there, request a
  contract change — don't add it locally.
- Hardcode the string "mock" anywhere. Render price provenance from `Listing.source.label`
  + `Listing.freshness` so the same `SourceChip` shows `"Estimated price"` now and
  `"Amadeus · 2h ago"` later with zero changes.
- Put any API key in the client. The client only ever talks to our `/api`.

## Pinned decisions (do not re-litigate)

- **Stack:** React + Vite + Tailwind + Framer Motion. TypeScript.
- **Monorepo:** pnpm workspaces. Node 20+. You live in `apps/web`.
- **State:** React Query for server/stream state, Zustand (or context) for local UI state.
  No Redux. Server is the source of truth.
- **Ports/proxy:** Vite dev on `5173`; proxy `/api/*` → `http://localhost:3000` (configure
  in `vite.config.ts`). All calls go to `/api`.
- **Streaming:** the plan/refine endpoints are POST + SSE. Use `fetch` + `ReadableStream`
  to read the event stream (NOT `EventSource`, which is GET-only). Parse `event:`/`data:`
  frames per [API_CONTRACT.md](./API_CONTRACT.md); ignore `:` heartbeat lines.

## How to build before the backend exists

`packages/shared` is authored by the backend session first, but **you are not blocked.**

1. Build against the **fixtures** in [`docs/fixtures/`](./fixtures):
   - `session-create.response.json` — the `POST /api/session` response (extracted + clarify
     questions).
   - `sse-stream.example.txt` — the exact SSE frame sequence to parse and render
     progressively.
   - `trip-complete.json` — the full `Trip` your itinerary + budget must render.
   - `refine-complete.json` — a refinement result; render the `diff` as changed-item
     highlights + show `budgetDelta`.
2. Stand up a tiny local mock of the endpoints (MSW or a Vite middleware) that replays these
   fixtures, so you can build the whole UX without the server.
3. When `packages/shared` lands, switch your types to import from it and point calls at the
   real `/api`. Because you built to the fixtures, this should be a near-no-op.

## Conformance targets

- Every price renders a `SourceChip` (source + freshness). No unattributed numbers.
- The budget panel is always visible; total + category lines + under/on/over state +
  saving-hint chips; over-budget shows the overage + offered trims.
- Clarifying questions render as a batched card stack (≤4), each skippable showing its
  default; planning starts on submit/skip.
- Streaming UX: show `status` lines + progressively fill the itinerary from `partial`
  patches; never a blank spinner. `complete.trip` replaces the working copy.
- After a refine, mark changed items (`diff`) and show the budget delta.
- Responsive per DESIGN_SYSTEM (desktop split view; mobile stacked + sticky budget).

## Definition of done (MVP, your side)

1. Full loop works against the fixtures (and then the live API): prompt → cards → streamed
   plan → refine.
2. All components in the inventory exist and are theme-driven (light/dark), prices in
   tabular figures.
3. Swapping from fixtures to live `/api` + `packages/shared` requires no shape changes.
4. `pnpm --filter web dev` boots on `:5173` and proxies to the API.

## Read these (authoritative for you)

[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) · [API_CONTRACT.md](./API_CONTRACT.md) ·
[`docs/fixtures/`](./fixtures) · [CONVERSATION_FLOW.md](./CONVERSATION_FLOW.md) ·
[DATA_MODEL.md](./DATA_MODEL.md) (for field meanings) · [VISION.md](./VISION.md)
