# Integrations

Real pricing is the genuinely hard part of this product, and the part most likely to be
oversold. This doc is deliberately honest about the tradeoffs, defines a clean internal
interface so the MVP runs on mock data and swaps in real providers later, and recommends a
path.

## Principles

1. **The agent never talks to a provider directly.** It calls our internal interface. The
   provider behind it (mock or real) is invisible to the agent and the UI (NFR-7).
2. **Every price is a `Listing`** with a `source` and `freshness` (see
   [DATA_MODEL.md](./DATA_MODEL.md)). Honesty about where a number came from is structural,
   not optional.
3. **Degrade gracefully.** If a real provider is down/rate-limited/over-budget, fall back
   to mock/estimate for that category, label it, and complete the plan (NFR-3).
4. **Provider choice is deferred.** Per the kickoff decision, we don't commit spend now.
   The interface commits; the vendor doesn't.

---

## The internal interface

One small, stable surface. Each method takes a typed query and returns `Listing`-wrapped
results. This is the _entire_ contract between the agent and the world's prices.

```ts
interface PricingProvider {
  readonly name: string;                 // 'mock', 'amadeus', 'composite'…
  searchFlights(q: FlightQuery): Promise<Flight[]>;
  searchStays(q: StayQuery): Promise<Stay[]>;
  searchActivities(q: ActivityQuery): Promise<Activity[]>;
  // computeBudget is deterministic and NOT a provider method — it sums Listings locally.
}

interface FlightQuery {
  origin: string; destination: string;    // city/airport/region
  departDate: string; returnDate: string;
  dateFlexibility: 'fixed' | 'window' | 'very_flexible';
  adults: number; children?: number;
  maxStops?: number; cabin?: 'economy' | 'premium' | 'business';
}
interface StayQuery {
  location: string; checkIn: string; checkOut: string;
  guests: number; style?: string[];       // ['near_beach','quiet','pool']
  maxNightly?: number;
}
interface ActivityQuery {
  location: string; date?: string; interests: string[];
  partySize: number; kidFriendly?: boolean; maxPrice?: number;
}
```

### Composition & fallback

A `CompositeProvider` wraps per-category providers and applies the fallback policy:

```ts
// Each category can be backed independently. Any failure → mock, tagged degraded.
const provider = new CompositeProvider({
  flights:    realFlights   ?? mock,   // try real; on error/ratelimit → mock
  stays:      realStays     ?? mock,
  activities: realActivities?? mock,
  fallback:   mock,
});
```

This is what makes "MVP on mock, swap in real per category later" a config change, not a
rewrite (NFR-7). It also lets v1 ship _one_ real category (e.g. flights) while the rest
stay mock.

---

## Mock provider — the two-tier strategy (how we keep the global promise offline)

The kickoff chose **global scope** + **mock-first**. You cannot hand-curate the planet, so
the mock provider has two tiers:

### Tier 1 — Curated "hero" destinations

A handful (≈5–8) of fully hand-authored destinations with rich, realistic listings: real
airport codes, named neighborhoods, actual-feeling hotels, true activities, sane prices.
These power the best demos (the Greek-islands journey lives here) and act as ground-truth
fixtures for tests. Stored as JSON data packs.

### Tier 2 — Procedural generator (any destination on Earth)

For everything else, a **deterministic, parameterized generator** synthesizes plausible
listings for any place:

- **Flights:** priced from great-circle distance between origin and destination, with
  modifiers for season/demand, weekday vs. weekend, stops, and a flexibility discount.
  Carriers/times drawn from a seeded pool. (A €78 Berlin→Valencia and a €620 London→Greece
  fall out of the same model.)
- **Stays:** nightly rate from a **city cost-of-living / tourism index** (a bundled table
  keyed by country/region tier), times a style multiplier (hostel < guesthouse < apartment
  < hotel) and a location multiplier (central / near-beach costs more). Ratings/amenities
  seeded.
- **Activities:** drawn from **category templates** (beach day, museum, food tour, boat
  trip, free walk, hike, nightlife…) filtered by the destination's tags and the user's
  interests, with template-based pricing (many "free" options for budget users).
- **Determinism (NFR-6):** every number is seeded by `hash(destination, dates, party,
  slot)`, so the same request always yields the same plan — repeatable demos and tests.

Every Tier-2 listing is tagged `freshness: 'mock'`, `source.provider: 'mock:procedural'`,
`label: 'Estimated price'` — the UI shows it as an estimate, never as bookable fact
(US-5.1). Tier-1 uses `mock:curated`.

> This is the crux of squaring "global" with "mock-first": curated where it shines,
> procedural everywhere else, honestly labeled throughout.

---

## Real provider evaluation (honest tradeoffs)

When we move to real data (v1+), here's the landscape. **None of these is a clean win** —
each trades cost, coverage, latency, and ToS risk.

### Flights

