# @wayfare/shared

The **single source of truth** for the Wayfare wire contract: TypeScript types + Zod schemas
that serialize to exactly the JSON in [`docs/API_CONTRACT.md`](../../../docs/API_CONTRACT.md)
and [`docs/fixtures/`](../../../docs/fixtures). Imported verbatim by both the API server
(which produces these shapes) and the web client (which renders them).

> **Change control:** do not invent or rename a wire field here. Any contract change is a PR
> to `API_CONTRACT.md` + this package + the fixtures, announced to both sessions. See the
> backend brief.

## Layout

| Module | Contents |
|---|---|
| `common` | `Money`, `Tracked<T>`, `FieldSource` |
| `listing` | `Listing` (the uniform priced unit), `PriceSource`, `Freshness` |
| `request` | `TripRequest` (constraints), `ClarifyQuestion` |
| `trip` | `Trip`, `Itinerary`, `Day`, `ItineraryItem`, `Flight`, `Stay`, `Activity`, … |
| `budget` | `Budget`, `BudgetLine`, `SavingHint` |
| `refinement` | `RefinementScope`, `ItemDiff` |
| `session` | `Session`, `TripVersion`, `RefinementRecord` |
| `api` | request/response schemas for every endpoint + the uniform error shape |
| `sse` | the `status` / `partial` / `assumption` / `message` / `complete` / `error` events |

Every domain object is `.strict()` — unknown keys are rejected, so schema drift surfaces in
tests rather than on the wire. `TripPatch` (the `partial` SSE payload) is intentionally
permissive: patches are for perceived progress only; the `complete` event is authoritative.

## Usage

```ts
import { TripSchema, type Trip, SessionCreateResponseSchema } from "@wayfare/shared";

const trip: Trip = TripSchema.parse(payload); // throws on any contract violation
```

## Scripts

```bash
pnpm --filter @wayfare/shared build      # tsc → dist/
pnpm --filter @wayfare/shared typecheck  # tsc --noEmit
pnpm --filter @wayfare/shared test       # vitest — golden conformance vs. the fixtures
```

`test/fixtures/` mirrors `docs/fixtures/` verbatim and is kept in lockstep; the conformance
suite parses each fixture against the schemas so any divergence fails CI.
