import type {
  FieldSource,
  Tracked,
  TripRequest,
  BudgetConstraint,
  PartySize,
  TripDates,
} from "@wayfare/shared";
import type { TravelerProfile } from "../types.js";
import type { Tracer } from "../trace.js";

/**
 * IntakeAgent — turns "one sentence + a traveler profile" into a structured, provenance-
 * tracked TripRequest. The parsing here is deliberately transparent heuristics so the package
 * runs with zero external calls; an LLM parser implements the same signature and drops in
 * without touching any downstream agent.
 *
 * Every field it emits is `Tracked` — value + where it came from (prompt / profile default) +
 * confidence — so the conversation layer can ask only for what's genuinely missing and the
 * critic can tell an assumption from a stated fact.
 */

function track<T>(value: T, source: FieldSource, confidence: number): Tracked<T> {
  return { value, source, confidence };
}

const CURRENCY_BY_SYMBOL: Record<string, string> = { "€": "EUR", $: "USD", "£": "GBP" };

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const VIBE_KEYWORDS: Record<string, string[]> = {
  beach: ["beach", "coast", "island", "seaside"],
  food: ["food", "foodie", "culinary", "eat", "restaurant"],
  nightlife: ["party", "nightlife", "clubs", "bars"],
  culture: ["culture", "museum", "history", "historic", "art"],
  relaxed: ["relax", "chill", "quiet", "unwind", "slow"],
  adventure: ["adventure", "hiking", "hike", "outdoors", "surf", "dive"],
  romantic: ["romantic", "honeymoon", "anniversary"],
  budget: ["cheap", "budget", "affordable", "shoestring"],
  luxury: ["luxury", "luxe", "5-star", "high-end"],
};

export interface IntakeResult {
  request: TripRequest;
  /** the locality the search agents should query ("Naxos, Greece"). */
  destination: string;
}

export function intake(
  prompt: string,
  profile: TravelerProfile,
  tracer: Tracer,
): IntakeResult {
  const text = prompt.toLowerCase();

  const destination = parseDestination(prompt);
  const durationDays = parseDuration(text);
  const dates = parseDates(text);
  const budget = parseBudget(text) ?? profile.budget;
  const partySize = parseParty(text) ?? profile.partySize;
  const vibe = parseVibe(text);

  const request: TripRequest = {
    destination: destination
      ? track(destination, "prompt", 0.8)
      : null,
    origin: profile.homeCity ? track(profile.homeCity, "inferred", 0.9) : null,
    durationDays: durationDays ? track(durationDays, "prompt", 0.85) : null,
    dates: dates ? track(dates, "prompt", 0.6) : null,
    partySize: partySize ? track(partySize, partySize === profile.partySize ? "inferred" : "prompt", 0.8) : null,
    budget: budget ? track(budget, budget === profile.budget ? "inferred" : "prompt", 0.75) : null,
    vibe: vibe.length ? track(vibe, "prompt", 0.7) : null,
    pace: null,
    mustHaves: profile.mustHaves.length ? track(profile.mustHaves, "inferred", 0.9) : null,
    avoid: profile.avoid.length ? track(profile.avoid, "inferred", 0.9) : null,
  };

  tracer.emit("intake", "parsed", {
    destination,
    durationDays,
    hasBudget: Boolean(budget),
    vibe,
  });

  return { request, destination: destination ?? "your destination" };
}

function parseDestination(prompt: string): string | undefined {
  // "to Naxos", "in Lisbon", "visit Tokyo" — capture 1–2 capitalized words.
  const m = prompt.match(/\b(?:to|in|visit|trip to|going to)\s+([A-Z][\w-]+(?:\s+[A-Z][\w-]+)?)/);
  if (m?.[1]) return m[1].trim();
  // fallback: first capitalized token that isn't the sentence's first word.
  const caps = prompt.match(/(?<!^)\b[A-Z][a-z]{2,}\b/g);
  return caps?.[0];
}

function parseDuration(text: string): number | undefined {
  const m = text.match(/(\d+)\s*(?:day|night)/);
  if (m?.[1]) return Number(m[1]);
  if (/\bweekend\b/.test(text)) return 3;
  if (/\ba week\b|\bone week\b/.test(text)) return 7;
  return undefined;
}

function parseDates(text: string): TripDates | undefined {
  for (let i = 0; i < MONTHS.length; i++) {
    if (text.includes(MONTHS[i]!)) {
      return { month: i + 1, flexibility: "window" };
    }
  }
  const season = ["spring", "summer", "autumn", "fall", "winter"].find((s) => text.includes(s));
  if (season) return { season, flexibility: "very_flexible" };
  return undefined;
}

function parseBudget(text: string): BudgetConstraint | undefined {
  const m = text.match(/(?:under|around|about|~|budget of|<|up to)\s*([€$£]?)\s*(\d[\d,]*)/)
    ?? text.match(/([€$£])\s*(\d[\d,]*)/);
  if (!m) return undefined;
  const symbol = m[1] ?? "";
  const amount = Number((m[2] ?? "").replace(/,/g, ""));
  if (!amount) return undefined;
  const hard = /\bunder\b|\bmax\b|\bno more than\b|\bhard\b/.test(text);
  return {
    amount,
    currency: CURRENCY_BY_SYMBOL[symbol] ?? "EUR",
    type: hard ? "hard" : "soft",
  };
}

function parseParty(text: string): PartySize | undefined {
  const famN = text.match(/family of (\d+)/);
  if (famN?.[1]) {
    const total = Number(famN[1]);
    const adults = Math.min(2, total);
    return { adults, children: Math.max(0, total - adults) };
  }
  if (/\bfamily\b|\bkids\b|\bchildren\b/.test(text)) return { adults: 2, children: 2 };
  if (/\bsolo\b|\balone\b|\bby myself\b/.test(text)) return { adults: 1 };
  if (/\bcouple\b|\bpartner\b|\bhoneymoon\b|\bwe\b|\bus two\b/.test(text)) return { adults: 2 };
  const grp = text.match(/(\d+)\s*(?:people|friends|of us)/);
  if (grp?.[1]) return { adults: Number(grp[1]) };
  return undefined;
}

function parseVibe(text: string): string[] {
  const out: string[] = [];
  for (const [vibe, keys] of Object.entries(VIBE_KEYWORDS)) {
    if (keys.some((k) => text.includes(k))) out.push(vibe);
  }
  return out;
}
