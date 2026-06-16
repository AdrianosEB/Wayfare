# Requirements

Requirements are written as user stories, grouped by capability and tagged **[MVP]** or
**[v1]** / **[Later]**. MVP = needed to demonstrate the full conversational loop on mock
data, global scope. Acceptance criteria are intentionally concrete so they can become
tests.

Priority legend: **[MVP]** ship first · **[v1]** real-pricing release · **[Later]** beyond.

---

## 1. Prompt intake

- **US-1.1 [MVP]** As a traveler, I can describe my trip in a single free-text prompt so
  that I don't have to fill out forms.
  - _Accept:_ A single text input accepts an arbitrary sentence and starts a planning
    session. No required fields exist before submitting.
- **US-1.2 [MVP]** As a traveler, the app extracts every constraint it reasonably can from
  my prompt so it doesn't ask me what I already said.
  - _Accept:_ Given the Greek-trip example sentence, the system extracts destination
    (Greece), duration (8 days), month (late August), party size (2), budget (~€2,500),
    vibe (relaxed/beach) without re-asking any of them.
- **US-1.3 [MVP]** As a traveler, I see example prompts when the input is empty so I know
  what kind of thing to type.
  - _Accept:_ Empty state shows 2–3 tappable example prompts that pre-fill the input.

## 2. Clarification

- **US-2.1 [MVP]** As a traveler, the app asks only for information it's missing, so I'm
  never re-interrogated.
  - _Accept:_ A field already supplied in the prompt is never asked again. Only fields in
    the "high-leverage missing" set (see [CONVERSATION_FLOW.md](./CONVERSATION_FLOW.md))
    trigger a question.
- **US-2.2 [MVP]** As a traveler, clarifying questions arrive as quick, low-friction cards
  (chips/multi-select/short text) rather than a long form.
  - _Accept:_ Each question is answerable in one tap or a few words; questions are batched
    (max one batch of ≤4) before planning starts.
