# Conversation Flow

This is the heart of Wayfare. The product _is_ the conversation. This doc defines how a
raw sentence becomes structured constraints, which clarifying questions exist and when
each fires, and how free-text refinement maps to re-planning.

Design north star: **never interrogate.** Extract everything possible, ask only the few
high-leverage things still missing, let the user skip with a sensible default.

---

## 1. The constraint model

Every prompt is parsed into a `TripRequest` — the set of constraints the agent plans
against. Each field has a **value**, a **source** (`prompt` | `answer` | `default` |
`inferred`), and a **confidence**.

| Field | Type | Required to plan? | If missing → |
|---|---|---|---|
| `destination` | place / region / "somewhere <vibe>" | Yes (or vibe proxy) | **ask** (or propose candidates, v1) |
| `origin` | city / airport | Yes for flights | **ask** |
| `durationDays` | number / range | Yes | **ask** (or derive from dates) |
| `dates` | exact / month / season / flexible window | Yes | **ask** (flexibility matters for price) |
| `partySize` | adults + children(+ages) | Yes | default **1 adult**, confirm if budget tight |
| `budget` | amount + currency + hard/soft | Strongly wanted | **ask** if absent — it governs everything |
| `vibe` | relaxed / packed / party / culture / nature / romantic / family… | Helpful | infer from words; **ask** only if it drives destination |
| `mustHaves` | free list (beach, kid-friendly, near X) | Optional | extract; never block on it |
| `avoid` | free list (been there, no flights >2 stops) | Optional | extract; never block |
| `pace` | relaxed / moderate / packed | Helpful | infer from vibe; default **moderate** |

The agent will not start planning until the **required** set is satisfiable. Everything
else is best-effort with stated defaults.

---

## 2. Prompt parsing

On submit, the **Prompt Parser** (a single structured Claude call with a strict output
schema, validated with Zod) does extraction:

- Pulls each field above out of the sentence, with source=`prompt`, plus a confidence.
- Normalizes: "late August" → `dates: { month: 8, part: 'late', flexibility: 'window' }`;
  "two people" → `partySize: { adults: 2 }`; "around €2,500" → `budget: { amount: 2500,
  currency: 'EUR', type: 'soft' }`; "relaxed beach" → `vibe: ['relaxed','beach']`,
  `pace: 'relaxed'`.
- Flags low-confidence extractions for confirmation rather than silent assumption.

Worked example — the canonical sentence:

> _"I want a relaxed 8-day beach trip in Greece in late August for two people, around
> €2,500 total"_

```jsonc
{
  "destination": { "value": "Greece", "source": "prompt", "confidence": 0.95 },
  "durationDays": { "value": 8, "source": "prompt", "confidence": 0.98 },
  "dates":       { "value": { "month": 8, "part": "late", "flexibility": "window" },
                   "source": "prompt", "confidence": 0.9 },
  "partySize":   { "value": { "adults": 2 }, "source": "prompt", "confidence": 0.95 },
  "budget":      { "value": { "amount": 2500, "currency": "EUR", "type": "soft" },
                   "source": "prompt", "confidence": 0.9 },
  "vibe":        { "value": ["relaxed","beach"], "source": "prompt", "confidence": 0.9 },
  "pace":        { "value": "relaxed", "source": "inferred", "confidence": 0.8 },
  "origin":      null,        // ← MISSING, required
  "mustHaves":   { "value": ["beach"], "source": "prompt", "confidence": 0.8 }
}
```

Missing required: **origin**. Greece is a multi-island region with a big lively/quiet
split, so the agent also picks **one** high-leverage optional question (vibe within
Greece). Result: **2 clarifying cards**, not a form.

---

## 3. The clarifying-question catalogue

Each question has: an **id**, a **trigger condition** (when it fires), a **format**, and a
**default** used on skip. The selector asks at most **4** questions, ranked by leverage
(impact on the plan/price), batched into one card stack.

