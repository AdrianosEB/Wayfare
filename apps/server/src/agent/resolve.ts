import type { Assumption, Pace, TripRequest } from "@wayfare/shared";
import { Rng } from "../rng.js";
import { resolvePlace, distanceKm } from "../integrations/geo.js";
import { tierOf } from "../integrations/costIndex.js";
import { resolveDates, type ResolvedDates } from "../dates.js";
import { findCuratedPack } from "../integrations/curated/index.js";

/**
 * Turn a (possibly vague) TripRequest into a concrete plan context: a resolved destination,
 * concrete dates, party, currency, cost tier, interests, and the assumptions taken along the
 * way (US-5.2). This is step 1 (RESOLVE) of the plan loop — curated picks win over procedural.
 */

export interface PlanContext {
  destinationResolved: string;
  destinationReason: string;
  isCurated: boolean;
  origin: string;
  dates: ResolvedDates;
  partySize: { adults: number; children: number; childAges: number[] };
  pax: number;
  currency: string;
  budget?: { amount: number; type: "hard" | "soft" };
  tier: number;
  interests: string[];
  lodgingStyle: string[];
  pace: Pace;
  flexibility: "fixed" | "window" | "very_flexible";
  vibe: string[];
  assumptions: Assumption[];
}

interface Candidate {
  name: string;
  tags: string[];
}

/** A small shortlist for resolving vague destinations ("somewhere sunny in Europe"). */
const CANDIDATES: Candidate[] = [
  { name: "Valencia, Spain", tags: ["sunny", "beach", "city", "food", "cheap", "relaxed"] },
  { name: "Lisbon, Portugal", tags: ["sunny", "beach", "city", "culture", "food", "nightlife"] },
  { name: "Malaga, Spain", tags: ["sunny", "beach", "relaxed", "cheap"] },
  { name: "Barcelona, Spain", tags: ["beach", "city", "nightlife", "culture", "food"] },
  { name: "Amsterdam, Netherlands", tags: ["city", "kids", "culture", "science", "animals", "bike"] },
  { name: "Vienna, Austria", tags: ["city", "culture", "kids", "history"] },
  { name: "Prague, Czechia", tags: ["city", "culture", "cheap", "nightlife", "history"] },
  { name: "Rome, Italy", tags: ["city", "culture", "history", "food"] },
  { name: "Copenhagen, Denmark", tags: ["city", "kids", "design", "bike"] },
  { name: "Berlin, Germany", tags: ["city", "nightlife", "culture", "history", "cheap"] },
];

const VIBE_TO_INTERESTS: Record<string, string[]> = {
  relaxed: ["relaxed", "beach"],
  beach: ["beach", "nature"],
  party: ["nightlife"],
  lively: ["nightlife"],
  culture: ["culture", "history"],
  nature: ["nature", "adventure"],
  romantic: ["romantic", "food"],
  family: ["kids", "family"],
  city: ["city", "culture"],
};

function inferCurrency(request: TripRequest, origin: string): string {
  if (request.budget?.value.currency) return request.budget.value.currency;
  const o = origin.toLowerCase();
  if (/london|manchester|uk|england|britain|gatwick|heathrow/.test(o)) return "GBP";
  if (/new york|usa|chicago|boston|los angeles|miami/.test(o)) return "USD";
  return "EUR";
}

function deriveInterests(request: TripRequest): string[] {
  const set = new Set<string>();
  for (const v of request.vibe?.value ?? []) {
    for (const t of VIBE_TO_INTERESTS[v.toLowerCase()] ?? [v.toLowerCase()]) set.add(t);
  }
  for (const m of request.mustHaves?.value ?? []) set.add(m.toLowerCase());
  return [...set];
}

function deriveLodgingStyle(request: TripRequest): string[] {
  const style = new Set<string>();
  const blob = `${(request.vibe?.value ?? []).join(" ")} ${(request.mustHaves?.value ?? []).join(" ")}`.toLowerCase();
  if (/beach|sea|coast/.test(blob)) style.add("near_beach");
  if (/quiet|relax/.test(blob)) style.add("quiet");
  if (/central|center|centre|town|city/.test(blob)) style.add("central");
  if (/pool/.test(blob)) style.add("pool");
  if ((request.budget?.value?.amount ?? Infinity) / Math.max(1, request.durationDays?.value ?? 7) < 80) style.add("budget");
  return [...style];
}

function isVague(destination: string | undefined): boolean {
  if (!destination) return true;
  return /somewhere|anywhere|europe|sunny|beach|warm|abroad|surprise/i.test(destination) && !findCuratedPack(destination);
}