- **US-2.3 [MVP]** As a traveler, I can skip a clarifying question and the agent proceeds
  with a sensible default, telling me the assumption it made.
  - _Accept:_ Skipping origin (etc.) yields a stated default ("assuming you're flexible on
    origin / starting from <inferred>") surfaced in the plan.
- **US-2.4 [v1]** As a traveler, if my prompt is ambiguous about destination ("somewhere
  sunny"), the agent proposes a few candidate destinations to choose from.

## 3. Planning & itinerary

- **US-3.1 [MVP]** As a traveler, the agent produces a complete itinerary: outbound/return
  transport, accommodation for every night, and a day-by-day activity plan.
  - _Accept:_ Output covers all N days; every night has a stay; no day is empty unless
    explicitly a "free/rest day."
- **US-3.2 [MVP]** As a traveler, the plan respects my budget and pace.
  - _Accept:_ Total cost is ≤ budget for a hard cap, or within a stated tolerance band for
    a soft budget; a "relaxed" pace yields fewer scheduled activities per day than "packed."
- **US-3.3 [MVP]** As a traveler, I see a transparent running budget broken down by
  category (flights, stay, activities, transit, buffer) with a clear total.
  - _Accept:_ Budget panel sums to the headline total; each line is attributable to
    itinerary items.
- **US-3.4 [MVP]** As a traveler, every price shows its **source and freshness**.
  - _Accept:_ Each priced item carries a source label (e.g. "Mock estimate", later
    "Amadeus, 2h ago") and a timestamp/age. No unattributed prices.
- **US-3.5 [MVP]** As a traveler, the agent surfaces at least one meaningful tradeoff or
  saving so I understand the money.
  - _Accept:_ Plan includes ≥1 explicit suggestion (e.g. "shift flight −1 day saves €22").
- **US-3.6 [MVP]** As a traveler, the plan is globally scoped — I can ask for any
  destination on Earth and get a coherent costed plan.
  - _Accept:_ A destination with no hand-curated data still returns a plausible plan via
    the procedural mock generator, clearly labeled as estimated.
- **US-3.7 [v1]** As a traveler, prices reflect real availability from at least one live
  provider per category (flights, stays, activities).
- **US-3.8 [v1]** As a traveler, I can see 2–3 alternative options per major slot
  (e.g. alternative hotels) and the cost delta of switching.

## 4. Refinement (chat)

- **US-4.1 [MVP]** As a traveler, I can refine the plan in natural language and the agent
  updates it.
  - _Accept:_ Commands like "make it cheaper", "swap the hotel", "add a day trip to X"
    produce an updated itinerary + budget.
- **US-4.2 [MVP]** As a traveler, a refinement only changes the affected parts; unrelated
  parts of my trip stay put.
  - _Accept:_ "Swap the hotel" leaves flights and unaffected activity days byte-identical;
    only lodging (and any directly dependent items) change. (See
    [AGENT_DESIGN.md](./AGENT_DESIGN.md) partial re-planning.)
- **US-4.3 [MVP]** As a traveler, when a refinement pushes me over budget, the agent tells
  me and offers a way back under.
  - _Accept:_ Over-budget result is flagged with the overage amount and ≥1 concrete trim.
- **US-4.4 [MVP]** As a traveler, I can see what changed after a refinement.
  - _Accept:_ Changed items are visually marked and the budget delta is shown.
- **US-4.5 [v1]** As a traveler, I can undo a refinement / revert to a previous plan
  version.

## 5. Trust, transparency & safety

- **US-5.1 [MVP]** As a traveler, the app is honest when a price is an estimate vs. live.
  - _Accept:_ Mock/estimated prices are visibly labeled, never presented as bookable fact.
- **US-5.2 [MVP]** As a traveler, the agent states assumptions it made on my behalf.
  - _Accept:_ A visible "assumptions" affordance lists inferred defaults (origin, dates,
    etc.).
- **US-5.3 [v1]** As a traveler, I can see deep links out to book each component (flight,
  stay, activity) at the shown price/source.

## 6. Accounts, persistence, sharing — **[Later]**

- **US-6.1 [Later]** Save a trip to come back to it.
- **US-6.2 [Later]** Share a read-only itinerary link.
- **US-6.3 [Later]** Compare saved trips side by side.
- **US-6.4 [Later]** Booking hand-off / affiliate deep-link checkout.

---

## Non-functional requirements

- **NFR-1 Latency [MVP].** First clarifying questions appear < 2 s after prompt submit.
  A full mock-data plan returns in < 15 s (streamed progress, not a blank spinner).
- **NFR-2 Streaming UX [MVP].** The agent's progress (searching flights → stays →
  activities → costing) is streamed so the user sees motion, never a frozen wait.
- **NFR-3 Graceful degradation [MVP].** If a real provider is unavailable or rate-limited,
  the system falls back to mock/estimate for that category and labels it — the plan still
  completes. (See [INTEGRATIONS.md](./INTEGRATIONS.md).)
- **NFR-4 Security [MVP].** All model and pricing API keys live server-side. The client
  never receives a third-party key. No secrets in the bundle.
- **NFR-5 Cost control [MVP].** The agent loop is bounded: a max tool-call budget and max
  turns per plan to cap token spend; a single refinement re-plans the minimum slice.
- **NFR-6 Determinism in mock mode [MVP].** Mock pricing is seeded/deterministic per
  (destination, dates, party) so demos and tests are repeatable.
- **NFR-7 Provider-agnostic integration [MVP].** Real providers sit behind a stable
  internal interface; swapping mock→real requires no change to the agent or UI.
- **NFR-8 Accessibility [v1].** Keyboard-navigable chat, sufficient contrast, screen-reader
  labels on itinerary and budget components.
- **NFR-9 Observability [v1].** Each plan logs tool calls, provider sources, latencies,
  and token usage for debugging and cost tracking (no PII beyond the trip request).
- **NFR-10 Resilience to bad prompts [MVP].** Off-topic, abusive, or nonsensical prompts
  are handled gracefully with a redirect, not a crash or a hallucinated trip.

---

## Explicitly out of scope

To keep MVP and v1 honest, these are **not** being built (now):

- **Actual booking / payment processing.** Wayfare plans and (later) hands off to
  third-party booking; it does not take payment or issue tickets.
- **Real-time inventory guarantees.** Even with live providers, a shown price/seat is a
  snapshot, not a hold. No reservation locking.
- **User accounts & auth — until [Later].** MVP/v1 are session-based, no login.
- **Multi-city / open-jaw complex routing — until [v1]+.** MVP assumes one primary
  destination region per trip (round-trip from a single origin).
- **Ground transport booking (car rental, trains as bookable items).** Surfaced as
  itinerary notes/estimates, not booked. Ferries within a region are estimated.
- **Travel insurance, visas, vaccination guidance.** May show a non-authoritative
  reminder note; not advice and not sold.
- **Group collaboration / multiple editors on one trip — until [Later].**
- **Native mobile apps.** Responsive web only.
- **Loyalty programs / points optimization.**
