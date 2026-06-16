import { hashStr } from "../rng.js";

/**
 * A tiny cost-of-living / tourism index. Nightly stay rates, flight per-km rates, and activity
 * prices derive from a destination's tier so a €78 Berlin→Valencia and a €620 London→Greece
 * fall out of the same model. Base numbers are EUR; the provider converts to the trip currency.
 */

/** Tier 1 (cheap) … 5 (expensive). Default 3 for unknown places. */
const TIER_BY_KEYWORD: Record<string, number> = {
  // cheaper
  portugal: 2, porto: 2, lisbon: 3,
  spain: 2, valencia: 2, madrid: 3, barcelona: 3, seville: 2,
  greece: 2, naxos: 2, milos: 2, athens: 2, mykonos: 4, santorini: 4,
  poland: 1, prague: 2, czechia: 2, hungary: 2, budapest: 2,
  thailand: 1, vietnam: 1, indonesia: 1, bali: 2, mexico: 2, turkey: 2,
  // mid
  italy: 3, rome: 3, france: 3, germany: 3, berlin: 3, austria: 3, vienna: 3,
  netherlands: 4, amsterdam: 4,
  // pricier
  london: 4, uk: 4, paris: 4, copenhagen: 4, denmark: 4,
  switzerland: 5, zurich: 5, norway: 5, iceland: 5, tokyo: 5, "new york": 5,
};

const normalize = (s: string) => s.trim().toLowerCase();

export function tierOf(destination: string): number {
  const key = normalize(destination);
  if (TIER_BY_KEYWORD[key] != null) return TIER_BY_KEYWORD[key]!;
  for (const [k, v] of Object.entries(TIER_BY_KEYWORD)) {
    if (key.includes(k)) return v;
  }
  // deterministic 2..4 for unknown places
  return 2 + (hashStr(key) % 3);
}

/** Nightly base rate in EUR for a mid-range stay, by tier. */
export function nightlyBaseEur(tier: number): number {
  return [0, 55, 80, 120, 175, 260][Math.max(1, Math.min(5, tier))]!;
}

/** Per-km flight rate in EUR (per one-way km; round trip is priced as ×2 in the generator). */
export function flightPerKmEur(tier: number): number {
  // budget-carrier economics: a few cents per km, slightly higher for pricier markets.
  return [0, 0.05, 0.055, 0.06, 0.065, 0.07][Math.max(1, Math.min(5, tier))]!;
}

/** Base activity price in EUR for a paid experience, by tier. */
export function activityBaseEur(tier: number): number {
  return [0, 18, 24, 35, 48, 65][Math.max(1, Math.min(5, tier))]!;
}

/** Per-person, per-day food/incidentals allowance in EUR, by tier (feeds the buffer line). */
export function foodPerDayEur(tier: number): number {
  return [0, 14, 19, 26, 34, 46][Math.max(1, Math.min(5, tier))]!;
}

/* ----- currency conversion (deterministic static FX; MVP only) ----- */

const FX_FROM_EUR: Record<string, number> = {
  EUR: 1,
  GBP: 0.86,
  USD: 1.08,
  CHF: 0.95,
  SEK: 11.3,
  NOK: 11.6,
  DKK: 7.46,
};

export function convertFromEur(amountEur: number, currency: string): number {
  const rate = FX_FROM_EUR[currency.toUpperCase()] ?? 1;
  return amountEur * rate;
}
