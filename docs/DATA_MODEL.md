# Data Model

Core entities, their fields, and how they relate. These types live in `packages/shared`
as TypeScript types + Zod schemas, shared verbatim between the agent (which produces them)
and the client (which renders them). Types below are illustrative TS.

## Entity relationship overview

```
Session 1───* TripVersion
                  │
                  └─1 Trip
                       ├─1 TripRequest ──*  (constraints: dates, budget, vibe…)
                       ├─*  Traveler
                       ├─1  Preferences
                       ├─1  Itinerary
                       │        ├─*  Day
                       │        │      └─*  ItineraryItem ──1 Listing  (activity/transit)
                       │        ├─*  Flight        ──1 Listing
                       │        └─*  Stay (1+ per trip, spans nights) ──1 Listing
                       └─1  Budget
                                └─*  BudgetLine ──> references Listing/category
```

Key ideas:

- A **Session** holds the whole conversation and an ordered list of **TripVersion**s
  (every refinement = a new version → enables "what changed" + undo).
- Everything priced — **Flight, Stay, Activity** — wraps a **Listing**, which is the
  uniform "a thing with a price, a source, and a freshness." This is what lets mock and
  real providers be interchangeable and what powers price transparency everywhere.
- **Budget** is derived from the itinerary's listings; it is never free-floating.

---

## Session & versioning

```ts
interface Session {
  id: string;
  createdAt: string;            // ISO
  request: TripRequest;         // evolving constraints (prompt + answers merged)
  versions: TripVersion[];      // ordered; last = current
}

interface TripVersion {
  version: number;              // 1, 2, 3…
  trip: Trip;
  createdAt: string;
  refinement?: {                // absent for v1 (initial plan)
    utterance: string;          // what the user said
    scope: RefinementScope;     // 'lodging' | 'flights' | 'activity_day' | …
    diff: ItemDiff[];           // changed items vs previous version
    budgetDelta: number;        // signed, in trip currency
  };
}
```

---

## TripRequest (constraints)

The structured output of prompt parsing + clarifying answers (see
[CONVERSATION_FLOW.md](./CONVERSATION_FLOW.md)). Every field tracks where it came from.

```ts
type FieldSource = 'prompt' | 'answer' | 'default' | 'inferred';
interface Tracked<T> { value: T; source: FieldSource; confidence: number; }

interface TripRequest {
  destination?: Tracked<string>;            // "Greece", "somewhere sunny", "Naxos"
  origin?:      Tracked<string>;            // city or airport
  durationDays?: Tracked<number>;
  dates?: Tracked<{
    exact?: { start: string; end: string };
    month?: number; part?: 'early'|'mid'|'late'; season?: string;
    flexibility: 'fixed' | 'window' | 'very_flexible';
  }>;
  partySize?: Tracked<{ adults: number; children?: number; childAges?: number[] }>;
  budget?: Tracked<{ amount: number; currency: string; type: 'hard' | 'soft' }>;
  vibe?: Tracked<string[]>;                 // ['relaxed','beach']
  pace?: Tracked<'relaxed' | 'moderate' | 'packed'>;
  mustHaves?: Tracked<string[]>;            // ['near beach','kid-friendly']
  avoid?: Tracked<string[]>;                // ['Barcelona','>1 layover']
}
```

---

## Trip, Traveler, Preferences

```ts
interface Trip {
  id: string;
  request: TripRequest;          // snapshot the plan was built against
  travelers: Traveler[];
  preferences: Preferences;
  itinerary: Itinerary;
  budget: Budget;
  summary: string;               // one-line agent summary ("8 days on Naxos…")
  assumptions: Assumption[];     // defaults the agent took (US-5.2)
  status: 'planning' | 'complete' | 'degraded';  // degraded = some prices are fallbacks
}

interface Traveler {
  id: string;
  type: 'adult' | 'child';
  age?: number;                  // for child pricing / activity suitability
}

interface Preferences {           // distilled, normalized taste used by the ranker
  pace: 'relaxed' | 'moderate' | 'packed';
  interests: string[];           // ['beach','food','history']
  lodgingStyle?: string[];       // ['quiet','central','near_beach','pool']
  flightPrefs?: { maxStops?: number; preferredTimes?: string[] };
  dietary?: string[];
}

interface Assumption { field: string; assumed: string; reason: string; }
```

---

## Itinerary, Day, ItineraryItem

```ts
interface Itinerary {
  destinationResolved: string;   // concrete place the agent settled on ("Naxos, Greece")
  startDate: string; endDate: string;
  flights: Flight[];             // outbound + return (+ intra legs at v1+)
  stays: Stay[];                 // ≥1; each spans a night range
  days: Day[];                   // length = durationDays
}

interface Day {
  index: number;                 // 1-based
  date: string;
  title: string;                 // "Beach day in Agios Prokopios"
  items: ItineraryItem[];        // ordered through the day
  notes?: string;                // "rest day", weather note, etc.
}

interface ItineraryItem {
  id: string;
  kind: 'activity' | 'transit' | 'meal' | 'free';
  startTime?: string; endTime?: string;
  listing?: Listing;             // present when priced (activity/transit); absent for 'free'
  title: string;
  location?: GeoPoint;
  walkingFromPrev?: { minutes: number; meters: number };  // powers "near the beach" logic
  kidSuitable?: boolean;         // for family trips (Journey 3)
}

interface GeoPoint { lat: number; lng: number; name?: string; }
```

