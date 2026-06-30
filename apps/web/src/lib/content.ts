/**
 * Marketing copy deck + presets — docs/design/CONTENT_VOICE.md and LANDING_PAGE.md.
 * Single source for landing copy, trip-type presets, example prompts, FAQ, testimonials.
 * Voice: a friendly, money-aware travel sidekick — warm, plain, always honest about price.
 */

export const MARKETING = {
  hero: {
    headline: 'Your trip. Planned in minutes.',
    subhead: "Tell us the trip you want — we'll plan it, price it, and keep it honest.",
    promptPlaceholder:
      'Describe your dream trip… e.g. "relaxed 8 days in Greece for two, ~€2,500"',
    cta: 'Plan my trip',
  },
  allInOne: 'Flights, stays, activities, and a running budget — all in one chat.',
  partnersCaption: 'Prices and booking via trusted partners.',
  footerSignoff: 'Made with 💙 by Wayfare.',
} as const;

/** Example prompts spanning the personas (shuffle on the hero; show all on the app empty state). */
export const EXAMPLE_PROMPTS: { tag: string; label: string; prompt: string }[] = [
  {
    tag: 'Solo · tight budget',
    label: 'Cheap sunny week in Europe in March, max €600, just me',
    prompt: 'Cheap sunny week in Europe in March, flexible dates, max €600, just me',
  },
  {
    tag: 'Couple · beach',
    label: 'Relaxed 8-day beach trip in Greece for two, ~€2,500',
    prompt:
      'Relaxed 8-day beach trip in Greece in late August for two, around €2,500',
  },
  {
    tag: 'Family · city break',
    label: '4-day city break that’s fun for kids over Easter, ~£1,800',
    prompt:
      '4-day city break that’s fun for kids over Easter, around £1,800, from Manchester',
  },
];

export interface TripType {
  type: string;
  label: string;
  prompt: string;
  /** image key for lib/images.ts */
  imageKey: string;
}

/** Trip-type presets — `/plan/:type` seeds a tailored prompt. */
export const TRIP_TYPES: TripType[] = [
  { type: 'couple', label: 'Couples & honeymoons', imageKey: 'couple', prompt: 'Romantic week away for two, somewhere warm, mid-range budget' },
  { type: 'family', label: 'Family vacations', imageKey: 'family', prompt: 'Family trip the kids will love, 5–7 days, easygoing pace' },
  { type: 'solo', label: 'Solo travel', imageKey: 'solo', prompt: 'Solo adventure, meet people, safe and budget-friendly, ~10 days' },
  { type: 'weekend', label: 'Weekend getaways', imageKey: 'weekend', prompt: 'Quick weekend break somewhere new, 2–3 days, not too far' },
  { type: 'roadtrip', label: 'Road trips', imageKey: 'roadtrip', prompt: 'Scenic road trip with great stops, about a week' },
  { type: 'group', label: 'Group trips', imageKey: 'group', prompt: 'Trip for a group of friends, fun nightlife, split-friendly budget' },
  { type: 'luxury', label: 'Luxury escapes', imageKey: 'luxury', prompt: 'A special splurge trip, beautiful hotels, ~1 week' },
  { type: 'bleisure', label: 'Work + leisure', imageKey: 'bleisure', prompt: 'Add a few leisure days onto a work trip in Lisbon' },
];

export function tripTypeByKey(type: string | undefined): TripType | undefined {
  return TRIP_TYPES.find((t) => t.type === type);
}

/** Sample destination cards — "Where to go next". Prices render as honest "from" estimates. */
export interface SampleTrip {
  place: string;
  imageKey: string;
  lengthDays: number;
  fromAmount: number;
  currency: string;
  vibe: string;
  prompt: string;
}