| Option | Cost | Rate limits | ToS / risk | Notes |
|---|---|---|---|---|
| **Amadeus Self-Service** | Free test tier; pay-per-call in prod | Generous test; metered prod | Clean, official API | **Best starting point.** Flight Offers Search is purpose-built. Test env returns cached/representative data — good for v1 dev. |
| **Kiwi.com (Tequila)** | Affiliate; free API w/ approval | Per-partner | Affiliate ToS; booking via Kiwi | Great coverage incl. budget carriers + virtual interlining; affiliate model aligns with eventual booking hand-off. |
| **Travelpayouts / Aviasales** | Free, affiliate | Reasonable | Affiliate; data is aggregated | Cheap to start; data freshness/precision weaker than Amadeus. |
| **Skyscanner API** | Partner-gated | Partner | Hard to get access | Good data, high barrier to entry. |
| **Scraping Google Flights / OTAs** | "Free" | N/A | **ToS-violating, brittle, blockable** | ❌ Not recommended. Legal + reliability risk; do not build on it. |

**Recommendation:** start with **Amadeus Self-Service** for flight search (clean API, free
test tier to build against), keep **Kiwi/Tequila** in view for breadth + affiliate
booking later.

### Stays

| Option | Cost | Rate limits | ToS / risk | Notes |
|---|---|---|---|---|
| **Amadeus Hotel Search** | Free test; metered prod | Metered | Official | Convenient — same vendor/SDK as flights. Coverage decent, not Booking-deep. |
| **Booking.com Affiliate (Demand API)** | Affiliate; access-gated | Per-partner | Requires approval; strict ToS | Deepest inventory; aligns with booking hand-off. Approval friction. |
| **Hotelbeds / RateHawk (bedbanks)** | Contract | Contract | B2B contracts | Strong rates; heavier onboarding, not MVP-friendly. |
| **Airbnb API** | Effectively closed | N/A | No open partner API | ❌ Not realistically available. |
| **Scraping Booking/Hotels** | "Free" | N/A | **ToS-violating, brittle** | ❌ Not recommended. |

**Recommendation:** **Amadeus Hotel Search** to start (one vendor for flights+stays
lowers integration cost), migrate/augment to **Booking affiliate** when pursuing booking
hand-off and deeper inventory.

### Activities

| Option | Cost | Rate limits | ToS / risk | Notes |
|---|---|---|---|---|
| **Google Places API** | Pay-per-call; monthly free credit | Metered | Official; **display/caching ToS constraints** | Best for discovery + metadata (ratings, location, photos). Not a _bookable_ price source — pair with templated/estimated activity pricing. |
| **GetYourGuide / Viator partner APIs** | Affiliate | Partner | Approval-gated | **Bookable** tours/activities with real prices + affiliate revenue. The right source for priced, bookable experiences. |
| **Foursquare Places** | Free tier | Metered | Official | Alternative POI source. |
| **OpenStreetMap / Overpass** | Free | Fair-use | Open data | Great for free/outdoor POIs (beaches, parks, viewpoints) — perfect for budget users. |

**Recommendation:** **Google Places (or OSM for free POIs)** for _discovery_, **Viator/
GetYourGuide affiliate** for _bookable, priced_ activities. Many budget-user activities are
free POIs (OSM), which keeps cost down and serves the student persona well.

### Recommended phased path

1. **MVP:** mock only (Tier-1 curated + Tier-2 procedural). Zero spend, global, deterministic.
2. **v1, first real category:** **Amadeus flights** behind `searchFlights`; stays +
   activities stay mock. Proves the swap end-to-end on one category, lowest risk.
3. **v1+:** add **Amadeus hotels**, then **activity discovery (Places/OSM)**.
4. **Later (booking hand-off):** **Kiwi/Booking/Viator affiliate** links so shown prices
   become bookable and revenue-aligned.

This sequence de-risks by adding one real source at a time, each behind the same interface,
each able to fall back to mock if it misbehaves.

---

## Caching, cost & rate-limit handling

- **Cache** provider responses keyed by normalized query for a short TTL (e.g. flights
  ~15 min, stays ~1 h) to cut cost and latency; `freshness: 'cached'` reflects it.
- **Budget guard on the provider layer:** a per-session and per-day call ceiling; on
  exhaustion → mock fallback, not a bigger bill (ties to NFR-5).
- **Never expose keys:** all provider calls originate server-side; the client only ever
  sees `Listing`s with a human `source.label`, never raw payloads or keys (NFR-4).
- **Respect display ToS:** some providers (Google Places) restrict caching/displaying
  certain fields — the adapter is responsible for honoring per-provider rules; the rest of
  the system stays agnostic.

---

## What we will not do

- No scraping of sites whose ToS forbids it (Google Flights, Booking, Airbnb). It's legally
  risky, brittle, and dishonest about freshness. Mock + official/affiliate APIs only.
- No presenting an estimate as a bookable, guaranteed price. Estimates are always labeled.
- No client-side provider calls. Ever.