function resolveVague(request: TripRequest): { name: string; reason: string } {
  const wantTags = new Set([...deriveInterests(request), ...(request.vibe?.value ?? []).map((v) => v.toLowerCase())]);
  const hardLowBudget =
    request.budget?.value?.type === "hard" &&
    (request.budget.value.amount ?? Infinity) / Math.max(1, request.durationDays?.value ?? 7) < 120;
  const notTooFar = /not too far|near|close|short flight/i.test(
    `${request.destination?.value ?? ""} ${(request.avoid?.value ?? []).join(" ")} ${(request.mustHaves?.value ?? []).join(" ")}`,
  );
  const origin = resolvePlace(request.origin?.value ?? "London");
  const avoid = (request.avoid?.value ?? []).map((a) => a.toLowerCase());

  const rng = new Rng("resolve", request.destination?.value ?? "", request.origin?.value ?? "");
  const scored = CANDIDATES.filter((c) => !avoid.some((a) => c.name.toLowerCase().includes(a)))
    .map((c) => {
      let score = c.tags.filter((t) => wantTags.has(t)).length * 3;
      if (hardLowBudget && c.tags.includes("cheap")) score += 4;
      if (notTooFar) {
        const d = distanceKm(origin, resolvePlace(c.name));
        score += Math.max(0, 4 - d / 600); // closer is better
      }
      score += rng.float() * 0.5; // deterministic tie-break
      return { c, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0]!.c;
  const matchedTags = best.tags.filter((t) => wantTags.has(t));
  const reason = matchedTags.length
    ? `matches what you asked for (${matchedTags.slice(0, 3).join(", ")})${hardLowBudget ? " and fits a tight budget" : ""}.`
    : `a strong all-round fit for your trip.`;
  return { name: best.name, reason };
}

export function buildPlanContext(request: TripRequest, year: number): PlanContext {
  const assumptions: Assumption[] = [];

  // origin
  let origin = request.origin?.value;
  if (!origin) {
    origin = "London";
    assumptions.push({ field: "origin", assumed: origin, reason: "you skipped origin; starting from a major hub near you." });
  }

  // destination
  const rawDest = request.destination?.value;
  const curated = rawDest ? findCuratedPack(rawDest) : undefined;
  let destinationResolved: string;
  let destinationReason: string;
  let isCurated = false;
  if (curated) {
    const r = curated.resolve(request);
    destinationResolved = r.destinationResolved;
    destinationReason = r.reason;
    isCurated = true;
  } else if (isVague(rawDest)) {
    const r = resolveVague(request);
    destinationResolved = r.name;
    destinationReason = r.reason;
    assumptions.push({ field: "destination", assumed: r.name, reason: `you were open on destination — picked ${r.name} because it ${r.reason}` });
  } else {
    destinationResolved = rawDest!;
    destinationReason = "the destination you named.";
  }

  // party
  const ps = request.partySize?.value ?? { adults: 1 };
  const partySize = {
    adults: ps.adults,
    children: ps.children ?? 0,
    childAges: ps.childAges ?? [],
  };
  if (!request.partySize) {
    assumptions.push({ field: "partySize", assumed: "1 adult", reason: "you didn't say who's coming; assumed solo." });
  }
  const pax = partySize.adults + partySize.children;

  // dates
  const duration = request.durationDays?.value ?? 7;
  const d = request.dates?.value;
  const dates = resolveDates({
    exact: d?.exact,
    month: d?.month,
    part: d?.part,
    durationDays: duration,
    year,
  });
  const flexibility = d?.flexibility ?? "window";
  if (!d?.exact) {
    assumptions.push({
      field: "dates",
      assumed: `${dates.start} – ${dates.end}${flexibility !== "fixed" ? " (flexible window)" : ""}`,
      reason: d ? "you gave a rough window; picked concrete dates within it." : "you didn't give dates; picked a sensible window.",
    });
  }

  const currency = inferCurrency(request, origin);
  const tier = tierOf(destinationResolved);
  const pace: Pace = request.pace?.value ?? "moderate";

  return {
    destinationResolved,
    destinationReason,
    isCurated,
    origin,
    dates,
    partySize,
    pax,
    currency,
    ...(request.budget ? { budget: { amount: request.budget.value.amount, type: request.budget.value.type } } : {}),
    tier,
    interests: deriveInterests(request),
    lodgingStyle: deriveLodgingStyle(request),
    pace,
    flexibility,
    vibe: request.vibe?.value ?? [],
    assumptions,
  };
}