export const SAMPLE_TRIPS: SampleTrip[] = [
  {
    place: 'Naxos, Greece',
    imageKey: 'greece',
    lengthDays: 8,
    fromAmount: 2410,
    currency: 'EUR',
    vibe: 'Relaxed beach',
    prompt: 'Relaxed 8-day beach trip on Naxos for two in late August, around €2,500',
  },
  {
    place: 'Lisbon, Portugal',
    imageKey: 'lisbon',
    lengthDays: 4,
    fromAmount: 720,
    currency: 'EUR',
    vibe: 'City break',
    prompt: 'A 4-day city break in Lisbon with great food and viewpoints, around €800',
  },
  {
    place: 'Kyoto, Japan',
    imageKey: 'kyoto',
    lengthDays: 7,
    fromAmount: 2980,
    currency: 'EUR',
    vibe: 'Culture',
    prompt: 'A week in Kyoto for two, temples and food, mid-range budget',
  },
  {
    place: 'Amalfi Coast, Italy',
    imageKey: 'amalfi',
    lengthDays: 6,
    fromAmount: 1840,
    currency: 'EUR',
    vibe: 'Coastal',
    prompt: 'A 6-day coastal trip on the Amalfi Coast for two, scenic and romantic',
  },
];

/**
 * Budget showcase for the `/pricing` page — the cheapest trips we'd point someone to.
 * `fromAmount` is an illustrative "from" figure (marketing copy for a few nights, solo or
 * two-person framing), not a sourced Listing price. Tapping a card seeds the planner.
 */
export const BUDGET_TRIPS: SampleTrip[] = [
  {
    place: 'Sofia, Bulgaria',
    imageKey: 'sofia',
    lengthDays: 3,
    fromAmount: 160,
    currency: 'EUR',
    vibe: 'Solo · 3 nights',
    prompt: 'A cheap 3-night solo city break in Sofia, Bulgaria, around €160 all-in',
  },
  {
    place: 'Kraków, Poland',
    imageKey: 'krakow',
    lengthDays: 3,
    fromAmount: 170,
    currency: 'EUR',
    vibe: 'Solo · 3 nights',
    prompt: 'A budget 3-night solo trip to Kraków, Poland, old town and food, around €170',
  },
  {
    place: 'Valencia, Spain',
    imageKey: 'valencia',
    lengthDays: 3,
    fromAmount: 190,
    currency: 'EUR',
    vibe: 'Solo · 3 nights',
    prompt: 'A cheap sunny 3-night solo break in Valencia, Spain, beach and tapas, around €190',
  },
  {
    place: 'Budapest, Hungary',
    imageKey: 'budapest',
    lengthDays: 4,
    fromAmount: 200,
    currency: 'EUR',
    vibe: 'For two · 4 nights',
    prompt: 'A budget 4-night trip to Budapest for two, thermal baths and ruin bars, around €200pp',
  },
  {
    place: 'Prague, Czechia',
    imageKey: 'prague',
    lengthDays: 4,
    fromAmount: 210,
    currency: 'EUR',
    vibe: 'For two · 4 nights',
    prompt: 'A cheap 4-night city break in Prague for two, around €210pp',
  },
  {
    place: 'Lisbon, Portugal',
    imageKey: 'lisbon',
    lengthDays: 3,
    fromAmount: 220,
    currency: 'EUR',
    vibe: 'Solo · 3 nights',
    prompt: 'A budget 3-night solo trip to Lisbon, viewpoints and pastéis, around €220',
  },
  {
    place: 'Porto, Portugal',
    imageKey: 'porto',
    lengthDays: 3,
    fromAmount: 230,
    currency: 'EUR',
    vibe: 'For two · 3 nights',
    prompt: 'A cheap 3-night trip to Porto for two, river views and port tasting, around €230pp',
  },
  {
    place: 'Naples, Italy',
    imageKey: 'naples',
    lengthDays: 3,
    fromAmount: 240,
    currency: 'EUR',
    vibe: 'For two · 3 nights',
    prompt: 'A budget 3-night trip to Naples for two, pizza and the bay, around €240pp',
  },
  {
    place: 'Athens, Greece',
    imageKey: 'athens',
    lengthDays: 4,
    fromAmount: 260,
    currency: 'EUR',
    vibe: 'For two · 4 nights',
    prompt: 'A cheap 4-night trip to Athens for two, ruins and rooftop tavernas, around €260pp',
  },
];

