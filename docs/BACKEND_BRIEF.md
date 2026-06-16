# Backend Session Brief

Paste this into the backend session as its anchoring instructions. Read it fully before
writing code. If you've already started and made different choices (npm, a different folder
layout, your own type definitions), **stop and align to this first** — it's cheap now.

## Your mission

Build the **API server + planning agent + integration layer** for Wayfare, and — first —
the shared types package both sessions depend on.

## You own these (and only these)

- `packages/shared/` — **author this FIRST, before anything else.** TypeScript types + Zod
  schemas that serialize exactly to [API_CONTRACT.md](./API_CONTRACT.md). This is the
  single source of truth the frontend imports. Commit/publish it early so the frontend can
  switch from fixtures to real imports.
- `apps/server/` — the API:
  - `agent/` — the four-tool plan loop (`search_flights`, `search_stays`,
    `search_activities`, `compute_budget`), scour→rank→assemble, bounded. See
    [AGENT_DESIGN.md](./AGENT_DESIGN.md).
  - `integrations/` — the `PricingProvider` interface + **mock provider (both tiers:
    curated + procedural)**. See [INTEGRATIONS.md](./INTEGRATIONS.md). MVP is mock-only.
  - `session/` — in-memory session store + trip versioning.
  - The HTTP layer implementing every endpoint in [API_CONTRACT.md](./API_CONTRACT.md),
    including the SSE streams.

## You must NOT

- Touch `apps/web/` (frontend's lane).
- Invent or rename any field in the wire contract unilaterally. Contract changes go through
  [API_CONTRACT.md](./API_CONTRACT.md) first, then `packages/shared`, then a heads-up to the
  frontend session.
- Call any real pricing provider in MVP — mock only, behind the interface.
- Put any API key anywhere but the server env. Never expose keys to the client.

## Pinned decisions (do not re-litigate)

- **Monorepo:** pnpm workspaces. Node 20+. TypeScript everywhere.
- **Layout:** `packages/shared`, `apps/web`, `apps/server` (see ARCHITECTURE.md).
- **Server framework:** Express or Fastify (your call) + **Zod** for all request/response &
  tool I/O validation.
- **Ports:** API on `3000`. (Web is `5173` and proxies `/api` → `3000`.)
- **Model:** Anthropic API, `claude-opus-4-8` (or a faster Claude tier if latency demands),
  tool-use loop. Key via `ANTHROPIC_API_KEY` server-side.
- **Mock mode is the default run mode** and must be deterministic/seeded (NFR-6) so the
  frontend's fixtures and your output match for the same inputs.

## Conformance targets

- The JSON your endpoints emit must match the fixtures in [`docs/fixtures/`](./fixtures)
  byte-for-shape (same fields, same nesting). Treat those fixtures as golden tests.
- SSE: emit the exact event names and payloads in [API_CONTRACT.md](./API_CONTRACT.md)
  (`status`, `partial`, `assumption`, `message`, `complete`, `error`). End with `complete`
  carrying the full `Trip`.
- Honesty: every `Listing` carries `source` + `freshness`; in MVP all are `mock`. Never
  label a mock price as live. `compute_budget` is the only place totals are summed.
- Bounded agent loop (max turns / tool calls); graceful provider fallback → `degraded`.

## Definition of done (MVP, your side)

1. `packages/shared` published and importable; matches API_CONTRACT + DATA_MODEL.
2. All endpoints implemented; responses match the fixtures.
3. Mock provider returns coherent, deterministic results for **any** destination (curated
   hero set + procedural generator).
4. The three VISION.md journeys plan end-to-end; a lodging refinement re-plans only the
   lodging slice and returns a correct `diff` + `budgetDelta`.
5. `pnpm --filter server dev` boots on `:3000`; `ANTHROPIC_API_KEY` is the only required env.

## Read these (authoritative for you)

[API_CONTRACT.md](./API_CONTRACT.md) · [DATA_MODEL.md](./DATA_MODEL.md) ·
[AGENT_DESIGN.md](./AGENT_DESIGN.md) · [INTEGRATIONS.md](./INTEGRATIONS.md) ·
[ARCHITECTURE.md](./ARCHITECTURE.md) · [CONVERSATION_FLOW.md](./CONVERSATION_FLOW.md)
