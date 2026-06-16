# Landing Page

The marketing front door (`/`), modeled on [layla.ai](https://layla.ai), re-skinned
**white + azure**, photo-rich. Section-by-section with layout, copy (see also
[CONTENT_VOICE.md](./CONTENT_VOICE.md)), and components ([COMPONENTS.md](./COMPONENTS.md)).

**Container:** `max-w-site` (1200px), centered. **Section rhythm:** 96px desktop / 64px
mobile vertical spacing. White background throughout; photography supplies the color.

---

## Section order (top → bottom)

```
1  TopNav (sticky)
2  Hero — headline + live prompt box over a destination photo
3  "Where to go next" — TripCard row
4  Four ValueCards
5  All-in-one planner — product shot + CTA
6  Trip types — TripTypeGrid
7  Partners — PartnerLogoRow
8  Press — PressStrip
9  Testimonials — TestimonialCarousel
10 FAQ — FAQAccordion
11 SiteFooter
```

---

### 1. TopNav
- Left: Wayfare wordmark (azure mark/dot). Center/right: `How it works`, `Trip types`,
  `Pricing` (placeholder), primary `Button` **"Plan my trip"** → `/plan`.
- Transparent over the hero photo at top; on scroll, becomes white with a hairline `border-b`.
- < md: hamburger → slide-down menu.

### 2. Hero  ⭐
- **Layout:** full-bleed destination photo (sun-soaked, aspirational) with a left-aligned or
  centered text block over a `--scrim` gradient for legibility. Height ~78vh desktop,
  auto mobile.
- **Headline (`display`):** `Your trip. Planned in minutes.`
- **Subhead (`body`, ink-2 on light / white on photo):** `Tell us the trip you want — we'll
  plan it, price it, and keep it honest.`
- **`HeroPrompt`** front and center: large rounded input
  (`Describe your dream trip… e.g. "relaxed 8 days in Greece for two, ~€2,500"`) + azure send.
  Below it, three `ExamplePromptChips`. Submitting routes to `/plan` with the prompt.
- One primary action only. No competing CTAs in the hero.

### 3. "Where to go next"
- `h2` `Where to go next` + a row of 3–4 `TripCard`s (photo, place, "8 days · from €2,410",
  vibe tag). `staggerIn`. Tapping a card seeds that prompt and enters the app.
- Mobile: horizontal scroll-snap.

### 4. Four ValueCards
- `h2` (e.g. `Why Wayfare`) + 2×2 (desktop) / stacked (mobile) `ValueCard` grid:
  **Tailor-made · Cheaper · Hidden gems · No surprises** (copy in CONTENT_VOICE). Azure line
  icons, `surface` cards.

### 5. All-in-one planner
- Two-column: left = copy `Flights, stays, activities, and a running budget — all in one
  chat.` + primary `Button` "Start planning". Right = a **product shot** of the
  ItineraryPanel + azure BudgetPanel (use a real screenshot/exported component once built).
- Reinforces the honest-budget differentiator (show the SourceChip + total).

### 6. Trip types
- `h2` `Plan any kind of trip` + `TripTypeGrid` (couple · family · solo · weekend · road trip
  · group · luxury · bleisure). Each → `/plan/:type` with a seeded prompt (CONTENT_VOICE
  presets). Photo chips or small cards.

### 7. Partners
- `PartnerLogoRow`: Skyscanner · Booking.com · Viator · GetYourGuide (greyscale) + caption
  `Prices and booking via trusted partners.` (Booking is a later phase — this sets trust.)

### 8. Press
- `PressStrip` "As seen in" — placeholder logos until real coverage.

### 9. Testimonials
- `h2` + `TestimonialCarousel`. Cards: avatar, quote, trip taken, ★ azure rating. Dots /
  arrows. Placeholder content ok this pass (clearly sample).

### 10. FAQ
- `h2` `Questions, answered` + `FAQAccordion` (8–10). Seed items:
  - *How accurate are the prices?* — explain estimate vs. live + source/freshness honesty.
  - *Can I book through Wayfare?* — booking hand-off is coming; today we plan + price.
  - *Is it free?* — yes to plan.
  - *How does it know my budget?* — you tell it; it optimizes the whole trip and shows the math.
  - *Can I change the plan?* — yes, just chat ("make it cheaper", "swap the hotel").
  - *Which destinations?* — anywhere; some have richer data than others (honest).
  - *Do I need an account?* — not to plan.
  - *What about flights from my city?* — give an origin and it tailors prices.

### 11. SiteFooter
- Columns: **Product** (Plan a trip, Trip types, How it works) · **Company** (About, Blog) ·
  **Legal** (Privacy, Terms) · **Top destinations** (SEO links). Language switcher (later),
  social icons, `Made with 💙 by Wayfare.`

---

## Responsive

- **Desktop:** centered `max-w-site`; hero ~78vh; 4-up partner row; 2×2 value cards.
- **Tablet:** value cards 2×2; trip cards scroll-snap; hero text recenters.
- **Mobile:** single column; hero prompt box full-width with comfortable tap target; sections
  stack at 64px rhythm; carousels become scroll-snap.

## Performance & a11y

- Lazy-load below-the-fold imagery; preload the hero photo + display font (avoid FOUT/CLS).
- All images have meaningful `alt`; decorative ones `alt=""`.
- Headings form a correct outline (one `h1` = hero headline).
- Carousels keyboard-navigable; FAQ uses real disclosure semantics.
- Color never the only signal; azure focus rings on every interactive element.

## Out of scope this pass
Real testimonials/press, booking deep-links, i18n switching, pricing page. Lay out the slots;
fill with clearly-sample content.