/**
 * Recently-planned showcase — curated example trips used as inspiration / social proof on the
 * landing. For now this is hand-authored marketing content; it's shaped to become real saved
 * per-user trip history when trip-saving lands (swap the array for the user's trips, keep the
 * card). `summary` is the one-line recap, `vibe` a short mood line, `prompt` seeds the planner.
 */
export interface PastTrip {
  place: string;
  imageKey: string;
  summary: string;
  vibe: string;
  prompt: string;
}

export const PAST_TRIPS: PastTrip[] = [
  {
    place: 'Naxos, Greece',
    imageKey: 'naxos',
    summary: '8 days on Naxos — €2,410 for two',
    vibe: 'Slow beach mornings, taverna nights.',
    prompt: 'Relaxed 8-day beach trip on Naxos for two in late August, around €2,500',
  },
  {
    place: 'Lisbon, Portugal',
    imageKey: 'lisbon',
    summary: '4 days in Lisbon — €720 for two',
    vibe: 'Pastéis, viewpoints, and tram 28.',
    prompt: 'A 4-day city break in Lisbon with great food and viewpoints, around €800',
  },
  {
    place: 'Kyoto, Japan',
    imageKey: 'kyoto',
    summary: '7 days in Kyoto — €2,980 for two',
    vibe: 'Temples at dawn, ramen at midnight.',
    prompt: 'A week in Kyoto for two, temples and food, mid-range budget',
  },
  {
    place: 'Amalfi Coast, Italy',
    imageKey: 'amalfi',
    summary: '6 days on the Amalfi Coast — €1,840 for two',
    vibe: 'Cliffside drives and lemon spritz.',
    prompt: 'A 6-day coastal trip on the Amalfi Coast for two, scenic and romantic',
  },
  {
    place: 'Valencia, Spain',
    imageKey: 'valencia',
    summary: 'A solo week in Valencia — €610',
    vibe: 'Beach, tapas, and zero stress.',
    prompt: 'A relaxed solo week in Valencia, beach and tapas, around €600',
  },
  {
    place: 'Kraków, Poland',
    imageKey: 'krakow',
    summary: '3 nights in Kraków — €170 solo',
    vibe: 'Old town wanders on a tiny budget.',
    prompt: 'A budget 3-night solo trip to Kraków, Poland, old town and food, around €170',
  },
];

/* ------------------------------------------------------------------ *
 * Explore / Trending hub  (`/explore`)
 *
 * A richer, filterable gallery that absorbs the budget showcase and the "what others have
 * done" social-proof angle into one browsable destination. Curated marketing content for now,
 * shaped to graduate into real saved-trip data when trip-saving lands (Phase 2): swap the
 * array, keep the cards + filters.
 *
 * Provenance rule (see SourceChip / price-provenance-rule): `source` + `freshness` are honest
 * display strings — today every figure is a clearly-labelled "Estimated" starting point. Never
 * hardcode the word "mock"; the card renders these strings verbatim, so the same chip flips to
 * "Amadeus · 2h ago" later with zero card changes. `total` is the whole-trip illustrative cost
 * for the stated party (not per-person) and equals the sum of the `budget` split.
 * ------------------------------------------------------------------ */

export type TripRegion = 'Europe' | 'Asia' | 'Americas';
export type TripParty = 'Solo' | 'Couple' | 'Family' | 'Group';
export type TripVibe =
  | 'Beach'
  | 'City'
  | 'Culture'
  | 'Coastal'
  | 'Foodie'
  | 'Nightlife'
  | 'Adventure';
