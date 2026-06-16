# Design System

> **Reference model:** [layla.ai](https://layla.ai) — a leading AI trip planner. Wayfare
> adopts Layla's clean, white, photo-rich, card-based, conversational structure and its
> full option surface, but swaps Layla's purple accent for **bright sky-azure on white**.
> This doc supersedes the earlier "warm sunset" direction.

Wayfare is **prompt-first**: you describe a trip in one sentence and a costed plan
materializes. The visual job is to make that feel like a **friendly travel sidekick, not a
spreadsheet** — aspirational imagery, generous whitespace, and a calm azure accent that
signals trust and clarity.

---

## 1. Design direction

| Principle | What it means here |
|---|---|
| **White-dominant, azure-accented** | White/near-white is ~90% of every screen. Azure is used with intent: primary actions, active states, links, the running-budget highlight, brand marks. Never azure walls. |
| **Photo-rich & aspirational** | Big sun-soaked destination/lifestyle photography in the hero, trip cards, and section backers — like Layla. Photography sells the dream; the azure UI organizes it. |
| **Conversational, not configurational** | One prompt box is the front door. Forms are a last resort (only the few missing clarifying questions). |
| **Money always visible & honest** | The running budget is a persistent, calm azure panel; every price shows its source + freshness. |
| **Calm, purposeful motion** | Cards fade/slide in as the agent thinks; the budget bar grows; changed items pulse on refine. Never decorative jitter. |
| **Light, airy, modern** | Large radii, soft shadows, lots of breathing room. Closer to a premium consumer travel app than an OTA funnel. |

**Mood words:** effortless · sunlit · trustworthy · clean · sidekick.

---

## 2. Design tokens

Implemented as CSS variables + Tailwind theme extensions in `apps/web`. Names are the
contract; tweak values freely.

### Color

```
/* Base / surfaces — white dominant */
--color-bg            #FFFFFF   page background
--color-surface       #F7F9FC   cards, panels (very light cool gray)
--color-surface-2     #EEF3FA   nested / hover surfaces
--color-border        #E2E8F0   hairline borders
--color-overlay-scrim rgba(15,23,42,.45)  photo overlays for legible text

/* Ink / text */
--color-ink           #0F172A   primary text (slate-900)
--color-ink-2         #475569   secondary text
--color-ink-3         #94A3B8   tertiary / captions

/* Azure — the accent (bright sky/azure) */
--color-azure-50      #EAF2FE   tints, hovered chips, budget fill bg
--color-azure-100     #D6E6FD
--color-azure-200     #AFCFFB
--color-azure-400     #5C9CF0
--color-azure-500     #2F80ED   PRIMARY — buttons, links, active
--color-azure-600     #1E6FE0   hover/pressed
--color-azure-700     #1A5FBF   text-on-light emphasis
--color-azure-ring    rgba(47,128,237,.35)  focus ring

/* Semantic — budget state (used sparingly, never alarmist) */
--color-under         #16A34A   under budget (green)
--color-on-target     #2F80ED   on target (azure, not amber — stays on-brand)
--color-over          #E0533D   over budget (warm red-coral)

/* Source/freshness chips */
--color-live          #16A34A   live price
--color-estimate      #94A3B8   mock/estimate (neutral, honest)
```

Dark mode is **deferred** (Layla is light-only; ship light first). Tokens are structured so
a dark theme can be added later without renaming.

### Typography

- **Display / headings:** a friendly geometric sans — **General Sans** or **Inter
  Display**. Big, tight hero (e.g. 56–72px desktop), medium weight.
- **Body / UI:** **Inter**. 16px base, 1.6 line-height in prose.
- **Numerals:** **tabular figures everywhere prices appear** so budgets align in columns.
- Scale (desktop): `display 64 / h1 40 / h2 30 / h3 22 / body 16 / sm 14 / xs 12`.

### Shape, depth, spacing, motion

```
--radius-sm 10px   --radius-md 16px   --radius-lg 24px   --radius-pill 999px
--shadow-card  0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06)
--shadow-float 0 12px 40px rgba(15,23,42,.12)
spacing: 4px base grid (4/8/12/16/24/32/48/64/96)
motion (Framer Motion): staggerIn 60ms, ease [0.22,1,0.36,1]; budget bar growBar 600ms;
        pulseChanged on refined items; reveal agent status lines like typing
```

---

## 3. The full option surface (everything Layla offers, mapped to Wayfare)

The UI is designed to host **all** of these. Each is tagged by phase so the design shows
the full ambition while the build stays staged.

| Capability | Layla has it | Wayfare phase | UI home |
|---|---|---|---|
| Conversational prompt planning | ✓ | **MVP** | Prompt entry + chat |
| Day-by-day itinerary | ✓ | **MVP** | Itinerary view |
| Flights (search + compare) | ✓ | MVP (mock) → v1 | Flights block, FlightCard |
| Flight **price prediction** | ✓ | v1 | Price-trend chip on FlightCard |
| Hotels / stays (filter by budget, amenities, rating) | ✓ | MVP (mock) → v1 | Stay block, StayCard, filters |
| Activities & experiences | ✓ | MVP (mock) → v1 | DayTimeline, ActivityItem |
| Trains | ✓ | v1 | Transit items |
| Car rental / private transfers | ✓ | v1 | Transit / add-on cards |
| Real-time customization (swap, add day, adjust budget) | ✓ | **MVP** | Refine chat + quick chips |
| Running budget / budget optimization | ✓ | **MVP** | BudgetPanel (azure) |
| Multi-city & **road-trip route** planning | ✓ | v1 | Route map + multi-leg itinerary |
| Interactive **map** of the trip | ✓ | v1 | ItineraryMap |
| **Video / creator content** on map | ✓ | later | VideoMap overlay |
| Trip categories (couple, family, solo, weekend, road trip, group, luxury, bleisure) | ✓ | **MVP** (as entry points) | Landing "trip types" + prompt presets |
| **PDF export** / offline itinerary | ✓ | v1 | Export button |
| Booking hand-off (Skyscanner, Booking.com, Viator, GetYourGuide) | ✓ | later | Deep-link CTAs + partner row |
| Multi-language (16 languages) | ✓ | later | i18n; language switcher in footer |
| Save / account / share | partial | later | Account, share link |

Honesty rule carries through every priced surface: in MVP all prices render an
**"Estimated"** chip (mock); the same component shows **"Live · Skyscanner · 2h ago"** later
with zero redesign (reads from `Listing.source`/`freshness`).

---

## 4. Site map (full Layla-style site + app)

```
Wayfare
├── Marketing landing  (/)                ← Layla-style, sells the dream
│     hero · sample trips · value cards · all-in-one · trip types ·
│     partners · press · testimonials · FAQ · footer
├── Trip-type landings (/plan/:type)      ← couple, family, solo, road-trip… (SEO + presets)
└── App / Planner       (/plan)           ← the product
      prompt entry → clarifying cards → streaming plan →
      itinerary + budget + map → refine chat → export / book
```

---

## 5. Marketing landing page — section-by-section

Mirrors Layla's structure, re-skinned white + azure, photo-rich.

1. **Top nav** — left: Wayfare wordmark (azure dot/mark). Center/right: `How it works`,
   `Trip types`, `Pricing`(later), and a solid azure **"Plan my trip"** button. Sticky,
   white, hairline border on scroll.
2. **Hero** — oversized headline **"Your trip. Planned in minutes."** + one-line subhead.
   Beneath it, **the live prompt box itself** (not just a button) — a big rounded input
   "Describe your dream trip…" with an azure send button and 2–3 example-prompt chips. A
   full-bleed sun-soaked destination photo (or soft collage) sits behind/below with a light
   scrim for legibility. *Typing here drops you straight into the app.*
3. **"Where to go next"** — a row of 3–4 **TripCard**s (photo, place, "8 days · from €2,410",
   vibe tag). Tapping one seeds a prompt.
4. **Four value cards** (Layla's exact value props, our copy):
   - **Tailor-made** — "A plan shaped to your dates, budget and vibe."
   - **Cheaper** — "We optimize the whole trip against your budget."
   - **Hidden gems** — "Beyond the tourist list — local picks and free finds."
   - **No surprises** — "Every price sourced and dated. The total is always honest."
5. **All-in-one planner** — a product shot of the itinerary + azure budget panel, with copy
   "Flights, stays, activities and a running budget — in one chat." CTA "Start planning".
6. **Trip types** — chips/cards for couple · family · solo · weekend · road trip · group ·
   luxury · bleisure → each links to `/plan/:type` and preloads a tailored prompt.
7. **Partners** — logo row: Skyscanner · Booking.com · Viator · GetYourGuide (greyscale,
   "Prices & booking via trusted partners"). *(booking is a later phase; row sets trust.)*
8. **Press** — "As seen in" logo strip (placeholder until real).
9. **Testimonials** — TestimonialCard carousel (avatar, quote, trip taken, ★ rating).
10. **FAQ** — FAQAccordion, 8–10 Q&As (How accurate are prices? Can I book? Is it free?…).
11. **Footer** — columns: Product, Company, Legal, **Top destinations** (SEO links),
    language switcher, social, "Made with 💙 by Wayfare".

---

## 6. App / planner screens

### 6.1 Prompt entry (front door of the app)
Centered, near-empty, inviting. Large prompt box ("Where do you want to go?"), azure send,
example-prompt chips spanning personas (tight-budget solo, the €2,500 Greek couple, a
family city break). No nav clutter, no filters.

### 6.2 Clarifying-question cards
After submit: the agent's first line + a **card stack of ≤4** questions, lowest-friction
inputs (chips, stepper, city autocomplete, short text). Each card has a visible **Skip**
showing the default it'll assume. One **"Plan it"** azure CTA lights up when required ones
are satisfied. Cards animate in together.

### 6.3 Planning / streaming state
Streamed **azure status lines** ("Searching flights London→Greece…", "Comparing island
stays…", "Costing it out…"). The itinerary panel fills progressively (flights → stay →
days) with skeleton→content transitions; the budget bar grows. Never a blank spinner.

### 6.4 Itinerary view (the centerpiece)
Two-column desktop (chat left ~40%, plan right ~60%); stacked on mobile.
- **Header:** one-line summary ("8 days on Naxos — €2,410 for two"), dates, party, a
  destination photo strip.
- **Flights block** → FlightCard (times, stops, carrier, price + source chip, later a
  price-trend chip).
- **Stay block** → StayCard (name, type, ★, key amenities, "120 m to beach", nights, price +
  source chip).
- **Day-by-day timeline** → expandable DayCard per day; ordered activity/meal/transit items
  with times, walking distances, kid-suitability marks; "free" items styled distinctly and
  celebrated for budget users.
- **Map** (v1): ItineraryMap pinning stay + activities; toggle alongside the timeline.
- **Source/freshness chip** on every price; tap → what it means. The trust surface.
- **Assumptions** reveal — small "ⓘ assumptions" listing inferred defaults.
- **Export / Book** (later): PDF export, deep-link CTAs to partners.

### 6.5 Budget panel (always present, azure)
Persistent (sidebar desktop / sticky bar mobile).
- Headline **total vs target**, under/on/over state, an **azure progress bar**.
- Category breakdown (flights, stay, activities, transit, food, buffer) rolling up to the
  total; tap a line to highlight its itinerary items.
- **Saving-hint chips** ("Shift outbound −1 day · save €48") — one tap applies (scoped
  refine).
- Over-budget: calm overage + offered trims (warm red, not alarmist).

### 6.6 Refine chat
Same thread continues. Natural-language refinements; after each, a concise "what changed"
message, changed items marked (azure outline/pulse), budget delta shown. **QuickRefineChips**
("Make it cheaper", "Swap hotel", "Add a day trip") lower discovery friction.

---

## 7. Component inventory

**Marketing**
| Component | Role |
|---|---|
| `TopNav` / `NavCTA` | Sticky white nav + azure "Plan my trip" |
| `HeroPrompt` | Hero headline + live prompt box + example chips over photo |
| `TripCard` | Photo destination card ("8 days · from €2,410 · Beach") |
| `ValueCard` | Tailor-made / Cheaper / Hidden gems / No surprises |
| `TripTypeChip` / `TripTypeGrid` | Couple, family, solo, road-trip… entry points |
| `PartnerLogoRow` | Skyscanner / Booking / Viator / GetYourGuide |
| `PressStrip` | "As seen in" |
| `TestimonialCard` / `TestimonialCarousel` | Reviews |
| `FAQAccordion` | Expandable Q&A |
| `SiteFooter` | Columns + language switcher + social |

**App**
| Component | Role |
|---|---|
| `PromptInput` | Hero + persistent refine input |
| `ExamplePromptChips` | Starter prompts |
| `ChatThread` / `MessageBubble` | Conversation surface |
| `AgentStatusLine` | Streamed "thinking" lines (azure) |
| `QuestionCardStack` + `ChipSelect`/`Stepper`/`CityAutocomplete`/`ShortText` | Clarifying questions |
| `SkipControl` | Skip + shows assumed default |
| `ItineraryPanel` | Plan container |
| `FlightCard` · `StayCard` · `DayCard`/`DayTimeline` · `ActivityItem` | Plan building blocks |
| `PriceTrendChip` (v1) | Flight price prediction |
| `SourceChip` | Price source + freshness (trust marker) |
| `AssumptionsReveal` | Inferred defaults |
| `ItineraryMap` (v1) | Map of the trip |
| `BudgetPanel` · `BudgetBar` · `BudgetLineRow` · `SavingHintChip` | Running budget (azure) |
| `ChangedBadge` / `DiffHighlight` | What a refine changed |
| `QuickRefineChips` | Common refinements |
| `ExportMenu` (v1) | PDF / share / book hand-off |

All components theme-driven via the tokens above; prices use tabular figures; motion via
shared Framer Motion variants (`staggerIn`, `growBar`, `pulseChanged`).

---

## 8. Voice & content

Friendly, money-aware, never elitist (students + mainstream travelers). Layla's energy
("Less stress, more serotonin") but Wayfare's honesty about price. Microcopy examples:
- Hero subhead: *"Tell us the trip you want. We'll plan it, price it, and keep it honest."*
- Empty budget: *"Your running total appears here — every price sourced."*
- Over budget: *"About €55 over. Want me to trim the boat trip, or keep it?"*

---

## 9. Responsive & accessibility

- **Desktop:** marketing = centered max-w ~1200px; app = split chat/plan; budget docked.
- **Mobile:** single column; plan collapsible to summary; budget as sticky bottom bar; the
  prompt/refine input always reachable.
- **A11y (target):** keyboard-navigable chat & cards; visible azure focus rings; price +
  source read together by screen readers ("€620, estimated"); budget state never color-only
  (icon + text accompany under/on/over); `prefers-reduced-motion` respected.

---

## 10. Implementation spec — `docs/design/`

This overview is backed by an implementation-ready package the frontend builds from:
- **[design/README.md](./design/README.md)** — how to use the package + build order + DoD.
- **[design/TOKENS.md](./design/TOKENS.md)** — colors/type/spacing + drop-in Tailwind config & CSS vars.
- **[design/MOTION.md](./design/MOTION.md)** — the Framer Motion variant catalogue.
- **[design/COMPONENTS.md](./design/COMPONENTS.md)** — per-component props, states, visual specs, a11y.
- **[design/SCREENS.md](./design/SCREENS.md)** — app shell + each planner screen, states, data binding.
- **[design/LANDING_PAGE.md](./design/LANDING_PAGE.md)** — marketing page section-by-section + copy deck.
- **[design/CONTENT_VOICE.md](./design/CONTENT_VOICE.md)** — voice, microcopy, example prompts, trip-type presets.
