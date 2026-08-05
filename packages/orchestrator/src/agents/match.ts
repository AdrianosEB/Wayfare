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
import type { Persona, RankedOption, VerifiedOption } from "../types.js";
import type { Tracer } from "../trace.js";

/**
 * MatchAgent — matches the verified market to the person and their money. It scores each
 * option on the persona's own weights (a cost-led traveler ranks cheap-and-verified to the
 * top), keeps suspect options from leading, and rolls the leading picks into an honest
 * Budget whose total is the sum of what was actually chosen.
 *
 * "Low end of the market" isn't hardcoded: it falls out of the default price weight plus the
 * trust gate, so the cheapest *trustworthy* option wins, not the cheapest bait.
 */

const KIND_TO_CATEGORY: Record<ListingKind, BudgetCategory> = {
  flight: "flights",
  stay: "stay",
  activity: "activities",
  transit: "transit",
};

const KIND_TO_SCOPE: Record<ListingKind, RefinementScope> = {
  flight: "flights",
  stay: "lodging",
  activity: "activity_day",
  transit: "lodging",
};

export interface MatchResult {
  ranked: Record<string, RankedOption[]>;
  selection: Record<string, RankedOption>;
  budget: Budget;
}

export function match(
  optionsByKind: Record<string, VerifiedOption[]>,
  persona: Persona,
  request: TripRequest,
  tracer: Tracer,
): MatchResult {
  const ranked: Record<string, RankedOption[]> = {};
  const selection: Record<string, RankedOption> = {};

  for (const [kind, options] of Object.entries(optionsByKind)) {
    if (!options.length) continue;
    const scored = rankKind(options, persona);
    ranked[kind] = scored;
    // lead with the best non-suspect option; fall back to the best available only if forced.
    const lead = scored.find((r) => r.option.verdict !== "suspect") ?? scored[0];
    if (lead) selection[kind] = lead;
  }

  const budget = buildBudget(selection, request, tracer);
  tracer.emit("match", "ranked", {
    kinds: Object.keys(ranked),
    selected: Object.fromEntries(
      Object.entries(selection).map(([k, r]) => [k, r.option.entity.name]),
    ),
    total: budget.total,
    status: budget.status,
  });
  return { ranked, selection, budget };
}

function rankKind(options: VerifiedOption[], persona: Persona): RankedOption[] {
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

function buildBudget(
  selection: Record<string, RankedOption>,
  request: TripRequest,
  _tracer: Tracer,
): Budget {
  const nights = request.durationDays?.value ?? 5;
  const party = request.partySize?.value;
  const travelers = (party?.adults ?? 1) + (party?.children ?? 0);
  const currency = request.budget?.value?.currency ?? firstCurrency(selection) ?? "EUR";

  const lines: BudgetLine[] = [];
  const savings: SavingHint[] = [];

  for (const [kind, r] of Object.entries(selection)) {
    const listing = r.option.best;
    const category = KIND_TO_CATEGORY[kind as ListingKind];
    const multiplier = kind === "stay" ? Math.max(1, nights) : kind === "flight" ? travelers : 1;
    lines.push({
      category,
      amount: Math.round(listing.price.amount * multiplier),
      itemRefs: [listing.id],
      freshness: listing.freshness as Freshness,
    });
    if (r.option.directDeal) {
      const d = r.option.directDeal;
      savings.push({
        description: `Book ${r.option.entity.name} direct instead of via ${d.aggregatorSource} to save ${d.savings} ${d.currency}${kind === "stay" ? "/night" : ""}`,
        delta: -Math.round(d.savings * multiplier),
        appliesTo: KIND_TO_SCOPE[kind as ListingKind],
      });
    }
  }

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

  return { currency, target, total, lines, status, overageNote, savings };
}

function firstCurrency(selection: Record<string, RankedOption>): string | undefined {
  return Object.values(selection)[0]?.option.best.price.currency;
}
