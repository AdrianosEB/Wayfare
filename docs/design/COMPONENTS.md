# Component Library

Build bottom-up from these. Each spec lists **props**, **states**, **visual**, and **a11y**.
Props reference `@wayfare/shared` types (`Trip`, `Listing`, `Budget`, `ClarifyQuestion`,
etc.) — import them, never redefine. Use tokens from [TOKENS.md](./TOKENS.md) and variants
from [MOTION.md](./MOTION.md).

Conventions: all components are TS + Tailwind; prices use `.tnum`; every interactive element
has a visible azure focus ring; nothing is color-only.

### Imagery (frontend-supplied — not from the API)

The wire contract has **no image fields** and we're not adding any this pass. All photography
is supplied by the client:

- Add a small helper `apps/web/src/lib/images.ts` that maps a key (destination name, trip
  vibe, or stay/activity category) → an image URL. Back it with a **curated set** of a dozen
  or so tasteful destination/lifestyle photos (bundled in `public/img/` or hotlinked from a
  stock source like Unsplash). Provide a deterministic fallback so any key returns *something*
  on-brand (sun-soaked, azure-friendly).
- Components that show a photo (`TripCard`, `StayCard`, `HeroPrompt`, `TripHeader`,
  `TripTypeGrid`) take a **plain `image: string` prop**. The screen/data layer calls
  `images.for(key)` to fill it — components never fetch images themselves and never read an
  image field off `Listing`/`Trip` (there isn't one).
- This is the **swap seam**: when the backend later carries `imageUrl` (Option B), only
  `images.ts` / the data layer changes — the components stay identical.
- Always set meaningful `alt`; lazy-load below-the-fold; reserve aspect ratio to avoid CLS.

---

## Primitives

### `Button`
- **Props:** `variant: 'primary'|'secondary'|'ghost'|'pill'`, `size?: 'md'|'lg'`, `iconLeft?`,
  `iconRight?`, `loading?`, `disabled?`, standard button attrs.
- **Visual:** per TOKENS §4. Primary = `bg-azure-500 text-white hover:bg-azure-600`,
  radius `pill` (CTAs/chips) or `md`. `lg` = 52px (hero). Loading shows a spinner, keeps width.
- **a11y:** real `<button>`; `aria-busy` when loading; disabled not focusable.

### `Chip`
- **Props:** `selected?`, `onRemove?`, `as?: 'button'|'span'`, `icon?`.
- **Visual:** `bg-azure-50 text-azure-700` (idle) → `bg-azure-100` hover; selected =
  `bg-azure-500 text-white`. Radius `pill`, 32–36px tall.
- **Use:** example prompts, quick-refine, trip-type, multi-select answers, saving hints.

### `Card`
- **Props:** `interactive?`, `padded?` (default true), `as?`.
- **Visual:** white/`surface`, `rounded-lg`, `shadow-card`. `interactive` adds `cardHover`
  lift + pointer.

### `SourceChip`  ⭐ (trust marker — appears with every price)
- **Props:** `listing: Listing` (reads `source`, `freshness`, `fetchedAt`).
- **Visual:** tiny `xs` pill. `mock|estimate` → dot `--estimate` + "Estimated".
  `live|cached` → dot `--live` + "Live · {provider} · {age}". Tooltip on tap/hover explains.
- **Rule:** label/color come from data only. Never hardcode "mock".
- **a11y:** price + source announced together ("€620, estimated").

### `Price`
- **Props:** `money: Money`, `size?`, `emphasis?`.
- **Visual:** symbol-first, `.tnum`. Pair with `SourceChip` wherever a real listing price
  shows.

### `Stepper`, `CityAutocomplete`, `ShortText`, `ChipSelect`
- Low-friction inputs for clarifying questions. `Stepper` = adults/children(+ages).
  `CityAutocomplete` = text + suggestions (mock list ok this pass). `ChipSelect` = single or
  multi (`multi?: boolean`). All emit values per API_CONTRACT answer shapes.

---

## Marketing components

### `TopNav`
- **Props:** `transparentOnTop?` (hero overlay), links, CTA.
- **Visual:** white, sticky `z-30`, hairline `border` appears on scroll. Wordmark with azure
  mark on left; links center/right; primary `Button` "Plan my trip".
- **Responsive:** collapses to a menu button < md.

### `HeroPrompt`  ⭐
- **Props:** `placeholder`, `examples: string[]`, `onSubmit(prompt)`.
- **Visual:** big `display` headline + `body` subhead; **a live prompt box** (large rounded
  input, `shadow-float`, azure send button) — typing + submit routes into `/plan`. Example
  `Chip`s below. Full-bleed destination photo behind with `--scrim` for legibility.
- **a11y:** the input is a labeled form; Enter submits.

### `TripCard`  ⭐
- **Props:** `image`, `place`, `lengthDays`, `fromPrice: Money`, `vibeTag`, `onClick` (seeds
  a prompt).
- **Visual:** photo top (16:10), `rounded-lg`, place + "8 days · from €2,410" (`.tnum`) +
  vibe `Chip`. `cardHover` lift.

### `ValueCard`
- **Props:** `icon`, `title`, `body`. Four instances (Tailor-made / Cheaper / Hidden gems /
  No surprises — copy in CONTENT_VOICE).
- **Visual:** `surface` card, azure line icon, `h3` + `body`. Grid of 4 (2×2 mobile).

### `TripTypeGrid` / `TripTypeChip`
- **Props:** `types` (from CONTENT_VOICE presets), `onSelect(type)`.
- **Visual:** chips or small photo cards; selecting seeds the tailored prompt and enters the app.

### `PartnerLogoRow`, `PressStrip`
- Greyscale logo rows with a caption. Static this pass (placeholder logos ok).

### `TestimonialCarousel` / `TestimonialCard`
- **Props:** `quote`, `author`, `avatar`, `tripTaken`, `rating`.
- **Visual:** white card, ★ rating in azure, quote `h3`-ish, author row. Carousel with dots.

### `FAQAccordion`
- **Props:** `items: {q, a}[]`.
- **Visual:** list of expandable rows, hairline dividers, azure chevron, smooth height
  animation. One open at a time (or multiple — your call).
- **a11y:** `button` headers, `aria-expanded`, `aria-controls`.

### `SiteFooter`
- Columns (Product, Company, Legal, Top destinations), language switcher (later), social,
  signoff. White with `border-t`.

---

## App components

### `PromptInput`
- **Props:** `value`, `onChange`, `onSubmit`, `variant: 'hero'|'refine'`, `placeholder`,
  `disabled?` (while streaming).
- **Visual:** rounded `lg`, `shadow-card`, azure send button. `hero` is large/centered;
  `refine` is docked at the bottom of the chat.

### `ChatThread` / `MessageBubble`
- **Props (bubble):** `role: 'user'|'agent'`, `children`.
- **Visual:** user bubble = `azure-500` text white, right-aligned; agent = `surface`,
  left-aligned. `fadeIn` on mount. Agent bubbles can embed cards (questions, summaries).

### `AgentStatusLine`
- **Props:** `step`, `message`.
- **Visual:** left-aligned `sm` line with a small azure pulsing dot; `statusLine` variant.
  Renders from SSE `status` events; newest at bottom.

### `QuestionCardStack` + question inputs
- **Props:** `questions: ClarifyQuestion[]`, `onAnswer(map)`, `onSkip(id)`, `onSubmit`.
- **Visual:** stacked `Card`s (`staggerIn`), each = question text + the matching input
  (`ChipSelect`/`Stepper`/`CityAutocomplete`/`ShortText`) + `SkipControl`. A single primary
  "Plan it" `Button` enables when required questions are answered or skipped.
- **a11y:** each card a labeled fieldset; keyboard order top→down.

### `SkipControl`
- **Props:** `skipDefault: string`, `onSkip`.
- **Visual:** ghost link "Skip — I'll assume {default}". Recorded as an assumption.

### `ItineraryPanel`
- **Props:** `trip: Trip`, `streaming?: boolean`.
- **Visual:** scroll container holding header → `FlightCard`s → `StayCard` → `DayTimeline`
  → (v1: `ItineraryMap`). During `streaming`, unfilled blocks show skeletons (`shimmer`),
  filling via `partial` patches.

### `TripHeader`
- **Props:** `summary`, `dates`, `party`, `photos?`.
- **Visual:** `h2` summary, meta row, a thin destination photo strip. `ExportMenu` slot (v1).

### `FlightCard`
- **Props:** `flight: Flight`.
- **Visual:** route (LGW→JTR), times, stops badge, carrier, `Price` + `SourceChip`. Slot for
  `PriceTrendChip` (v1, hidden this pass).

### `StayCard`
- **Props:** `stay: Stay`.
- **Visual:** name, type, ★ rating (azure), key amenities as `Chip`s, "120 m to beach"
  (`distanceToFocus`), nights, `Price` + `SourceChip`.

### `DayTimeline` / `DayCard` / `ActivityItem`
- **Props:** `day: Day` / `item: ItineraryItem`.
- **Visual:** expandable `DayCard` per day (title + date). Inside, ordered `ActivityItem`s
  with time, title, walking distance from previous, kid-suitability mark, and `Price` +
  `SourceChip` when priced. `kind: 'free'` items styled distinctly (azure "Free" tag,
  celebrated). `staggerChild` as they fill in.

### `BudgetPanel`  ⭐
- **Props:** `budget: Budget`, `target?`.
- **Visual:** persistent azure-accented panel. Top: headline `total` vs `target` (`.tnum`,
  count-up), under/on/over color, **`BudgetBar`** (azure fill, `growBar`). Then
  `BudgetLineRow` per category rolling up to total — tap to highlight related itinerary items.
  `SavingHintChip`s. Over-budget: `--over` overage note + offered trims (calm).
- **Responsive:** sidebar (desktop) / sticky bottom bar that expands via `sheet` (mobile).

### `BudgetLineRow`, `BudgetBar`, `SavingHintChip`
- `BudgetLineRow`: category label, amount, mini proportion bar, worst-case freshness dot.
- `SavingHintChip`: "Shift outbound −1 day · save €48" — one tap fires a scoped refine.

### `ChangedBadge` / `DiffHighlight`
- **Props:** `diff: ItemDiff[]` (from refine `complete`).
- **Visual:** wrap changed items; `pulseChanged` once on mount, then a static azure outline +
  "Updated" badge. Budget shows signed delta.

### `QuickRefineChips`
- **Props:** `onPick(text)`.
- **Visual:** row of `Chip`s ("Make it cheaper", "Swap hotel", "Add a day trip") above the
  refine input; tapping sends that refinement.

### `AssumptionsReveal`
- **Props:** `assumptions: Assumption[]`.
- **Visual:** small "ⓘ assumptions" disclosure listing inferred defaults.

---

## v1 / later (design the slot, don't build the flow this pass)
`PriceTrendChip` (flight prediction) · `ItineraryMap` · `VideoMap` · `ExportMenu` (PDF/share)
· partner booking deep-link CTAs · language switcher. Leave clean extension points; keep them
out of the MVP build.
