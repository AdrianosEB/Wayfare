# I/O Contract (frontend ⇄ server)

**The exact shape of everything in and out of the API.** This is the frontend-facing view of
[../API_CONTRACT.md](../API_CONTRACT.md), pinned to the concrete `@wayfare/shared` type names
you import. If a type isn't here, it isn't part of the wire — don't invent it.

## The one rule

> **All wire types come from `@wayfare/shared`, imported via the `@/types` barrel.**
> There is no local copy. `apps/web/src/types/wire.ts` was deleted; `@/types` re-exports
> `@wayfare/shared`. To add/rename a field: change `packages/shared` + `API_CONTRACT.md` +
> the fixtures — never patch it locally.

```ts
import type { SessionCreateResponse, Trip, Budget, SseEvent } from '@/types';
```

`@wayfare/shared` ships **Zod schemas + types**. Use the schema to validate at the boundary,
the type to render:

```ts
import { SessionCreateResponseSchema } from '@wayfare/shared';
const data = SessionCreateResponseSchema.parse(await res.json()); // typed + validated
```

---

## Endpoints — request in / response out

| # | Method · Path | Request body type | Response type |
|---|---|---|---|
| 1 | `POST /api/session` | `SessionCreateRequest` `{ prompt: string }` | `SessionCreateResponse` |
| 2 | `POST /api/session/:id/answers` | `AnswersRequest` `{ answers, skipped }` | **SSE stream** of `SseEvent` → ends in `complete` |
| 3 | `POST /api/session/:id/refine` | `RefineRequest` `{ utterance: string }` | **SSE stream** of `SseEvent` → ends in `complete` |
| 4 | `GET /api/session/:id` | — | `SessionStateResponse` |
| — | any error (non-2xx JSON) | — | `ApiError` |

**`SessionCreateResponse`** = `{ sessionId: string; extracted: TripRequest;
clarifyQuestions: ClarifyQuestion[]; agentMessage: string }`.

**`SessionStateResponse`** = `{ sessionId; request: TripRequest; currentVersion: number;
trip: Trip; versions: VersionSummary[] }`.

---

## `AnswersRequest` — the answer value shapes

```ts
type AnswersRequest = {
  answers: Record<string /* ClarifyQuestion.id */, AnswerValue>;
  skipped: string[]; // question ids the user skipped
};
```

`AnswerValue` depends on the question's `format` (`ClarifyQuestion.format`):

| `format` | `AnswerValue` (shared type) | Example |
|---|---|---|
| `chips` / `city` / `text` | `string` | `"London"` |
| `multiselect` | `string[]` | `["beach","food"]` |
| `stepper` | `PartySize` `{ adults; children?; childAges? }` | `{ adults: 2 }` |
| `currency` | `Money` `{ amount; currency }` | `{ amount: 600, currency: "EUR" }` |

---

## SSE — the streaming output (endpoints 2 & 3)

Consume with `fetch` + `ReadableStream` (POST → **not** `EventSource`). `parseSseStream`
(`lib/sse.ts`) yields the discriminated union **`SseEvent`** = `{ event, data }`. Switch on
`event`; `data` is then fully typed:

```ts
for await (const ev of parseSseStream(res, signal)) {
  switch (ev.event) {
    case 'status':     ev.data; /* StatusEventData     { step: AgentStep; message } */ break;
    case 'partial':    ev.data; /* PartialEventData    { patch: TripPatch }          */ break;
    case 'assumption': ev.data; /* AssumptionEventData = Assumption                  */ break;
    case 'message':    ev.data; /* MessageEventData    { text }                      */ break;
    case 'complete':   ev.data; /* CompleteEventData   { trip; version; refinement? }*/ break;
    case 'error':      ev.data; /* ErrorEventData      { code; message; degraded? }  */ break;
  }
}
```

| `event` | `data` type | Meaning |
|---|---|---|
| `status` | `StatusEventData` `{ step: AgentStep; message }` | progress line. `AgentStep` ∈ resolve · search_flights · search_stays · search_activities · compute_budget · assemble |
| `partial` | `PartialEventData` `{ patch: TripPatch }` | JSON-merge-patch onto the working `Trip` (progress only; arrays replace) |
| `assumption` | `AssumptionEventData` (= `Assumption`) | a default the agent took |
| `message` | `MessageEventData` `{ text }` | free-text agent message (info refinements, summaries) |
| `complete` | `CompleteEventData` `{ trip: Trip; version: number; refinement?: RefinementRecord }` | **authoritative** final trip; replaces working copy. On refine, `refinement` holds the diff + delta |
| `error` | `ErrorEventData` `{ code: ErrorCode; message; degraded?: true }` | mid-stream error; if `degraded`, plan still completes with labeled estimates |

**`TripPatch` is intentionally loose** (`Record<string, unknown>`) — patches drive perceived
progress; the `complete.trip` is the source of truth and must replace whatever patches
accumulated. Never validate working state against patches for correctness.

**`RefinementRecord`** = `{ utterance: string; scope: RefinementScope; diff: ItemDiff[];
budgetDelta: number }` — drives the "what changed" highlight + budget delta.

---

## Errors — `ApiError`

```ts
type ApiError = { error: { code: ErrorCode; message: string; details?: unknown } };
```

`ErrorCode` ∈ `invalid_request` (400) · `session_not_found` (404) · `not_ready` (409) ·
`unplannable` (422) · `rate_limited` (429) · `internal` (500). Mid-stream failures arrive as
an SSE `error` event, not an HTTP status (the stream already returned 200).

---

## Core render types (all from `@wayfare/shared`)

You'll mostly render these — see [COMPONENTS.md](./COMPONENTS.md) for which component owns each:

`Trip` · `TripRequest` (`Tracked<T>` fields) · `Itinerary` · `Day` · `ItineraryItem` ·
`Flight` · `Stay` · `Activity` · `Listing` (+ `PriceSource`, `Freshness`) · `Money` ·
`Budget` (+ `BudgetLine`, `BudgetCategory`, `BudgetStatus`, `SavingHint`) · `Assumption` ·
`ClarifyQuestion` (+ `ClarifyFormat`, `ClarifyOption`) · `ItemDiff` · `RefinementScope`.

**Every price is a `Listing`** — always render its `source` + `freshness` via `SourceChip`
(read the fields; never hardcode "Estimated"). That's the honesty contract.

---

## Migration note (old → new names)

The frontend's deleted `wire.ts` spelled some types differently. If you find a lingering old
name, this is the mapping to the canonical `@wayfare/shared` name:

| Old (wire.ts) | Canonical (`@wayfare/shared`) |
|---|---|
| `CreateSessionRequest` | `SessionCreateRequest` |
| `CreateSessionResponse` | `SessionCreateResponse` |
| `DateConstraint` | `TripDates` |
| `Refinement` | `RefinementRecord` |
| `QuestionFormat` | `ClarifyFormat` |
| `StatusStep` | `AgentStep` |
| `CurrencyAnswer` | `Money` |
| `StepperAnswer` | `PartySize` |
| `SseStatus` / `SsePartial` / `SseComplete` / `SseAssumption` / `SseMessage` / `SseErrorData` | `StatusEventData` / `PartialEventData` / `CompleteEventData` / `AssumptionEventData` / `MessageEventData` / `ErrorEventData` |
