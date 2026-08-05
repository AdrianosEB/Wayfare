import type {
  Budget,
  BudgetCategory,
  BudgetLine,
  BudgetStatus,
  Freshness,
  ListingKind,
  RefinementScope,
  SavingHint,
  TripRequest,
} from "@wayfare/shared";
import type { ItineraryLeg, Persona, RankedOption, VerifiedOption } from "../types.js";
import type { Tracer } from "../trace.js";

/**
 * MatchAgent — scores the verified market against the person and their money. It ranks each
 * option on the persona's own weights (a cost-led traveler ranks cheap-and-verified to the
 * top) and keeps suspect options from leading. Ranking is exposed on its own (`rankByKind`) so
 * the supervisor can reuse the scores when it composes whole itineraries.
 *
 * "Low end of the market" isn't hardcoded: it falls out of the default price weight plus the
 * trust gate, so the cheapest *trustworthy* option wins, not the cheapest bait.
 */

const KIND_TO_CATEGORY: Record<string, BudgetCategory> = {
  flight: "flights",
  stay: "stay",
  activity: "activities",
  transit: "transit",
};

const KIND_TO_SCOPE: Record<string, RefinementScope> = {
  flight: "flights",
  stay: "lodging",
  activity: "activity_day",
  transit: "lodging",
};

/** per-leg cost multiplier — a stay is per-night, a flight is per-traveler. */
export function legMultiplier(kind: string, nights: number, travelers: number): number {
  if (kind === "stay") return Math.max(1, nights);
  if (kind === "flight") return travelers;
  return 1;
}

export function rankByKind(
  optionsByKind: Record<string, VerifiedOption[]>,
  persona: Persona,
): Record<string, RankedOption[]> {
  const out: Record<string, RankedOption[]> = {};
  for (const [kind, options] of Object.entries(optionsByKind)) {
    if (options.length) out[kind] = rankKind(options, persona);
  }
  return out;
}

/** Lead pick per kind: best non-suspect option, falling back only if forced. */
export function selectLeads(
  ranked: Record<string, RankedOption[]>,
): Record<string, RankedOption> {
  const selection: Record<string, RankedOption> = {};
  for (const [kind, scored] of Object.entries(ranked)) {
    const lead = scored.find((r) => r.option.verdict !== "suspect") ?? scored[0];
    if (lead) selection[kind] = lead;
  }
  return selection;
}

export function rankKind(options: VerifiedOption[], persona: Persona): RankedOption[] {
  const w = persona.weights;
  // flexibility folds into price appetite: a flexible traveler leans harder on cheapness.
  const priceWeight = w.price + w.flexibility * 0.5;

  const prices = options.map((o) => o.best.price.amount);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const dists = options.map((o) => o.distanceToFocusMeters ?? NaN).filter((n) => !Number.isNaN(n));
  const minD = dists.length ? Math.min(...dists) : 0;
  const maxD = dists.length ? Math.max(...dists) : 0;

  const interests = new Set([
    ...persona.preferences.interests,
    ...(persona.preferences.lodgingStyle ?? []),
  ]);

  const scored = options.map((o) => {
    const priceScore = norm(o.best.price.amount, minP, maxP, true);
    const qualityScore = (o.rating ?? 3) / 5;
    const locationScore =
      o.distanceToFocusMeters == null ? 0.5 : norm(o.distanceToFocusMeters, minD, maxD, true);
    const vibeScore = vibeMatch(o.tags, interests);
    const verificationScore =
      o.confidence * (o.verdict === "verified" ? 1 : o.verdict === "unconfirmed" ? 0.6 : 0.2);

    const breakdown = {
      price: priceWeight * priceScore,
      quality: w.quality * qualityScore,
      location: w.location * locationScore,
      vibe: w.vibe * vibeScore,
      verification: 0.2 * verificationScore,
    };
    const trustGate = o.verdict === "suspect" ? 0.5 : 1;
    const score =
      (breakdown.price + breakdown.quality + breakdown.location + breakdown.vibe + breakdown.verification) *
      trustGate;
    return { option: o, score, breakdown };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/** normalize into [0,1]; `invert` makes smaller-is-better (price, distance). */
function norm(v: number, min: number, max: number, invert = false): number {
  if (max === min) return 1;
  const t = (v - min) / (max - min);
  return invert ? 1 - t : t;
}

function vibeMatch(tags: string[], interests: Set<string>): number {
  if (!interests.size) return 0.5;
  const hits = tags.filter((t) => interests.has(t)).length;
  return Math.min(1, hits / Math.min(2, interests.size));
}

/**
 * Build an honest Budget from the chosen itinerary's legs. The total is the sum of the lines —
 * this is the only place per-category amounts are summed — plus a buffer, and direct-vs-
 * aggregator savings are surfaced as tradeoffs.
 */
export function buildBudget(
  legs: ItineraryLeg[],
  request: TripRequest,
  tracer?: Tracer,
): Budget {
  const nights = request.durationDays?.value ?? 5;
  const party = request.partySize?.value;
  const travelers = (party?.adults ?? 1) + (party?.children ?? 0);
  const currency = request.budget?.value?.currency ?? legs[0]?.option.best.price.currency ?? "EUR";

  // group legs by budget category so multiple activities roll into one line.
  const byCategory = new Map<BudgetCategory, { amount: number; refs: string[]; freshness: Freshness }>();
  const savings: SavingHint[] = [];

  for (const leg of legs) {
    const listing = leg.option.best;
    const category = KIND_TO_CATEGORY[leg.kind] ?? "activities";
    const mult = legMultiplier(leg.kind, nights, travelers);
    const amount = Math.round(listing.price.amount * mult);
    const acc = byCategory.get(category) ?? { amount: 0, refs: [], freshness: listing.freshness as Freshness };
    acc.amount += amount;
    acc.refs.push(listing.id);
    byCategory.set(category, acc);

    if (leg.option.directDeal) {
      const d = leg.option.directDeal;
      savings.push({
        description: `Book ${leg.option.entity.name} direct instead of via ${d.aggregatorSource} to save ${d.savings} ${d.currency}${leg.kind === "stay" ? "/night" : ""}`,
        delta: -Math.round(d.savings * mult),
        appliesTo: KIND_TO_SCOPE[leg.kind] ?? "info",
      });
    }
  }

  const lines: BudgetLine[] = [...byCategory.entries()].map(([category, v]) => ({
    category,
    amount: v.amount,
    itemRefs: v.refs,
    freshness: v.freshness,
  }));

  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const buffer = Math.round(subtotal * 0.12);
  lines.push({ category: "buffer", amount: buffer, itemRefs: [], freshness: "estimate" });
  const total = subtotal + buffer;

  const targetConstraint = request.budget?.value;
  const target = targetConstraint
    ? { amount: targetConstraint.amount, type: targetConstraint.type }
    : undefined;

  let status: BudgetStatus = "on_target";
  let overageNote: string | undefined;
  if (target) {
    if (total < target.amount * 0.9) status = "under";
    else if (total > target.amount) {
      status = "over";
      if (target.type === "hard") {
        overageNote = `Over the hard cap by ${total - target.amount} ${currency} — tighten a category or relax the cap.`;
      }
    }
  }

  tracer?.emit("match", "budget", { total, status, lines: lines.length });
  return { currency, target, total, lines, status, overageNote, savings };
}
