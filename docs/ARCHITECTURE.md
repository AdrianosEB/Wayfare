# Architecture

## Overview

Wayfare is a three-part system:

1. **Web client** — a chat-first React SPA. Renders the prompt entry, clarifying-question
   cards, the live itinerary + budget, and the refine chat. Holds no secrets.
2. **API server** — a lightweight Node/TypeScript service. Owns the conversation state,
   runs the planning agent (Anthropic tool-use loop), and proxies all pricing
   integrations. The only place keys live.
3. **Planning engine + integrations** — the agent loop and a set of provider adapters
   (mock now, real later) behind a stable internal interface.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              WEB CLIENT (SPA)                              │
│   React + Vite + Tailwind + Framer Motion                                  │
│   PromptEntry · ClarifyCards · ItineraryView · BudgetPanel · RefineChat    │
│   - No API keys. Talks only to our API server over HTTPS + SSE.            │
└───────────────────────────────▲───────────────┬───────────────────────────┘
                                 │ SSE (stream)  │ POST (prompt, answers, refine)
                                 │               ▼
┌───────────────────────────────┴───────────────────────────────────────────┐
│                          API SERVER (Node + TS)                            │
│                                                                            │
│   ┌──────────────┐   ┌───────────────────┐   ┌──────────────────────────┐  │
│   │ Session store │   │  Prompt Parser    │   │   Planning Agent          │  │
│   │ (trip state,  │◄─►│  (extract fields, │◄─►│   Anthropic tool-use loop │  │
│   │  versions)    │   │   pick questions) │   │   (scour → rank → assemble)│ │
│   └──────────────┘   └───────────────────┘   └────────────┬──────────────┘  │
│                                                            │ tool calls       │
│                                              ┌─────────────▼───────────────┐  │
│                                              │   Integration Layer          │  │
│                                              │   (provider-agnostic iface)  │  │
│                                              │  searchFlights/Stays/Acts,   │  │
│                                              │  computeBudget               │  │
│                                              └───┬───────────┬───────────┬──┘  │
└──────────────────────────────────────────────────┼───────────┼───────────┼────┘
                                                   ▼           ▼           ▼
                                        ┌──────────────┐ ┌──────────┐ ┌──────────┐
                                        │ Mock provider │ │ Amadeus  │ │ Places.. │
                                        │ (curated +    │ │ (v1)     │ │ (v1)     │
                                        │  procedural)  │ │          │ │          │
                                        └──────────────┘ └──────────┘ └──────────┘
                                                   ▲
                                        Anthropic API (model) ◄── agent reasons here