| id | Question | Fires when | Format | Skip default |
|---|---|---|---|---|
| `origin` | "Where are you flying from?" | `origin` missing | short text / city autocomplete | infer nearest major hub from locale; state it |
| `dates_exact` | "Fixed dates, or flexible within <window>?" | dates only a month/season | chips: _fixed_ / _flexible ±3d_ / _very flexible_ | assume flexible (better prices) |
| `budget` | "Roughly what's your total budget?" | `budget` missing | short text + currency, or chips (£, €, $ bands) | plan a mid-range trip; show total prominently |
| `budget_firmness` | "Is that a hard cap or a target?" | budget present, firmness unknown | chips: _hard cap_ / _flexible_ | treat as soft target |
| `party` | "Just you, or who's coming?" | `partySize` missing | stepper adults/children(+ages) | 1 adult |
| `vibe_dest` | "More lively or quieter?" / region-specific split | destination has a strong vibe axis & vibe unset | 2–4 chips | balanced default for the region |
| `duration` | "How many days?" | duration & dates can't yield length | number / chips (weekend / ~1wk / ~2wk) | 7 days |
| `interests` | "Anything you really want to do?" | vibe vague & no mustHaves, esp. families | multi-select (beach, food, history, nightlife, nature, kids…) | balanced mix |
| `avoid` | "Anywhere/anything to skip?" | only asked if cheap and slot available | short text | none |

Rules the selector follows:

1. **Never ask what's already known.** A field with source `prompt`/`answer` is off the list.
2. **Leverage-rank, then cap at 4.** Origin and budget are near-always top. Vibe/interests
   only when they actually change the plan.
3. **One batch.** All selected questions present together as a card stack; planning starts
   when answered or skipped. No drip-feed interrogation.
4. **Every question is skippable** and carries a stated default (US-2.3). Skips become
   visible "assumptions" in the plan (US-5.2).
5. **Confirm, don't re-ask, low-confidence extractions.** A 0.5-confidence budget shows as
   a pre-filled chip ("€2,500 — right?") not an open question.

---

## 4. From answers to a plan

When answers (or skips) come back, they merge into the `TripRequest` (source=`answer` /
`default`), and the API opens the SSE stream and hands the completed constraints to the
planning agent. The user sees streamed progress, not a spinner. See
[AGENT_DESIGN.md](./AGENT_DESIGN.md) for the scour→rank→assemble loop.

---

## 5. The refine-by-chat loop

After a plan exists, every user message is a **refinement**. A refinement is classified
(one fast structured Claude call) into: **scope** (what parts of the trip it touches) +
**intent** (the change). This classification is what makes re-planning cheap (US-4.2): we
only re-run the agent over the affected slice.

### Refinement scopes

| Scope | Example utterances | What re-plans | What stays frozen |
|---|---|---|---|
| `budget_global` | "make it cheaper", "I found another €300" | re-optimize whole trip toward new target, cheapest-impact-first | structure/vibe preserved where possible |
| `lodging` | "swap the hotel", "somewhere nearer the beach", "I want a pool" | accommodation only (+ any walking-distance-dependent activities) | flights, ferries, most activity days |
| `flights` | "earlier flight", "avoid the layover", "fly from Gatwick instead" | transport only | stay, activities |
| `activity_day` | "add a day trip to Hydra", "day 3 is too packed", "less hiking" | the named/affected day(s) only | all other days, flights, stay |
| `dates` | "go a week earlier", "make it 10 days" | dates → re-price flights/stay; re-flow days | preferences/vibe |
| `destination` | "actually, what about Italy?" | effectively a re-plan (new region) | party, budget, vibe carried over |
| `info` | "is the water warm in August?", "why this hotel?" | nothing — answer in chat, no re-plan | everything |

`info` is important: not every message changes the trip. Questions get answers, not
itineraries.

### Re-planning contract

- A scoped refinement re-runs the agent with the existing trip as context and a directive
  to **change only `scope` and keep everything else identical**. The integration calls are
  limited to the affected category.
