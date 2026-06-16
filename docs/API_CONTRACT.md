# API Contract (frozen)

**This is the single source of truth for the wire between the web client and the API
server.** Both the frontend and backend sessions MUST conform to this exactly. If a change
is needed, change it _here first_, then update both sides. Types referenced are the shared
types in `packages/shared` (see [DATA_MODEL.md](./DATA_MODEL.md)); this doc pins their
serialized JSON form and the transport.

> Authority: `packages/shared` is authored by the **backend session first** and imported
> by the frontend. Until it exists, the frontend builds against the fixtures in
> [`docs/fixtures/`](./fixtures). The fixtures and this contract are kept in lockstep.

---

## Global conventions

- **Base URL:** `/api`. In dev the web client proxies `/api/*` → `http://localhost:3000`.
- **Ports:** web `5173` (Vite), api `3000`.
- **Content type:** `application/json; charset=utf-8` for request/response bodies; SSE
  endpoints respond `text/event-stream`.
- **Currency & money:** every price is `{ amount: number, currency: string }` where
  `amount` is a major-unit number (e.g. `2410.0` EUR), `currency` is ISO-4217. No floats
  for "cents" — major units throughout, formatted client-side.
- **Timestamps:** ISO-8601 UTC strings (`2026-08-24T09:30:00Z`).
- **IDs:** opaque strings; clients must not parse them.
- **Versioning:** the contract version is `v1`. Breaking changes bump it.

---

## Errors (uniform shape)

Every non-2xx JSON response uses:

