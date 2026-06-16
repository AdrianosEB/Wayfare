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
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'It planned our whole Greece trip in one chat — flights, a beachfront studio, and a budget that actually added up.',
    author: 'Mara & Tom',
    tripTaken: '8 days on Naxos',
    rating: 5,
  },
  {
    quote: 'I told it “max €600, sunny, just me” and it found a week I could afford. The price labels made me trust it.',
    author: 'Devin O.',
    tripTaken: 'Solo week in Valencia',
    rating: 5,
  },
  {
    quote: 'Travelling with two kids is usually a spreadsheet nightmare. This felt like texting a friend who happens to be great at logistics.',
    author: 'The Okonkwo family',
    tripTaken: 'Long weekend in Lisbon',
    rating: 5,
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