/** How a trip is trending — drives the TrendingBadge tone. */
export type TripTrend = 'Hot' | 'Rising' | 'Steady';
/** Budget tiers used by the Explore filter (derived from `total` via `budgetBand`). */
export type BudgetBand = 'Budget' | 'Mid-range' | 'Splurge';

/** The four cost buckets of a trip — render the BudgetSplitBar; sum to `ExploreTrip.total`. */
export interface BudgetSplit {
  flights: number;
  stay: number;
  activities: number;
  food: number;
}

export interface ExploreTrip {
  /** Stable slug — React key and future `/trip/:id` handle. */
  id: string;
  place: string;
  imageKey: string;
  region: TripRegion;
  party: TripParty;
  partySize: number;
  /** One or more vibes — used for both filtering and the card's chips. */
  vibes: TripVibe[];
  lengthDays: number;
  /** Whole-trip illustrative total for the party (== sum of `budget`). */
  total: number;
  currency: string;
  budget: BudgetSplit;
  /** When it's best to go, e.g. "May–Sep". */
  bestSeason: string;
  /** Price provenance — honest label, never "mock". Renders as `${source} · ${freshness}`. */
  source: string;
  freshness: string;
  /** Social proof — how many travellers planned something like this in the last week. */
  plannedThisWeek: number;
  trending: TripTrend;
  /** One-line "what others did" recap. */
  blurb: string;
  /** Seeds the planner when the card is tapped. */
  prompt: string;
}

/** Order the filter renders bands in. */
export const BUDGET_BANDS: BudgetBand[] = ['Budget', 'Mid-range', 'Splurge'];
export const TRIP_REGIONS: TripRegion[] = ['Europe', 'Asia', 'Americas'];
export const TRIP_PARTIES: TripParty[] = ['Solo', 'Couple', 'Family', 'Group'];
export const TRIP_VIBES: TripVibe[] = [
  'Beach',
  'City',
  'Culture',
  'Coastal',
  'Foodie',
  'Nightlife',
  'Adventure',
];

/** Derive the budget band from a whole-trip total (keeps the band off the data — no drift). */
export function budgetBand(total: number): BudgetBand {
  if (total <= 800) return 'Budget';
  if (total <= 2000) return 'Mid-range';
  return 'Splurge';
}

