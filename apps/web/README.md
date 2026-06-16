# @wayfare/web

The chat-first web client for Wayfare: prompt → clarifying cards → streaming itinerary +
running budget → refine. React + Vite + Tailwind + Framer Motion + TypeScript, in a pnpm
workspace. See [`docs/FRONTEND_BRIEF.md`](../../docs/FRONTEND_BRIEF.md) and
[`docs/DESIGN_SYSTEM.md`](../../docs/DESIGN_SYSTEM.md).

## Run

```bash
pnpm install
pnpm --filter web dev   # http://localhost:5173
```

Dev defaults to **MSW fixture mocks** (no backend needed) — it replays
[`docs/fixtures/`](../../docs/fixtures). Point at the live API instead with:

```bash
VITE_USE_MOCKS=0 pnpm --filter web dev   # /api/* proxied → http://localhost:3000
```

## How it's wired to stay swap-safe

- **Wire types** live behind one barrel: [`src/types`](./src/types/index.ts). It currently
  re-exports a local mirror ([`wire.ts`](./src/types/wire.ts)) of `packages/shared`. When
  the backend publishes the package, change that one line to
  `export * from '@wayfare/shared'` and delete `wire.ts`. Nothing else changes — every
  component imports from `@/types`.
- **All calls hit `/api`** ([`src/lib/api.ts`](./src/lib/api.ts)); the client holds no keys.
- **Streaming** uses `fetch` + `ReadableStream` (not `EventSource`, which is GET-only) and
  parses `event:`/`data:` frames in [`src/lib/sse.ts`](./src/lib/sse.ts), ignoring `:`
  heartbeats. `partial` patches are applied as RFC-7386 merge patches (arrays replace);
  `complete.trip` is authoritative.
- **Price provenance** is read from `Listing.source.label` + `Listing.freshness` in
  [`SourceChip`](./src/components/SourceChip.tsx) — the string "mock" is never hardcoded, so
  the same chip shows `Estimated price` now and `Amadeus · 2h ago` later.

## Structure

```
src/
  types/      wire types barrel (the swap point) + local mirror
  lib/        api, sse, mergePatch, format (tabular money), motion variants
  store/      zustand session store (stream glue) + theme
  mocks/      MSW handlers replaying the fixtures (dev only)
  components/ the DESIGN_SYSTEM component inventory
```
