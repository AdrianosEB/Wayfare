# Content & Voice

Wayfare sounds like a **friendly, money-aware travel sidekick** — warm and encouraging like
Layla ("less stress, more serotonin"), but always honest about price. Designed for budget
students *and* mainstream travelers, so never elitist, never jargon.

## Voice principles

- **Plain & warm.** Short sentences. "We'll plan it and price it." Not "Leverage our AI to
  optimize your travel spend."
- **Money-honest.** Always say where a price comes from and when it's an estimate. Surface
  tradeoffs, don't hide them.
- **Encouraging, low-pressure.** Offer, don't push. "Want me to…?" not "You must…".
- **First person plural / sidekick.** "We", "I'll" — Wayfare is a companion.
- **Never interrogate.** Ask only what's missing; one batch of questions, each skippable.

## Marketing copy deck (landing)

- **Hero headline:** `Your trip. Planned in minutes.`
- **Hero subhead:** `Tell us the trip you want — we'll plan it, price it, and keep it honest.`
- **Prompt placeholder:** `Describe your dream trip… e.g. "relaxed 8 days in Greece for two, ~€2,500"`
- **Primary CTA:** `Plan my trip`
- **Value cards:**
  - **Tailor-made** — `A plan shaped to your dates, budget, and vibe — not a template.`
  - **Cheaper** — `We optimize the whole trip against your budget, and show the math.`
  - **Hidden gems** — `Beyond the tourist list — local picks and free finds.`
  - **No surprises** — `Every price sourced and dated. The total is always honest.`
- **All-in-one section:** `Flights, stays, activities, and a running budget — all in one chat.`
- **Partners caption:** `Prices and booking via trusted partners.`
- **Footer signoff:** `Made with 💙 by Wayfare.`

## Example prompts (empty-state chips — span the personas)

1. `Cheap sunny week in Europe in March, flexible dates, max €600, just me`
2. `Relaxed 8-day beach trip in Greece in late August for two, around €2,500`
3. `4-day city break that's fun for kids over Easter, around £1,800, from Manchester`

Rotate/shuffle on the landing hero; show all three on the app empty state.

## Trip-type presets (`/plan/:type` — seed a tailored prompt)

| Type | Card label | Seeded prompt |
|---|---|---|
| `couple` | Couples & honeymoons | `Romantic week away for two, somewhere warm, mid-range budget` |
| `family` | Family vacations | `Family trip the kids will love, 5–7 days, easygoing pace` |
| `solo` | Solo travel | `Solo adventure, meet people, safe and budget-friendly, ~10 days` |
| `weekend` | Weekend getaways | `Quick weekend break somewhere new, 2–3 days, not too far` |
| `roadtrip` | Road trips | `Scenic road trip with great stops, about a week` |
| `group` | Group trips | `Trip for a group of friends, fun nightlife, split-friendly budget` |
| `luxury` | Luxury escapes | `A special splurge trip, beautiful hotels, ~1 week` |
| `bleisure` | Work + leisure | `Add a few leisure days onto a work trip in <city>` |

## Agent / app microcopy

| Moment | Copy |
|---|---|
| First reply (clarify intro) | `Nice — {summary}. Just a couple of quick things:` |
| Skip default shown | `Skip — I'll assume {default}` |
| Streaming status lines | `Searching flights {from}→{to}…` · `Comparing stays in {place}…` · `Finding things to do…` · `Costing it out…` |
| Plan ready | `Here's your trip: {summary} — {total} for {party}.` |
| Saving hint | `💡 {hint} — saves {amount}. Want me to?` |
| Over budget | `That's about {overage} over your {target} target. Want me to trim {item} (−{amount}), or keep it?` |
| Refine ack | `Done — {n} change{s}:` |
| Info answer (no re-plan) | answer the question, then: `Want me to change anything, or leave it as is?` |
| Assumptions reveal | `Assumptions I made: {list}. Tell me to tighten any.` |

## States copy

- **Empty (no plan yet):** `Tell me about your trip and I'll plan the whole thing — flights, stays, and a day-by-day plan that fits your budget.`
- **Loading/streaming:** (use the status lines above; never a bare spinner)
- **Error (plan failed):** `Something went wrong putting that together. Want me to try again?`
- **Degraded prices:** `Some prices here are estimates while I couldn't reach a live source — they're labeled.`
- **Empty budget panel:** `Your running total appears here — every price sourced.`
- **Off-topic prompt:** `I'm your trip planner — tell me where you'd like to go and I'll take it from there.`

## Price honesty labels (render from `Listing.freshness`)

| freshness | Chip text | Color token |
|---|---|---|
| `mock` / `estimate` | `Estimated` | `--estimate` |
| `cached` | `Live · {provider} · {age}` | `--live` |
| `live` | `Live · {provider}` | `--live` |

In this frontend pass everything is `Estimated` (mock). The chip must read the field — never
hardcode the label — so it upgrades automatically when real providers land.

## Writing rules

- Currency in the trip's currency, symbol-first (`€2,410`, `£1,800`), tabular figures.
- Sentence case for buttons and headings ("Plan my trip", not "Plan My Trip").
- Dates human ("late August", "Aug 23–31"), not ISO, in user-facing text.
- Never claim a price is bookable/guaranteed when it's an estimate.