export const EXPLORE_TRIPS: ExploreTrip[] = [
  {
    id: 'krakow-solo-3',
    place: 'Kraków, Poland',
    imageKey: 'krakow',
    region: 'Europe',
    party: 'Solo',
    partySize: 1,
    vibes: ['City', 'Culture'],
    lengthDays: 3,
    total: 170,
    currency: 'EUR',
    budget: { flights: 60, stay: 60, activities: 25, food: 25 },
    bestSeason: 'Apr–Oct',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 64,
    trending: 'Hot',
    blurb: 'Old-town wanders, milk-bar lunches, and a Wieliczka mine day — all on a tiny budget.',
    prompt: 'A budget 3-night solo trip to Kraków, Poland, old town and food, around €170',
  },
  {
    id: 'sofia-solo-3',
    place: 'Sofia, Bulgaria',
    imageKey: 'sofia',
    region: 'Europe',
    party: 'Solo',
    partySize: 1,
    vibes: ['City', 'Adventure'],
    lengthDays: 3,
    total: 160,
    currency: 'EUR',
    budget: { flights: 70, stay: 45, activities: 20, food: 25 },
    bestSeason: 'May–Oct',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 18,
    trending: 'Rising',
    blurb: 'Cheapest capital on the board — free walking tours and a Vitosha mountain escape.',
    prompt: 'A cheap 3-night solo city break in Sofia, Bulgaria, around €160 all-in',
  },
  {
    id: 'valencia-solo-7',
    place: 'Valencia, Spain',
    imageKey: 'valencia',
    region: 'Europe',
    party: 'Solo',
    partySize: 1,
    vibes: ['Beach', 'Foodie', 'City'],
    lengthDays: 7,
    total: 610,
    currency: 'EUR',
    budget: { flights: 120, stay: 280, activities: 90, food: 120 },
    bestSeason: 'Apr–Oct',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 29,
    trending: 'Rising',
    blurb: 'A slow solo week: city beach mornings, paella, and zero-stress bike lanes.',
    prompt: 'A relaxed solo week in Valencia, beach and tapas, around €600',
  },
  {
    id: 'prague-couple-4',
    place: 'Prague, Czechia',
    imageKey: 'prague',
    region: 'Europe',
    party: 'Couple',
    partySize: 2,
    vibes: ['City', 'Culture'],
    lengthDays: 4,
    total: 420,
    currency: 'EUR',
    budget: { flights: 140, stay: 160, activities: 60, food: 60 },
    bestSeason: 'Apr–Oct',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 25,
    trending: 'Steady',
    blurb: 'Castle-district mornings and riverside beers — a cheap, romantic long weekend.',
    prompt: 'A cheap 4-night city break in Prague for two, around €210pp',
  },
  {
    id: 'porto-couple-3',
    place: 'Porto, Portugal',
    imageKey: 'porto',
    region: 'Europe',
    party: 'Couple',
    partySize: 2,
    vibes: ['City', 'Foodie', 'Coastal'],
    lengthDays: 3,
    total: 460,
    currency: 'EUR',
    budget: { flights: 160, stay: 160, activities: 60, food: 80 },
    bestSeason: 'May–Oct',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 33,
    trending: 'Rising',
    blurb: 'River views, a port-cellar crawl, and seafood by the Douro for two.',
    prompt: 'A cheap 3-night trip to Porto for two, river views and port tasting, around €230pp',
  },
  {
    id: 'lisbon-couple-4',
    place: 'Lisbon, Portugal',
    imageKey: 'lisbon',
    region: 'Europe',
    party: 'Couple',
    partySize: 2,
    vibes: ['City', 'Foodie'],
    lengthDays: 4,
    total: 720,
    currency: 'EUR',
    budget: { flights: 240, stay: 300, activities: 80, food: 100 },
    bestSeason: 'Mar–Oct',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 51,
    trending: 'Hot',
    blurb: 'Pastéis, viewpoints, and tram 28 — the all-time favourite city break for two.',
    prompt: 'A 4-day city break in Lisbon with great food and viewpoints, around €800',
  },
  {
    id: 'budapest-group-4',
    place: 'Budapest, Hungary',
    imageKey: 'budapest',
    region: 'Europe',
    party: 'Group',
    partySize: 4,
    vibes: ['City', 'Nightlife'],
    lengthDays: 4,
    total: 800,
    currency: 'EUR',
    budget: { flights: 320, stay: 240, activities: 120, food: 120 },
    bestSeason: 'Apr–Oct',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 47,
    trending: 'Hot',
    blurb: 'Four friends, thermal baths by day and ruin bars by night — split-friendly throughout.',
    prompt: 'A budget 4-night trip to Budapest for four, thermal baths and ruin bars, split-friendly',
  },
  {
    id: 'athens-group-4',
    place: 'Athens, Greece',
    imageKey: 'athens',
    region: 'Europe',
    party: 'Group',
    partySize: 4,
    vibes: ['City', 'Culture'],
    lengthDays: 4,
    total: 1040,
    currency: 'EUR',
    budget: { flights: 480, stay: 320, activities: 120, food: 120 },
    bestSeason: 'Mar–Jun · Sep–Oct',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 21,
    trending: 'Steady',
    blurb: 'Acropolis at opening, rooftop tavernas at dusk — ancient history for the group.',
    prompt: 'A 4-night trip to Athens for four, ruins and rooftop tavernas',
  },
  {
    id: 'paris-couple-4',
    place: 'Paris, France',
    imageKey: 'paris',
    region: 'Europe',
    party: 'Couple',
    partySize: 2,
    vibes: ['City', 'Culture', 'Foodie'],
    lengthDays: 4,
    total: 1180,
    currency: 'EUR',
    budget: { flights: 360, stay: 520, activities: 160, food: 140 },
    bestSeason: 'Apr–Jun · Sep–Oct',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 36,
    trending: 'Rising',
    blurb: 'A long weekend for two: a Marais flat, a Louvre morning, and wine-bar nights.',
    prompt: 'A 4-day romantic city break in Paris for two, art and great food, mid-range',
  },
  {
    id: 'barcelona-group-4',
    place: 'Barcelona, Spain',
    imageKey: 'barcelona',
    region: 'Europe',
    party: 'Group',
    partySize: 4,
    vibes: ['City', 'Beach', 'Nightlife'],
    lengthDays: 4,
    total: 1320,
    currency: 'EUR',
    budget: { flights: 520, stay: 480, activities: 160, food: 160 },
    bestSeason: 'May–Sep',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 41,
    trending: 'Hot',
    blurb: 'Gaudí by day, Barceloneta sundowners, and a tapas crawl for four.',
    prompt: 'A 4-night trip to Barcelona for a group of four, beach, Gaudí and nightlife',
  },
  {
    id: 'mexico-city-solo-6',
    place: 'Mexico City, Mexico',
    imageKey: 'city',
    region: 'Americas',
    party: 'Solo',
    partySize: 1,
    vibes: ['City', 'Foodie', 'Culture'],
    lengthDays: 6,
    total: 1150,
    currency: 'EUR',
    budget: { flights: 620, stay: 220, activities: 160, food: 150 },
    bestSeason: 'Oct–Apr',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 14,
    trending: 'Rising',
    blurb: 'Solo and food-first: Roma Norte cafés, Teotihuacán day trip, taquería dinners.',
    prompt: 'A 6-day solo trip to Mexico City, food, museums and a Teotihuacán day trip',
  },
  {
    id: 'amalfi-couple-6',
    place: 'Amalfi Coast, Italy',
    imageKey: 'amalfi',
    region: 'Europe',
    party: 'Couple',
    partySize: 2,
    vibes: ['Coastal', 'Beach'],
    lengthDays: 6,
    total: 1840,
    currency: 'EUR',
    budget: { flights: 480, stay: 760, activities: 300, food: 300 },
    bestSeason: 'May–Sep',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 17,
    trending: 'Steady',
    blurb: 'Cliffside drives, a Capri boat day, and lemon spritz at golden hour for two.',
    prompt: 'A 6-day coastal trip on the Amalfi Coast for two, scenic and romantic',
  },
  {
    id: 'santorini-couple-5',
    place: 'Santorini, Greece',
    imageKey: 'santorini',
    region: 'Europe',
    party: 'Couple',
    partySize: 2,
    vibes: ['Coastal', 'Beach'],
    lengthDays: 5,
    total: 2200,
    currency: 'EUR',
    budget: { flights: 520, stay: 1080, activities: 300, food: 300 },
    bestSeason: 'May–Sep',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 19,
    trending: 'Steady',
    blurb: 'A caldera-view cave suite, a catamaran sunset sail, and slow Oia evenings.',
    prompt: 'A 5-day romantic Santorini trip for two, caldera views and a sunset sail',
  },
  {
    id: 'naxos-couple-8',
    place: 'Naxos, Greece',
    imageKey: 'naxos',
    region: 'Europe',
    party: 'Couple',
    partySize: 2,
    vibes: ['Beach', 'Coastal'],
    lengthDays: 8,
    total: 2410,
    currency: 'EUR',
    budget: { flights: 520, stay: 980, activities: 410, food: 500 },
    bestSeason: 'May–Sep',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 38,
    trending: 'Hot',
    blurb: 'Slow beach mornings and taverna nights — the relaxed 8-day Greece favourite.',
    prompt: 'Relaxed 8-day beach trip on Naxos for two in late August, around €2,500',
  },
  {
    id: 'kyoto-couple-7',
    place: 'Kyoto, Japan',
    imageKey: 'kyoto',
    region: 'Asia',
    party: 'Couple',
    partySize: 2,
    vibes: ['Culture', 'Foodie'],
    lengthDays: 7,
    total: 2980,
    currency: 'EUR',
    budget: { flights: 1400, stay: 760, activities: 320, food: 500 },
    bestSeason: 'Mar–Apr · Oct–Nov',
    source: 'Estimated',
    freshness: 'Updated this week',
    plannedThisWeek: 22,
    trending: 'Rising',
    blurb: 'Temples at dawn, a kaiseki splurge, and a Nishiki market crawl for two.',
    prompt: 'A week in Kyoto for two, temples and food, mid-range budget',
  },
];

