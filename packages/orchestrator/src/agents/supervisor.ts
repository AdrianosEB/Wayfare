import type { TripRequest } from "@wayfare/shared";
import type {
  DateWindow,
  ItineraryCombination,
  ItineraryLeg,
  Persona,
  RankedOption,
  SupervisorStats,
  VerifiedOption,
} from "../types.js";
import type { Tracer } from "../trace.js";

/**
 * SupervisorAgent — composes whole trips, not parts. It fans out across the cross-product of
 * flight × stay × date-window candidates and runs branch-and-bound: each branch is priced on
 * its flight+stay partial and **pruned against budget before it is expanded** with activities,
 * so the expensive expansion only happens for branches that can still come in on budget. The
 * survivors (a bounded beam) are expanded, scored on the persona's weights, and returned
 * best-first.
 *
 * This is the "supervisor fans out async agents across flight/stay/date combinations and prunes
 * branches against budget before expanding" behavior, implemented as a supervisor pattern in
 * TypeScript (not a third-party graph runtime).
 */

export interface SupervisorOptions {
  /** flight/stay candidates considered per axis (bounds the cross-product). */
  candidatesPerAxis?: number;
  /** survivors kept after pruning + partial ranking. */
  beamWidth?: number;
  /** fraction over the hard/soft target a branch may still cost and survive pruning. */
  budgetSlack?: number;
  /** max activities attached during expansion. */
  maxActivities?: number;
}

/** The single cost formula for a whole itinerary — shared with the reprice check. */
export function computeItineraryTotal(args: {
  flightUnit?: number;
  stayUnit?: number;
  activityUnits: number[];
  nights: number;
  travelers: number;
  priceFactor: number;
}): number {
  const flight = (args.flightUnit ?? 0) * args.travelers;
  const stay = (args.stayUnit ?? 0) * args.nights;
  const travel = (flight + stay) * args.priceFactor;
  const activities = args.activityUnits.reduce((a, b) => a + b, 0);
  return Math.round(travel + activities);
}

export function itineraryLegs(combo: ItineraryCombination): ItineraryLeg[] {
  const legs: ItineraryLeg[] = [];
  if (combo.flight) legs.push({ kind: "flight", option: combo.flight });
  if (combo.stay) legs.push({ kind: "stay", option: combo.stay });
  for (const a of combo.activities) legs.push({ kind: "activity", option: a });
  return legs;
}

export interface ComposeArgs {
  rankedByKind: Record<string, RankedOption[]>;
  persona: Persona;
  request: TripRequest;
  tracer: Tracer;
  options?: SupervisorOptions;
}