```json
{ "error": { "code": "string_enum", "message": "human readable", "details": {} } }
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `invalid_request` | Body fails schema validation (Zod). `details` lists field issues. |
| 404 | `session_not_found` | Unknown `sessionId`. |
| 409 | `not_ready` | Refine/answers called before the session is in a valid state. |
| 422 | `unplannable` | Constraints are contradictory/meaningless (see CONVERSATION_FLOW §7). |
| 429 | `rate_limited` | Provider/agent budget exhausted (still returns best-effort where possible). |
| 500 | `internal` | Unexpected. `message` is safe/generic. |

Errors that occur **mid-stream** are delivered as an SSE `error` event (see below), not an
HTTP status, because the stream has already started `200`.

---

## Endpoints

### 1. `POST /api/session` — submit prompt, get clarifying questions

Parses the prompt, returns extracted constraints + the batched clarifying questions. Cheap,
synchronous. Does **not** plan yet.

**Request**
```json
{ "prompt": "I want a relaxed 8-day beach trip in Greece in late August for two people, around €2,500 total" }
```

**Response `200`**
```json
{
  "sessionId": "sess_abc123",
  "extracted": { /* TripRequest — see DATA_MODEL.md, Tracked<T> fields */ },
  "clarifyQuestions": [ /* ClarifyQuestion[] — see schema below */ ],
  "agentMessage": "Nice — a relaxed 8 days by the sea in Greece, late August, for two, ~€2,500. Two quick things:"
}
```

`ClarifyQuestion` (frozen shape):
```ts
interface ClarifyQuestion {
  id: string;                 // stable id from the catalogue, e.g. "origin", "vibe_dest"
  question: string;           // display text
  format: 'chips' | 'multiselect' | 'stepper' | 'city' | 'text' | 'currency';
  options?: { value: string; label: string }[];   // for chips/multiselect
  skippable: boolean;
  skipDefault?: string;       // human description of the assumption taken on skip
  placeholder?: string;       // for text/city/currency
}
```

If `clarifyQuestions` is empty, the client may proceed directly to `/answers` with an empty
body to start planning.

---

### 2. `POST /api/session/:id/answers` — submit answers, stream the plan

Merges answers into the request and runs the initial planning agent. **Responds with an SSE
stream** (`text/event-stream`).

**Request**
```json
{
  "answers": { "origin": "London", "vibe_dest": "quieter" },
  "skipped": []
}
```
- `answers`: map of `ClarifyQuestion.id` → value. Value type follows `format`:
  `chips`/`city`/`text` → string; `multiselect` → string[]; `stepper` →
  `{ adults: number, children?: number, childAges?: number[] }`; `currency` →
  `{ amount: number, currency: string }`.
- `skipped`: array of question ids the user skipped (server applies `skipDefault`).

**Response `200`**: SSE stream (see **SSE protocol** below), terminating in a `complete`
event carrying the full `Trip`.

---

### 3. `POST /api/session/:id/refine` — natural-language refinement, stream the delta

**Request**
```json
{ "utterance": "swap the hotel for something nearer the beach, and add a day trip to a quieter island" }
```

**Response `200`**: SSE stream. The server first classifies scope
(see [CONVERSATION_FLOW.md](./CONVERSATION_FLOW.md) §5), re-plans only the affected slice,
and ends with a `complete` event whose `trip` is the new version and whose `refinement`
holds the diff + budget delta. For an `info`-scope utterance, the stream emits a single
`message` event and a `complete` with the **unchanged** trip (no diff).

---

### 4. `GET /api/session/:id` — fetch current state

**Response `200`**
```json
{
  "sessionId": "sess_abc123",
  "request": { /* TripRequest */ },
  "currentVersion": 2,
  "trip": { /* Trip */ },
  "versions": [ { "version": 1, "createdAt": "…" }, { "version": 2, "createdAt": "…", "refinement": { "utterance": "…", "scope": "lodging" } } ]
}
```

---

## SSE protocol (the streaming contract)

Endpoints 2 and 3 stream Server-Sent Events. Each event has a named `event:` and a JSON
`data:` line. The client renders progress live and applies `partial` patches.

| `event:` | `data` payload | Client behavior |
|---|---|---|
| `status` | `{ "step": "search_flights" \| "search_stays" \| "search_activities" \| "compute_budget" \| "assemble" \| "resolve", "message": "Searching flights London→Greece…" }` | Show as an agent "thinking" status line. |
| `partial` | `{ "patch": ItineraryOrBudgetPatch }` | Merge into the in-progress trip (progressive fill). See patch note. |
| `assumption` | `{ "field": "origin", "assumed": "London", "reason": "you skipped origin" }` | Add to the assumptions reveal. |
| `message` | `{ "text": "…" }` | Free-text agent message (used for `info` refinements & summaries). |
| `complete` | `{ "trip": Trip, "version": number, "refinement"?: { utterance, scope, diff: ItemDiff[], budgetDelta: number } }` | Replace working state with the final trip; on refine, highlight `diff` items + show `budgetDelta`. |
| `error` | `{ "code": "...", "message": "...", "degraded"?: true }` | If `degraded`, the plan still completes with labeled estimates; otherwise show error. |

**Patch semantics (`partial`):** `patch` is a shallow JSON-merge-patch against the working
`Trip` (RFC-7386 style). Arrays in a patch **replace** the target array (no index merging).
The frontend keeps a working `Trip` and applies patches in order; the final `complete.trip`
is authoritative and replaces the working copy. Don't rely on patches summing exactly — the
`complete` event is the source of truth; patches are for perceived progress only.

**Framing example** (raw bytes on the wire):
```
event: status
data: {"step":"search_flights","message":"Searching flights London→Greek islands…"}

event: partial
data: {"patch":{"itinerary":{"flights":[{"id":"fl_out","direction":"outbound", "...":"..."}]}}}

event: complete
data: {"trip":{ /* full Trip */ },"version":1}

```
(Each event ends with a blank line. Heartbeat comments `: ping` may be sent to keep the
connection alive; clients ignore lines starting with `:`.)

**Client requirements:** consume via `EventSource` (or `fetch` + `ReadableStream` for POST
bodies — note `EventSource` is GET-only, so for POST endpoints use `fetch` with a streaming
reader, or POST to create the run then `GET /stream`). **Decision:** the frontend uses
`fetch` + `ReadableStream` against the POST endpoints directly; no separate GET-stream
endpoint in v1.

---

## What's mock-labeled

Per [INTEGRATIONS.md](./INTEGRATIONS.md), in MVP every `Listing.freshness` is `"mock"` and
`source.label` is `"Estimated price"` (procedural) or a curated label. The frontend must
render the `SourceChip` from these fields and never hardcode "mock" — it reads the data so
the same component shows `"Amadeus · 2h ago"` later with zero changes.

---

## Change control

- The **backend session owns** `packages/shared` and this contract's request/response
  schemas; it publishes Zod schemas that serialize to exactly the JSON above.
- The **frontend session consumes** them and owns nothing in the contract.
- Any contract change is a PR to this file + `packages/shared` + the fixtures, announced to
  both sessions. Neither side invents fields unilaterally.