export interface ValueCardItem {
  key: string;
  title: string;
  body: string;
}

export const VALUE_CARDS: ValueCardItem[] = [
  { key: 'tailor', title: 'Tailor-made', body: 'A plan shaped to your dates, budget, and vibe — not a template.' },
  { key: 'cheaper', title: 'Cheaper', body: 'We optimize the whole trip against your budget, and show the math.' },
  { key: 'gems', title: 'Hidden gems', body: 'Beyond the tourist list — local picks and free finds.' },
  { key: 'honest', title: 'No surprises', body: 'Every price sourced and dated. The total is always honest.' },
];

export const PARTNERS = ['Skyscanner', 'Booking.com', 'Viator', 'GetYourGuide'];
export const PRESS = ['The Verge', 'Condé Nast', 'WIRED', 'TechCrunch', 'Lonely Planet'];

export interface Testimonial {
  quote: string;
  author: string;
  tripTaken: string;
  rating: number;
  /** image key for lib/images.ts — the destination they travelled to. */
  imageKey: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'It planned our whole Greece trip in one chat — flights, a beachfront studio, and a budget that actually added up.',
    author: 'Mara & Tom',
    tripTaken: '8 days on Naxos',
    rating: 5,
    imageKey: 'naxos',
  },
  {
    quote: 'I told it “max €600, sunny, just me” and it found a week I could afford. The price labels made me trust it.',
    author: 'Devin O.',
    tripTaken: 'Solo week in Valencia',
    rating: 5,
    imageKey: 'valencia',
  },
  {
    quote: 'Travelling with two kids is usually a spreadsheet nightmare. This felt like texting a friend who happens to be great at logistics.',
    author: 'The Okonkwo family',
    tripTaken: 'Long weekend in Lisbon',
    rating: 5,
    imageKey: 'lisbon',
  },
];

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: FaqItem[] = [
  {
    q: 'How accurate are the prices?',
    a: 'Every price shows where it came from and when. Today most are clearly labelled estimates so you can plan; as we connect live providers, the same chip flips to “Live” with the source and age. We never claim an estimate is a bookable, guaranteed price.',
  },
  {
    q: 'Can I book through Wayfare?',
    a: 'Booking hand-off to trusted partners is coming. Today we plan and price the whole trip — flights, stays and a day-by-day plan — so it’s ready to book.',
  },
  {
    q: 'Is it free?',
    a: 'Yes — planning is free. Tell us about your trip and we’ll put the whole thing together.',
  },
  {
    q: 'How does it know my budget?',
    a: 'You tell it. We optimize the entire trip against that number and show the math, so you can see exactly where it goes and what to trim.',
  },
  {
    q: 'Can I change the plan?',
    a: 'Anytime — just chat. Say “make it cheaper”, “swap the hotel”, or “add a day trip” and we re-plan only what’s affected, then show you what changed.',
  },
  {
    q: 'Which destinations can I plan?',
    a: 'Anywhere. Some places have richer data than others, and we’re honest about it when a price is an estimate.',
  },
  {
    q: 'Do I need an account?',
    a: 'Not to plan. Start typing and go.',
  },
  {
    q: 'What about flights from my city?',
    a: 'Give us an origin and we tailor the flight prices and times to where you’re actually leaving from.',
  },
];
