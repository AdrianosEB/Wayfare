# Roadmap

Phased milestones from a mock-data MVP to real pricing and, eventually, booking hand-off.
Each phase is shippable and demoable on its own. Scope is **global from day one** (via the
two-tier mock strategy); realism deepens as real providers come online.

Legend: ✅ in scope for the phase · 🚫 explicitly deferred.

---

## Phase 0 — Specs _(done ✅)_

The `/docs` folder: this set of specs. Specs reviewed and approved; code now exists.

---

## Phase 1 — MVP: the full loop on mock data _(done ✅)_

**Goal:** the complete conversational loop — prompt → clarify → plan → refine — working
end-to-end on mock pricing, for any destination, with the budget always visible and honest.

**Build:**
- ✅ Monorepo scaffold (`packages/shared`, `apps/web`, `apps/server`) per
  [ARCHITECTURE.md](./ARCHITECTURE.md).
- ✅ Shared `Trip`/`Itinerary`/`Listing`/`Budget` types + Zod schemas
  ([DATA_MODEL.md](./DATA_MODEL.md)).
- ✅ Web shell: prompt entry, clarifying-question cards, itinerary view, budget panel,
  refine chat ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)), with streaming UI.
- ✅ Prompt parser + clarifying-question selector ([CONVERSATION_FLOW.md](./CONVERSATION_FLOW.md)).
- ✅ Planning agent with the four tools, scour→rank→assemble loop, bounded
  ([AGENT_DESIGN.md](./AGENT_DESIGN.md)).
- ✅ **Mock provider, both tiers**: 5–8 curated hero destinations + procedural generator for
  global coverage; deterministic/seeded ([INTEGRATIONS.md](./INTEGRATIONS.md)).
- ✅ Partial re-planning by refinement scope; "what changed" diffs + budget deltas.
- ✅ Source/freshness labels on every price (all "mock/estimate" this phase).
- ✅ Session + in-memory trip versioning.
- 🚫 Real providers, accounts, saving/sharing, booking.

**Exit criteria (met ✅):**
- The three VISION.md journeys (student €600, couple €2,500, family £1,800) all complete
  end-to-end on mock data.
- A refinement ("swap the hotel", "add a day trip") re-plans only the affected slice and
  shows the diff + budget delta.
- Any arbitrary global destination returns a coherent, honestly-labeled plan.
- Mock plan returns < 15 s with streamed progress (NFR-1/2).

**Also landed (beyond the original MVP slice):**
- ✅ **Full Layla-style marketing landing** (`/`) — Hero (live prompt box) → how it works →
  trip types → low pricing → past trips → partners/press → testimonials → FAQ → footer.
  Minimal nav; the page is explored by scrolling. Photo-rich, azure-on-white.
- ✅ **Standalone `/pricing` page** — a cheapest-trips showcase; tapping a card seeds the
  planner and auto-starts.
- ✅ **Live agent option** — alongside the deterministic mock planner, the real
  `claude-opus-4-8` tool-use loop runs when `ANTHROPIC_API_KEY`/`PLANNER_MODE=agent` is set.
- ✅ **Email+password auth, guest-first** — cookie sessions, optional, never gates the
  planner (pulled forward from Phase 3 as a self-contained slice). See
  [AUTH_CONTRACT.md](./AUTH_CONTRACT.md). Persisting/saving trips to an account is still later.

---

## Phase 2 — v1: real pricing, one category at a time _(next)_

**Goal:** replace mock with real data behind the same interface, starting with the lowest-
risk category, without touching the agent or UI.

**Build:**
- ✅ **Amadeus flight search** behind `searchFlights` (test tier → prod), via
  `CompositeProvider` with mock fallback (NFR-3). Stays + activities stay mock.
- ✅ Real source/freshness labels ("Amadeus · 2h ago", "cached") now meaningfully varying.
- ✅ Response caching + provider-layer rate-limit/cost guards.
- ✅ Then **Amadeus hotel search** behind `searchStays`.
- ✅ Then **activity discovery** via Google Places / OSM (free POIs for budget users) behind
  `searchActivities`; pricing still templated where not bookable.
- ✅ Ambiguous-destination candidate proposals (US-2.4); alternatives per slot with deltas
  (US-3.8).
- ✅ Observability: per-plan tool calls, sources, latency, token usage (NFR-9).
- ✅ Accessibility pass (NFR-8).
- 🚫 Booking/payment, accounts.

**Exit criteria:**
- At least flights are live with graceful fallback to mock when a provider fails/limits.
- A plan transparently mixes live and estimated prices, each correctly labeled; trip shows
  `degraded` only when it truly fell back.
- Swapping a category from mock→real required no agent or UI change (interface held).

---

## Phase 3 — Later: accounts, persistence, sharing, booking hand-off

**Goal:** make trips durable, shareable, and actionable.

**Build:**
- ◑ Accounts/auth — **the auth slice already shipped in Phase 1** (email+password,
  guest-first, in-memory cookie sessions per [AUTH_CONTRACT.md](./AUTH_CONTRACT.md)). Remaining
  here: persistent storage (swap the in-memory user/session stores → Postgres/Redis).
- ✅ Save trips; revisit; **undo/revert** refinements (US-4.5) on top of existing versioning.
- ✅ Share a read-only itinerary link (US-6.2); compare saved trips (US-6.3).
- ✅ **Booking hand-off**: affiliate deep links (Kiwi/Booking/Viator) so shown prices become
  bookable; revenue-aligned (US-5.3, US-6.4).
- ✅ Bookable activities via Viator/GetYourGuide affiliate APIs.
- 🚫 Taking payment / issuing tickets ourselves (stays out of scope — see REQUIREMENTS.md).

**Exit criteria:**
- A user can sign in, save a planned trip, share it, and click out to book each component
  at the shown source.

---

## Beyond (candidate bets, unprioritized)

- Multi-city / open-jaw routing.
- Group collaboration (multiple editors on one trip).
- Smarter date-shopping ("cheapest week in your window").
- Ground transport (trains/car) as first-class costed items.
- Native mobile.
- Points/loyalty optimization.

---

## Cross-phase invariants (never regress)

These hold from Phase 1 onward, regardless of feature work:

- **Prompt-first, minimal friction** — forms stay a last resort.
- **Every price shows source + freshness** — no unattributed numbers, ever.
- **Budget always visible and honest** — total derives from listings; hard caps never
  silently exceeded.
- **Re-planning stays cheap** — refinements touch only the affected slice.
- **Keys stay server-side** — no third-party keys in the client.
- **Graceful degradation** — a provider failure downgrades to estimate, never a broken plan.