export function composeItineraries(
  args: ComposeArgs,
): { itineraries: ItineraryCombination[]; stats: SupervisorStats } {
  const { rankedByKind, request, tracer } = args;
  const candidatesPerAxis = args.options?.candidatesPerAxis ?? 6;
  const beamWidth = args.options?.beamWidth ?? 6;
  const budgetSlack = args.options?.budgetSlack ?? 0.1;
  const maxActivities = args.options?.maxActivities ?? 2;

  const nights = request.durationDays?.value ?? 5;
  const party = request.partySize?.value;
  const travelers = (party?.adults ?? 1) + (party?.children ?? 0);
  const target = request.budget?.value?.amount;
  const budgetCap = target ? target * (1 + budgetSlack) : Number.POSITIVE_INFINITY;

  const windows = deriveWindows(request, nights);
  // exclude suspect legs from composition entirely — never build a trip on a bait price.
  const flights = pickAxis(rankedByKind.flight, candidatesPerAxis);
  const stays = pickAxis(rankedByKind.stay, candidatesPerAxis);
  const activities = (rankedByKind.activity ?? []).filter((r) => r.option.verdict !== "suspect");
  const currency = firstCurrency(rankedByKind) ?? request.budget?.value?.currency ?? "EUR";

  interface Branch {
    window: DateWindow;
    flight?: RankedOption;
    stay?: RankedOption;
    partial: number;
    partialScore: number;
  }

  let expanded = 0;
  let prunedOnBudget = 0;
  const branches: Branch[] = [];

  // If an axis is empty we still branch on the other so partial trips are possible.
  const flightList: (RankedOption | undefined)[] = flights.length ? flights : [undefined];
  const stayList: (RankedOption | undefined)[] = stays.length ? stays : [undefined];

  for (const window of windows) {
    for (const flight of flightList) {
      for (const stay of stayList) {
        if (!flight && !stay) continue;
        expanded++;
        const partial = computeItineraryTotal({
          flightUnit: flight?.option.best.price.amount,
          stayUnit: stay?.option.best.price.amount,
          activityUnits: [],
          nights,
          travelers,
          priceFactor: window.priceFactor,
        });
        // BRANCH-AND-BOUND: prune before expanding with activities.
        if (partial > budgetCap) {
          prunedOnBudget++;
          continue;
        }
        branches.push({
          window,
          ...(flight ? { flight } : {}),
          ...(stay ? { stay } : {}),
          partial,
          partialScore: (flight?.score ?? 0) + (stay?.score ?? 0) - (window.priceFactor - 1),
        });
      }
    }
  }

  // keep the strongest branches (higher score, cheaper partial as tiebreak), then expand.
  branches.sort((a, b) => b.partialScore - a.partialScore || a.partial - b.partial);
  const survivors = branches.slice(0, beamWidth);

  const itineraries: ItineraryCombination[] = survivors.map((br, i) => {
    const remaining = Number.isFinite(budgetCap) ? budgetCap - br.partial : Number.POSITIVE_INFINITY;
    const chosenActivities = greedyActivities(activities, remaining, maxActivities);
    const activityUnits = chosenActivities.map((r) => r.option.best.price.amount);
    const total = computeItineraryTotal({
      flightUnit: br.flight?.option.best.price.amount,
      stayUnit: br.stay?.option.best.price.amount,
      activityUnits,
      nights,
      travelers,
      priceFactor: br.window.priceFactor,
    });
    const withinBudget = target == null ? true : total <= target;
    const activityScore = chosenActivities.reduce((a, r) => a + r.score, 0);
    const overRatio = target ? Math.max(0, total / target - 1) : 0;
    const score = br.partialScore + activityScore + (withinBudget ? 0.25 : 0) - overRatio;

    return {
      id: `itin_${i}`,
      window: br.window,
      ...(br.flight ? { flight: br.flight.option } : {}),
      ...(br.stay ? { stay: br.stay.option } : {}),
      activities: chosenActivities.map((r) => r.option),
      total,
      currency,
      withinBudget,
      score,
    } satisfies ItineraryCombination;
  });

  // affordable first, then by score.
  itineraries.sort((a, b) => Number(b.withinBudget) - Number(a.withinBudget) || b.score - a.score);

  const stats: SupervisorStats = {
    windows: windows.length,
    expanded,
    prunedOnBudget,
    kept: survivors.length,
  };
  tracer.emit("supervisor", "composed", {
    ...stats,
    best: itineraries[0]?.total,
    withinBudget: itineraries[0]?.withinBudget ?? false,
  });
  return { itineraries, stats };
}

function pickAxis(ranked: RankedOption[] | undefined, n: number): RankedOption[] {
  return (ranked ?? []).filter((r) => r.option.verdict !== "suspect").slice(0, n);
}

/** Greedily attach the highest-ranked activities that still fit the remaining budget. */
function greedyActivities(
  ranked: RankedOption[],
  remaining: number,
  max: number,
): RankedOption[] {
  const out: RankedOption[] = [];
  let left = remaining;
  for (const r of ranked) {
    if (out.length >= max) break;
    const cost = r.option.best.price.amount;
    if (cost <= left) {
      out.push(r);
      left -= cost;
    }
  }
  return out;
}

function firstCurrency(ranked: Record<string, RankedOption[]>): string | undefined {
  for (const list of Object.values(ranked)) {
    if (list[0]) return list[0].option.best.price.currency;
  }
  return undefined;
}

/**
 * Candidate travel windows. Fixed dates → one window. Flexible dates → early/mid/late variants
 * whose seasonal price factor makes the date axis a real cost lever the supervisor prunes on.
 */
export function deriveWindows(request: TripRequest, nights: number): DateWindow[] {
  const dates = request.dates?.value;
  if (dates?.exact) {
    return [{ start: dates.exact.start, end: dates.exact.end, label: "your dates", priceFactor: 1 }];
  }
  if (request.dates?.value?.flexibility === "fixed" && dates?.month) {
    const w = window(2026, dates.month, 14, nights, "mid", 1);
    return [w];
  }
  const month = dates?.month ?? 6; // default to June if the month is unknown
  return [
    window(2026, month, 3, nights, "earlier in the month", 0.95),
    window(2026, month, 14, nights, "mid-month", 1),
    window(2026, month, 24, nights, "later in the month", 1.05),
  ];
}

function window(
  year: number,
  month: number,
  day: number,
  nights: number,
  label: string,
  priceFactor: number,
): DateWindow {
  const start = new Date(Date.UTC(year, month - 1, day));
  const end = new Date(start.getTime() + nights * 86400000);
  return { start: iso(start), end: iso(end), label, priceFactor };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
