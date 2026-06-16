# App Screens

Layouts, states, and data binding for the planner. Build against the MSW fixtures
([../fixtures/](../fixtures)) and the SSE contract ([../API_CONTRACT.md](../API_CONTRACT.md)).
Components are specified in [COMPONENTS.md](./COMPONENTS.md).

## Routes

| Route | Screen |
|---|---|
| `/` | Marketing landing ([LANDING_PAGE.md](./LANDING_PAGE.md)) |
| `/plan/:type?` | Planner app (optional trip-type seeds the prompt) |

A single session drives the planner; the URL can carry `?sid=` for refresh persistence.

---

## App shell (the planner layout)

```
┌───────────────────────────────────────────────────────────────────────┐
│  slim top bar: Wayfare mark · "New trip" · (later) account             │  z-30
├───────────────────────────────┬───────────────────────────────────────┤
│  CHAT COLUMN  (~40%, max 680)  │  PLAN COLUMN  (~60%)                    │
│                                │                                         │
│  ChatThread                    │  ItineraryPanel                         │
│   · user/agent bubbles         │   · TripHeader                          │
│   · AgentStatusLine (stream)   │   · FlightCard ×2                        │
│   · QuestionCardStack          │   · StayCard                            │
│   · summaries                  │   · DayTimeline (DayCards)              │
│                                │                                         │
│  QuickRefineChips              │  ┌─────────────────────────────────┐    │
│  PromptInput (refine, docked)  │  │ BudgetPanel (docked, azure)     │    │
│                                │  └─────────────────────────────────┘    │
└───────────────────────────────┴───────────────────────────────────────┘
```

- **Desktop (≥ lg):** two columns as above; `BudgetPanel` docked in the plan column (sticky).
- **Mobile (< lg):** single column — plan on top (collapsible to a summary), chat below,
  `BudgetPanel` as a sticky bottom bar that expands (`sheet`). Refine `PromptInput` always
  reachable above the budget bar.

---

## Screen 1 — Prompt entry (app empty state)

- Centered, near-empty. Large `PromptInput variant="hero"` ("Where do you want to go?"),
  three `ExamplePromptChips` (CONTENT_VOICE personas). No itinerary yet; plan column shows
  the empty-budget hint.
- If arrived via `/plan/:type`, the input is pre-seeded with the trip-type prompt.
- **Submit →** `POST /api/session` → render agent intro + `QuestionCardStack`.

**States:** idle · submitting (input disabled, subtle azure progress).

---

## Screen 2 — Clarifying questions

- Agent `MessageBubble` intro ("Nice — {summary}. Just a couple of quick things:") + a
  `QuestionCardStack` of the returned `clarifyQuestions` (≤4).
- Each card: question + matching input + `SkipControl`. Primary "Plan it" enables when
  required are answered/skipped.
- **Submit →** `POST /api/session/:id/answers` → opens SSE → Screen 3.

**States:** answering · some skipped (assumptions queued) · submitting.
**a11y:** focus moves to the first card; Enter on last advances to "Plan it".

---

## Screen 3 — Planning / streaming  ⭐

The signature moment (see MOTION §"Streaming choreography"). Consume the POST SSE stream with
`fetch` + `ReadableStream` (NOT EventSource — POST). Parse `event:`/`data:` frames; ignore
`:` heartbeats.

- **Chat column:** `AgentStatusLine`s appear in sequence from `status` events ("Searching
  flights…", "Comparing stays…", "Costing it out…").
- **Plan column:** blocks fill progressively from `partial` patches — flights → stay → days
  — skeleton (`shimmer`) → content (`staggerChild`). `BudgetBar` `growBar`s; headline total
  counts up.
- `assumption` events feed `AssumptionsReveal`.
- **`complete` →** replace working trip with `complete.trip` (authoritative), settle to
  Screen 4. (`partial` patches are progress only; never the source of truth.)

**States:** streaming · complete · `error` event (show retry; if `degraded`, finish with
labeled estimates and a degraded note).

---

## Screen 4 — Itinerary + budget (the plan)

- **Plan column:** `TripHeader` (summary, dates, party, photo strip) → `FlightCard`s →
  `StayCard` → `DayTimeline`. Every price carries a `SourceChip` ("Estimated" this pass).
  `AssumptionsReveal` near the header.
- **BudgetPanel:** total vs target, under/on/over, category `BudgetLineRow`s (tap → highlight
  items), `SavingHintChip`s.
- **Chat column:** a concise plan summary bubble + `QuickRefineChips` + refine `PromptInput`.

**Empty/degraded:** if any line used fallbacks, show the degraded note; chips read "Estimated".

---

## Screen 5 — Refine (chat-driven updates)

- User types a refinement (or taps a `QuickRefineChip`). **→** `POST /api/session/:id/refine`
  → SSE again, but typically a smaller, scoped update.
- On `complete`, apply `refinement.diff`: wrap changed items in `DiffHighlight`
  (`pulseChanged` once), show a "Done — {n} changes" bubble, and the budget delta.
- **`info`-scope refinements** change nothing — render the agent's `message` answer only,
  then offer to act. Don't mutate the itinerary.
- **Over-budget result:** BudgetPanel shows the overage + offered trims; agent bubble asks
  keep-or-trim.

**States:** refining (scoped skeleton on affected block only) · done (diff shown) · info
(answer only) · over-budget (flagged).

---

## Cross-screen requirements

- **Server is source of truth.** Keep a working `Trip` in a Zustand store; `complete.trip`
  always replaces it. Patches are cosmetic progress.
- **Never a blank spinner.** Every wait shows status lines + skeletons.
- **Responsive** per the shell rules above; test at 375 / 768 / 1280.
- **a11y:** keyboard-drive the whole flow; price+source announced together; budget state not
  color-only; `prefers-reduced-motion` honored.
- **Mock-only this pass:** all data via MSW fixtures; no real network/provider calls.