- The result is **diffed** against the current version; changed items are marked and a
  budget delta is shown (US-4.4). A new trip version is persisted (enables undo later).
- **Budget guardrail (US-4.3):** if the change pushes a hard cap over, the agent does not
  silently exceed it — it returns the over-budget plan flagged with the overage and ≥1
  concrete trim ("drop the boat trip −€85, or pick the studio one row back −€60").

---

## 6. Example dialogues

### Dialogue A — full happy path (the Greek trip)

```
User:  I want a relaxed 8-day beach trip in Greece in late August for two people,
       around €2,500 total

Wayfare:  Nice — a relaxed 8 days by the sea in Greece, late August, for two, ~€2,500.
          Two quick things:
          ┌────────────────────────────┐  ┌──────────────────────────────────────┐
          │ Where are you flying from? │  │ Lively (Mykonos) or quieter            │
          │ [______________]           │  │ (Naxos / Milos)?                       │
          └────────────────────────────┘  │ [ Lively ] [ Quieter ] [ Mix ]         │
                                           └──────────────────────────────────────┘

User:  London — quieter, but one fun night out is fine

Wayfare:  (streaming) Searching flights London→Greek islands… comparing island stays…
          finding beaches & a boat trip… costing it out…

          ✦ Your trip: 8 days on Naxos — €2,410 for two
          Flights LGW→JTR + ferry to Naxos · beachfront studio, Agios Prokopios ·
          gentle beach days · half-day boat trip · one lively night in Naxos Town
          Budget: flights €620 · ferries €96 · stay €980 · activities €414 · buffer €300
          💡 Shifting your outbound one day earlier saves €48 — want me to?
```

### Dialogue B — refinement, scoped to lodging + one day

```
User:  swap the hotel for something nearer the beach, and add a day trip to a
       quieter island

Wayfare:  (re-planning lodging + adding one day; flights & other days unchanged)
          Done — 2 changes:
          • Hotel → Studio Thalassa, 2-min walk to Agios Prokopios beach (+€60)
          • Added: Koufonisia day trip on Day 5, incl. ferry (+€85)
          New total: €2,555  ⚠ ~€55 over your €2,500 target.
          Want me to keep it, or trim the boat trip (−€85) to come back under?
```

### Dialogue C — skip → stated assumption

```
User:  cheap sunny week somewhere in Europe in March, flexible dates, max €600, just me

Wayfare:  Got it — solo, ~1 week, sunny Europe in March, hard €600 cap, flexible dates.
          One thing: where are you flying from?  [ skip ]

User:  (taps skip)

Wayfare:  No problem — I'll assume you're flexible on origin and start from major hubs
          near you. (You can tell me a city anytime to tighten prices.)
          (streaming) …
          ✦ Valencia, Spain — €560 total · 🛈 assumed origin: Berlin (your locale)
```

### Dialogue D — info, no re-plan

```
User:  why Naxos over Mykonos?

Wayfare:  You said quieter — Naxos has long sandy beaches (Agios Prokopios, Plaka),
          cheaper stays than Mykonos (your studio is ~40% less), and an easy ferry hop
          to even quieter islands for your day trip. Mykonos would've pushed the stay
          line ~€500 higher for the same nights. Want me to price a Mykonos version to
          compare?  (I won't change anything unless you say so.)
```

Note in D: Wayfare answers and _offers_ a re-plan rather than performing one — `info`
scope changes nothing until the user opts in.

---

## 7. Guardrails

- **Off-topic / abusive prompts (NFR-10):** politely redirect to trip planning; don't
  fabricate a trip from nonsense.
- **Under-constrained to the point of meaninglessness** ("plan me a trip"): ask the
  smallest viable set — destination-or-vibe, budget, and when — before anything else.
- **Contradictions** ("2 days, visit 5 countries, €100"): surface the tension honestly and
  propose the closest feasible trip rather than pretending.