---

## Flight, Stay, Activity — all wrap a Listing

```ts
interface Flight {
  id: string;
  listing: Listing;              // price, source, freshness
  direction: 'outbound' | 'return' | 'intra';
  from: string; to: string;      // airport codes / cities
  departISO: string; arriveISO: string;
  stops: number;
  carrier?: string;
  bookingDeepLink?: string;      // v1
}

interface Stay {
  id: string;
  listing: Listing;
  name: string;
  type: 'hotel' | 'hostel' | 'apartment' | 'aparthotel' | 'guesthouse';
  location: GeoPoint;
  checkIn: string; checkOut: string;   // → nights
  nights: number;
  rating?: number;               // 0–5
  amenities?: string[];          // ['pool','beachfront','kitchen']
  distanceToFocus?: { label: string; meters: number };  // "to beach: 120m"
}

interface Activity {             // the priced thing behind an 'activity' ItineraryItem
  id: string;
  listing: Listing;
  category: string;              // 'boat_trip','museum','food_tour','free_walk'…
  durationMin: number;
  bookingRequired: boolean;
}
```

---

## Listing — the uniform priced unit (price transparency lives here)

This is the single most important shared type. **Every price in Wayfare is a Listing.**
It is provider-agnostic: the mock generator and real providers both emit Listings, so the
agent, budget, and UI treat all prices uniformly — including their honesty about source.

```ts
interface Listing {
  id: string;
  kind: 'flight' | 'stay' | 'activity' | 'transit';
  title: string;
  price: Money;
  // --- transparency: required on EVERY listing (US-3.4, US-5.1) ---
  source: PriceSource;
  fetchedAt: string;             // ISO timestamp the price was obtained
  freshness: 'live' | 'cached' | 'estimate' | 'mock';
  confidence: number;            // 0–1, how reliable the number is
  deepLink?: string;             // where to book it (v1)
  raw?: unknown;                 // provider payload, server-side only (never sent raw to client)
}

interface Money { amount: number; currency: string; }

interface PriceSource {
  provider: string;              // 'mock:procedural' | 'mock:curated' | 'amadeus' | 'booking' | 'google_places'
  label: string;                 // human: "Mock estimate" | "Amadeus · 2h ago"
  url?: string;
}
```

`freshness` + `source` are what the UI renders next to every number, and what flips a Trip
to `status: 'degraded'` when a real provider falls back to mock (NFR-3).

---

## Budget — derived, categorized, honest

```ts
interface Budget {
  currency: string;
  target?: { amount: number; type: 'hard' | 'soft' };  // from TripRequest
  total: number;                 // sum of lines
  lines: BudgetLine[];
  status: 'under' | 'on_target' | 'over';
  overageNote?: string;          // present when over a hard cap (US-4.3)
  savings: SavingHint[];         // surfaced tradeoffs (US-3.5)
}

interface BudgetLine {
  category: 'flights' | 'stay' | 'activities' | 'transit' | 'food' | 'buffer';
  amount: number;
  itemRefs: string[];            // Listing/Item ids that roll up here
  freshness: Listing['freshness'];  // worst-case freshness in this line (drives labeling)
}

interface SavingHint {
  description: string;           // "Shift outbound −1 day"
  delta: number;                 // signed; negative = saves money
  appliesTo: RefinementScope;    // how acting on it would re-plan
}
```

---

## Refinement diffing

```ts
type RefinementScope =
  | 'budget_global' | 'lodging' | 'flights' | 'activity_day'
  | 'dates' | 'destination' | 'info';

interface ItemDiff {
  op: 'add' | 'remove' | 'replace';
  path: string;                  // e.g. "itinerary.stays[0]", "days[4].items[2]"
  before?: unknown;
  after?: unknown;
  priceDelta?: number;
}
```

The diff is what the UI uses to highlight exactly what changed after a refinement (US-4.4)
and what a future undo (US-4.5) reverses.

---

## Why this shape

- **Listing as the atom of price** makes provider-swapping and price-transparency a
  property of one type, not scattered logic. Mock vs. real is just a different `source`/
  `freshness`.
- **Budget derives from Listings** → the running total can never silently disagree with the
  itinerary (NFR honesty).
- **Versioned trips + diffs** make "re-planning is cheap" and "show me what changed"
  first-class instead of bolted on.
- **Tracked<T> constraints** let the conversation layer ask only for what's missing and
  show the user every assumption it made.
