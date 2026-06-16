# Vision

## The one-sentence promise

> **A trip planned for you from one sentence.**

You shouldn't have to become a part-time travel agent to take a vacation. Today, planning
a trip means juggling a flight aggregator, two hotel sites, a maps tab, a "things to do"
blog, and a spreadsheet to track whether you're over budget. Wayfare collapses all of
that into a conversation. You say what you want; it plans the whole thing and shows you
the price math.

## The problem

Trip planning is high-effort, high-anxiety, and badly served by filters:

- **Filter fatigue.** Existing tools make _you_ do the optimization — toggle dates, sort
  by price, cross-reference reviews, mentally sum it all against a budget.
- **Fragmentation.** Flights, stays, and activities live in different products that don't
  know about each other or about your budget.
- **Opaque tradeoffs.** "This hotel is €40 more" — but is it worth it for being 10 minutes
  from the beach? Nobody shows you the tradeoff; you reconstruct it by hand.
- **Budget blindness.** You find out you've overspent at checkout, three tabs deep.

## The target user

**Budget-conscious leisure travelers** — a deliberate blend:

- **The student / value traveler.** Tight, hard budget. Flexible on dates and willing to
  trade luxury for price, but wants the trip to still be _good_. Needs the cheapest
  honest path to a real vacation, with no nasty surprises at checkout.
- **The mainstream leisure traveler.** Couples, friends, families planning a personal
  getaway. Limited patience for research, wants a trip that "just works" and fits a
  number they have in mind. Will trade a little money for convenience and a nicer stay.

What unites them: **they have a budget and a vibe, not a spreadsheet.** Wayfare meets
them with a conversation and does the optimization for them — always showing the money.

Secondary beneficiaries (not the design center): frequent/enthusiast travelers who'll
appreciate the transparency, and anyone planning for a group who wants one shared plan.

## The value proposition

| Instead of… | Wayfare gives you… |
|---|---|
| Dozens of filters and tabs | One sentence and a short chat |
| Mentally summing costs across sites | A live running budget with every price sourced |
| Guessing if an upgrade is "worth it" | Explicit tradeoffs the agent surfaces |
| Re-doing the whole plan to change one thing | Targeted re-planning — change one part, keep the rest |
| A flat list of options | A complete day-by-day itinerary that actually fits together |

The magic isn't "AI picks a hotel." It's **a coherent whole trip, fit to your budget and
taste, that you can adjust by talking to it** — with the price math always on the table.

## What makes it different

1. **Conversational, not configurational.** The product is a dialogue. Clarifying
   questions appear only when something high-leverage is missing.
2. **Whole-trip optimization.** Flights + stay + activities are planned _together_
   against one budget, not shopped separately.
3. **Radical price transparency.** Every number shows where it came from and how fresh it
   is — including, honestly, when it's a mock/estimate during early phases.
4. **Cheap iteration.** Refinement re-plans only the affected slice, so exploring "what
   if we went a week earlier?" is fast and non-destructive.

## Worked example journeys

### Journey 1 — The student stretching €600 (value-first)

**Maya, 21, studying in Berlin.** Reading week is coming up. She types:

> _"cheap sunny week somewhere in Europe in March, I'm flexible on dates, max €600 all in,
> just me"_

Wayfare extracts: 1 traveler, ~7 days, March, sunny, Europe, **hard €600 cap**, origin
unknown, dates flexible. It asks just **two** questions: _"Where are you flying from?"_
and _"Anywhere you've already been and want to skip?"_ Maya answers _"Berlin"_ and
_"not Barcelona, did that last year."_

The agent scours and comes back with **Valencia, Spain, €560 total**: a €78 round-trip on
flexible mid-week dates, 6 nights in a highly-rated hostel private room (€186), and a
day-by-day plan — Turia gardens, the beach, a free walking tour, a cheap paella lunch it
flags as a local favorite, and one ticketed day (the City of Arts & Sciences). The budget
bar shows **€40 of headroom** and a note: _"Shifting your flight one day earlier saves
another €22 — want me to?"_

Maya replies _"yes, and is there anything free to do on the beach day?"_ Wayfare swaps the
flight, drops in a free sunset viewpoint, and updates the total to **€538**. Done.

### Journey 2 — The couple's €2,500 Greek beach trip (the canonical example)

**Sam & Alex.** Sam types the founding sentence:

> _"I want a relaxed 8-day beach trip in Greece in late August for two people, around
> €2,500 total"_

Extracted: 2 travelers, 8 days, late August, Greece, beach, relaxed pace, **~€2,500
soft budget**. Missing: origin, dates' exactness, must-haves. Wayfare asks **three**
cards: origin city, _"fixed dates or a flexible window in late August?"_, and a vibe check
_"more lively (Mykonos) or quieter (Naxos / Milos)?"_

They answer London, flexible last week of August, _"quieter, but one fun night out is
fine."_ The agent assembles an **8-day Naxos plan, €2,410 for two**: London→Santorini
flights, ferry to Naxos, a beachfront studio in Agios Prokopios, beach days paced gently,
a half-day boat trip, a tavern night in Naxos Town, and one "lively night" built in. The
budget panel breaks it down: flights €620, ferries €96, stay €980, activities €414, a
food/buffer line €300.

Alex chats: _"swap the hotel for something nearer the beach, and add a day trip to a
quieter island."_ Wayfare re-plans **only lodging and one day** — finds a closer studio
(+€60), inserts a Koufonisia day trip (+€85 with ferry), and shows the new total **€2,555**
with a gentle flag: _"this nudges you ~€55 over your target — want me to trim the boat trip
or keep it?"_

### Journey 3 — The family city break on a firm number (firm budget, convenience-first)

**The Okonkwo family** — two adults, two kids (9 and 12), flying from Manchester.

> _"4-day city trip somewhere fun for the kids over Easter weekend, budget £1,800, somewhere
> not too far"_

Wayfare reads: 4 travelers (2 kids), 4 days, Easter weekend (fixed), city, kid-friendly,
**firm £1,800**, "not too far" from Manchester. It asks **one** question — a quick
multi-select of kid interests (_theme parks / science & hands-on / animals & outdoors /
just wandering_). They pick science and animals.

It proposes **Amsterdam, £1,740**: family room near Vondelpark, NEMO Science Museum,
Artis Zoo, a canal boat, a day of cycling the park, and a kid-friendly food plan. The
itinerary marks each activity with kid-suitability and walking distances. The budget shows
the family room is the big lever and offers a cheaper aparthotel option one tram stop
further out (−£120) as an explicit tradeoff. The family keeps the central room and books
within their number.

---

These three journeys span the spectrum we're designing for — **hard tiny budget, mid
soft budget, firm family budget** — and all three resolve through the same loop: one
sentence → a couple of smart questions → a costed whole-trip plan → refine by chat. See
[CONVERSATION_FLOW.md](./CONVERSATION_FLOW.md) for the dialogue mechanics and
[AGENT_DESIGN.md](./AGENT_DESIGN.md) for how the agent gets there.