```

Keys (Anthropic + any provider) live only in the API server. The client is a dumb,
pretty terminal into the conversation.

---

## Tech stack & reasoning

### Frontend: React + Vite + Tailwind + Framer Motion  _(given — and the right call)_

- **React + Vite** — fast dev server, instant HMR, tiny config. SPA fits a single
  continuous conversation surface.
- **Tailwind** — the UI is many small bespoke chat/itinerary components; utility classes
  keep them consistent without a heavy component framework.
- **Framer Motion** — motion is core to the feel: cards animating in as the agent thinks,
  the budget bar growing, changed items highlighting on refine. See
  [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).
- **State:** lightweight — React Query for server/stream state, Zustand (or context) for
  local session UI state. No Redux; the source of truth is server-side trip state.

### Backend: **Node + TypeScript (Express or Fastify)** — recommended over Python/FastAPI

Both were on the table. The recommendation is **Node/TypeScript**, for concrete reasons:

| Factor | Node/TS | Python/FastAPI |
|---|---|---|
| **Shared types** | Trip/Itinerary/Budget types shared verbatim with the React client | Would need duplicate models or codegen |
| **Streaming the agent** | First-class SSE/WHATWG streams; Anthropic TS SDK streams cleanly | Also fine (SSE), but a second language in the stack |
| **One language end-to-end** | Yes — lower context-switching, one toolchain | No |
| **Anthropic SDK** | `@anthropic-ai/sdk` mature, tool-use ergonomic | `anthropic` SDK equally good |
| **Ecosystem for travel SDKs** | Amadeus/Booking have JS SDKs | Also available |

The deciding factor is the **shared type surface** between the itinerary the agent
produces and the itinerary the client renders — keeping `Trip`, `Itinerary`, `Listing`,
`Budget` (see [DATA_MODEL.md](./DATA_MODEL.md)) in one TypeScript package eliminates a
whole class of drift bugs. **Express** for familiarity, or **Fastify** if we want schema
validation + speed; either is fine. We'll use **Zod** for runtime validation of agent
tool I/O and request bodies.

> If the team's strength were Python/ML, FastAPI would be a defensible swap — the
> architecture (client / API / agent / integration layer) is identical either way. The
> integration interface and agent contract are language-neutral.

### Planning agent: Anthropic API with tool use

- `claude-opus-4-8` (or a faster Claude tier per cost/latency budget) drives the
  scour/assemble loop via tool use. The agent is the orchestrator; deterministic code does
  the math and the data fetching. See [AGENT_DESIGN.md](./AGENT_DESIGN.md).

### Repo shape (monorepo)

```
wayfare/
├── docs/                  # this folder
├── packages/
│   └── shared/            # TS types + Zod schemas (Trip, Itinerary, Listing, Budget…)
├── apps/
│   ├── web/               # React + Vite client
│   └── server/            # Express/Fastify API + agent + integrations
│       ├── agent/         # tool definitions, planning loop, prompts
│       ├── integrations/  # provider interface + mock + (later) real adapters
│       └── session/       # trip state store + versioning
└── package.json           # workspaces
```

---

## Request lifecycle: prompt → itinerary

The flow from a raw sentence to a costed plan, end to end:

```
USER                CLIENT              API SERVER                 AGENT + INTEGRATIONS
 │  type prompt        │                    │                              │
 ├───────────────────► │  POST /session     │                              │
 │                     ├──────────────────► │  create session              │
 │                     │                    │  ── Prompt Parser ──         │
 │                     │                    │   extract known fields       │
 │                     │                    │   compute missing high-      │
 │                     │                    │   leverage fields            │
 │                     │ ◄────────────────  │  return {sessionId,          │
 │  see clarify cards  │  clarifyQuestions} │   clarifyQuestions[]}        │
 │ ◄─────────────────  │                    │                              │
 │  answer / skip      │  POST /session/:id │                              │
 ├───────────────────► ├─────/answers─────► │  merge answers → constraints │
 │                     │                    │  open SSE stream             │
 │                     │ ◄═══════ SSE ═════ │  ── Planning Agent loop ──   │
 │  watch progress     │  event: status     │   turn 1: searchFlights ────►│ provider
 │  "searching flights"│  event: status     │   turn 2: searchStays ──────►│ provider
 │  "comparing stays"  │  event: partial    │   turn 3: searchActivities ─►│ provider
 │  itinerary fills in │  event: partial    │   turn 4: computeBudget ────►│ deterministic
 │  budget bar grows   │  event: status     │   rank + assemble            │
 │                     │ ◄═══════ SSE ═════ │  event: complete {trip}      │
 │  full plan + budget │                    │  persist trip vN             │
 │ ◄─────────────────  │                    │                              │
 │                     │                    │                              │
 │  "swap the hotel"   │  POST /session/:id │                              │
 ├───────────────────► ├─────/refine──────► │  classify refinement scope   │
 │                     │ ◄═══════ SSE ═════ │   → partial re-plan (lodging │
 │  only hotel + budget│  event: partial    │     only) ───────────────────►│ provider
 │  update; rest fixed │  event: complete   │   diff vs vN → persist vN+1  │
 │ ◄─────────────────  │                    │                              │
```

Key properties:

- **Two phases, two endpoints.** `/session` (parse + clarify) is cheap and synchronous-ish;
  `/answers` and `/refine` open an **SSE stream** so the agent's work is visible in real
  time (NFR-2).
- **Server owns truth.** Trip state and its version history live server-side; the client
  renders a projection. This makes partial re-planning and "what changed" diffs reliable.
- **Integration layer is the only thing that knows about money sources.** The agent calls
  `searchFlights(...)`; whether that hits the mock generator or Amadeus is invisible to it
  (NFR-7). See [INTEGRATIONS.md](./INTEGRATIONS.md).

### API surface (MVP)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/session` | Submit prompt → `{ sessionId, extracted, clarifyQuestions[] }` |
| `POST` | `/api/session/:id/answers` | Submit clarifying answers → opens SSE, runs initial plan |
| `POST` | `/api/session/:id/refine` | Natural-language refinement → opens SSE, partial re-plan |
| `GET` | `/api/session/:id` | Fetch current trip state (+ version) |
| `GET` | `/api/session/:id/stream` | (If using GET-SSE) subscribe to the active run's events |

SSE event types: `status` (human-readable progress), `partial` (itinerary/budget patch),
`assumption` (a default the agent took), `complete` (final trip), `error` (with graceful
fallback note).

### Session & versioning

- A session holds: the original prompt, extracted constraints, merged answers, and an
  **ordered list of trip versions**. Each refinement produces a new version with a diff
  against the prior one (enables US-4.4 "what changed" and the [Later] undo, US-4.5).
- MVP storage: in-memory store with a pluggable interface (swap to Redis/Postgres at
  [Later] when accounts arrive). Deterministic mock pricing (NFR-6) keeps versions
  reproducible.

### Failure & degradation

- A provider error or rate-limit (NFR-3) is caught in the integration layer, which returns
  a mock/estimate for that category tagged `degraded: true`. The agent continues; the UI
  labels the affected prices. A plan never fails wholesale because one source is down.
- The agent loop is bounded (NFR-5): max turns + max tool calls per plan; on exhaustion it
  returns the best assembled plan so far with a note rather than looping forever.

See [AGENT_DESIGN.md](./AGENT_DESIGN.md) for the agent internals and
[DATA_MODEL.md](./DATA_MODEL.md) for the shapes that flow across these boundaries.
