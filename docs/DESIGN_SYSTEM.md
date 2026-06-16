# Design System

Wayfare is **chat-first**. The interface is a conversation that gradually materializes a
trip beside it. This doc defines the visual direction, the key screens, the component
inventory, and the overall feel.

## Design principles

1. **Conversation is the UI.** The primary surface is a chat thread. Structured UI
   (question cards, the itinerary, the budget) is rendered _inside_ or _beside_ the
   conversation, never as a separate form-driven app.
2. **The money is always visible and honest.** A running budget is persistently in view;
   every price wears its source/freshness. Transparency is a visual feature, not fine print.
3. **Motion conveys thinking.** As the agent scours, the UI streams progress and items
   animate in. Refinements highlight exactly what changed. Calm, purposeful motion — never
   decorative jitter.
4. **Low friction, high trust.** Big tap targets, skippable questions, plain language.
   Budget-conscious users should feel the app is on their side about money.

---

## Visual direction

- **Mood:** warm, optimistic, "golden-hour travel" — but clean and modern, not a cluttered
  OTA. Closer to a calm planning companion than a booking funnel.
- **Color:**
  - Base: warm off-white / soft sand background, deep ink text.
  - Primary: a confident sea/teal for actions and the user's voice.
  - Accent: a warm sunset coral/amber for highlights, savings, and "changed" markers.
  - Semantic: green = under budget, amber = on target, red = over (used sparingly, never
    alarmist for a soft target).
  - Dark mode from day one (the chat surface looks great dark).
- **Type:** a friendly geometric sans for UI (e.g. Inter / General Sans), tabular figures
  for all prices so budgets align. Generous line height in chat.
- **Shape & depth:** rounded cards (2xl radius), soft shadows, subtle borders. Itinerary
  and budget feel like tactile cards you could rearrange.
- **Imagery:** light touch — small destination thumbnails, simple line icons per activity
  category. Never stock-photo-heavy; the plan is the hero, not a brochure.
- **Motion (Framer Motion):** staggered fade/slide-in for streaming items; a budget bar
  that smoothly grows; a gentle pulse/outline on changed items after a refine; typing-style
  reveal for agent status lines.

---

## Key screens

### 1. Prompt entry (the front door)

- Near-empty, inviting. A large centered input: _"Where do you want to go?"_ with a soft
  placeholder and a single send affordance.
- 2–3 tappable **example prompts** below (US-1.3) spanning the personas — a tight-budget
  solo trip, the Greek couple's trip, a family city break — so users see the range and the
  expected "shape" of a prompt.
- Minimal chrome: logo, maybe a one-liner value prop. No nav bar, no filters. The point is
  "just type."

### 2. Clarifying-question cards

- After submit, the agent's first message + a **card stack** of ≤4 questions (US-2.2).
- Each card is a single question with the lowest-friction input: chips, a stepper
  (travelers), a city autocomplete (origin), or a short text box.
- Every card has a visible **Skip** that shows the default it'll assume (US-2.3).
- Cards animate in together (one batch), answerable in any order; a single **"Plan it"**
  CTA lights up once required ones are satisfied (or skipped).

### 3. Planning / streaming state

- The conversation shows streamed **status lines** ("Searching flights London→Greece…",
  "Comparing island stays…", "Costing it out…") — the agent thinking out loud (NFR-2).
- The itinerary panel **fills in progressively** (flights first, then stay, then days) with
  skeleton→content transitions. The budget bar grows as items land. No blank spinner.

### 4. Itinerary view (the plan)

The centerpiece. Two-column on desktop (chat left, plan right); stacked on mobile (plan
above the chat, collapsible).

- **Header:** one-line summary ("8 days on Naxos — €2,410 for two"), dates, party,
  destination thumbnail.
- **Flights block:** outbound/return cards — times, stops, carrier, price + source chip.
- **Stay block:** hotel card — name, type, rating, key amenities, distance-to-focus
  ("120 m to beach"), nights, price + source chip.
- **Day-by-day timeline:** one expandable card per day; ordered activity/meal/transit items
  with times, walking distances between them, kid-suitability marks where relevant. "Free"
  items styled distinctly (and celebrated for budget users).
- **Source/freshness chips** on every price (e.g. "Mock estimate", later "Amadeus · 2h
  ago"). Tap → what this means. This is the trust surface (US-3.4, US-5.1).
- **Assumptions affordance:** a small "ⓘ assumptions" reveal listing inferred defaults
  (US-5.2).

### 5. Budget panel (always present)

- Persistent, docked (sidebar on desktop, sticky bar on mobile). Always in view.
- **Headline total** vs target, with under/on/over color state and a progress bar.
- **Category breakdown** (flights, stay, activities, transit, food, buffer) that rolls up
  to the total — tap a line to highlight the itinerary items behind it.
- **Saving hints** surfaced as friendly chips ("Shift outbound −1 day · save €48") that are
  one-tap to apply (US-3.5) — applying triggers a scoped refinement.
- **Over-budget state** (US-4.3): clear overage amount + offered trims, calm not alarmist.

### 6. Refine chat

- The same chat thread continues. The user types refinements in natural language.
- After a refine, a concise agent message lists **what changed**; the itinerary marks
  changed items (accent outline/pulse) and the budget shows the **delta** (US-4.4).
- Quick-action chips for common refinements ("Make it cheaper", "Swap hotel", "Add a day
  trip") lower the friction of discovering what's possible.

---

## Component inventory

| Component | Role |
|---|---|
| `PromptInput` | The hero free-text input; also the persistent refine input |
| `ExamplePromptChips` | Tappable starter prompts on the empty state |
| `ChatThread` / `MessageBubble` | The conversation surface; user + agent turns |
| `AgentStatusLine` | Streamed "thinking" progress lines |
| `QuestionCardStack` | The batched clarifying questions |
| `ChipSelect` · `Stepper` · `CityAutocomplete` · `ShortText` | Low-friction question inputs |
| `SkipControl` | Skip + shows the assumed default |
| `ItineraryPanel` | Container for the whole plan |
| `FlightCard` · `StayCard` · `DayTimeline` · `ActivityItem` | Plan building blocks |
| `SourceChip` | Price source + freshness badge (the trust marker) |
| `AssumptionsReveal` | Lists inferred defaults |
| `BudgetPanel` · `BudgetBar` · `BudgetLineRow` | The running budget |
| `SavingHintChip` | One-tap tradeoff/saving |
| `ChangedBadge` / `DiffHighlight` | Marks what a refinement changed |
| `QuickRefineChips` | Common refinement shortcuts |

All components are theme-driven (light/dark) via Tailwind tokens; prices use tabular
figures; motion via shared Framer Motion variants (`staggerIn`, `growBar`, `pulseChanged`).

---

## Responsive behavior

- **Desktop:** split view — chat (left ~40%) + plan & budget (right ~60%). Budget docked in
  the plan column.
- **Mobile:** single column — plan on top (collapsible to summary), chat below, budget as a
  sticky bottom bar that expands on tap. The refine input is always reachable.

## Accessibility (target, v1 per NFR-8)

- Full keyboard nav of chat and cards; visible focus states.
- Source/budget/itinerary components carry screen-reader labels (price + source read
  together: "€620, mock estimate").
- Color is never the only signal for budget state (icons + text accompany green/amber/red).
- Motion respects `prefers-reduced-motion`.

---

## The feel, in one line

**A calm, warm planning companion that does the money math for you and shows its work** —
conversational, transparent, and quietly delightful as the trip assembles itself in front
of you.
