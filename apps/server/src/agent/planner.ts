import type {
  AgentStep,
  Assumption,
  Listing,
  Preferences,
  SavingHint,
  Traveler,
  Trip,
  TripRequest,
} from "@wayfare/shared";
import { makeId } from "../ids.js";
import type { MockContext } from "../integrations/listingFactory.js";
import { MockProvider } from "../integrations/mockProvider.js";
import { Toolbox } from "./tools.js";
import { buildPlanContext, type PlanContext } from "./resolve.js";
import {
  assembleDays,
  pickFlights,
  pickStay,
  selectActivities,
} from "./assemble.js";

/**
 * The deterministic plan engine: RESOLVE → SCOUR (tools) → RANK → ASSEMBLE → COST → EXPLAIN,
 * streaming progress at each step (NFR-2). It drives the exact same four tools as the Anthropic
 * loop and emits the same SSE protocol, so the two are interchangeable. Pure + seeded ⇒ the
 * same request always yields the same trip (NFR-6).
 */

export interface PlanEmitter {
  status(step: AgentStep, message: string): void;
  partial(patch: Record<string, unknown>): void;
  assumption(a: Assumption): void;
  message(text: string): void;
}

export interface PlanDeps {
  ctx: MockContext;
  year: number;
  /** categories that fell back to mock (→ status: 'degraded'). */
  degradedCategories?: string[];
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
function paxWord(adults: number, children: number): string {
  const pax = adults + children;
  if (pax === 1) return "you";
  if (children > 0) return `a family of ${pax}`;
  return NUMBER_WORDS[pax] ?? String(pax);
}

function buildTravelers(adults: number, children: number, childAges: number[]): Traveler[] {
  const travelers: Traveler[] = [];
  for (let i = 0; i < adults; i++) travelers.push({ id: makeId("trav", "a", i), type: "adult" });
  for (let i = 0; i < children; i++) {
    const t: Traveler = { id: makeId("trav", "c", i), type: "child" };
    if (childAges[i] != null) t.age = childAges[i]!;
    travelers.push(t);
  }
  return travelers;
}

function buildPreferences(pc: PlanContext, maxStops?: number): Preferences {
  const prefs: Preferences = { pace: pc.pace, interests: pc.interests };
  if (pc.lodgingStyle.length) prefs.lodgingStyle = pc.lodgingStyle;
  if (maxStops != null) prefs.flightPrefs = { maxStops };
  return prefs;
}

function buildSavings(opts: {
  flightsLine?: number;
  flexibility: string;
  cheaperStayDelta?: number;
}): SavingHint[] {
  const hints: SavingHint[] = [];
  if (opts.flexibility !== "fixed" && opts.flightsLine) {
    hints.push({
      description: "Shift your outbound a day earlier",
      delta: -Math.round(opts.flightsLine * 0.08),
      appliesTo: "flights",
    });
  }
  if (opts.cheaperStayDelta && opts.cheaperStayDelta < 0) {
    hints.push({
      description: "Pick the studio one row back from the beach",
      delta: Math.round(opts.cheaperStayDelta),
      appliesTo: "lodging",
    });
  }
  if (hints.length === 0) {
    hints.push({ description: "Travel mid-week for cheaper flights", delta: -25, appliesTo: "flights" });
  }
  return hints;
}

const maxStopsFromAvoid = (request: TripRequest): number | undefined => {
  const avoid = (request.avoid?.value ?? []).join(" ").toLowerCase();
  if (/non-?stop|no layover|direct/.test(avoid)) return 0;
  if (/1 layover|one layover|>1 (stop|layover)|max 1/.test(avoid)) return 1;
  return undefined;
};

export async function planDeterministic(
  request: TripRequest,
  deps: PlanDeps,
  emit: PlanEmitter,
): Promise<Trip> {
  const { ctx, year } = deps;
  const pc = buildPlanContext(request, year);
  // bind the provider to the resolved trip currency so every listing is in one currency.
  const provider = new MockProvider({ now: ctx.now, currency: pc.currency });
  const toolbox = new Toolbox(provider);
  const destShort = pc.destinationResolved.split(",")[0]!.trim();
  const maxStops = maxStopsFromAvoid(request);

  // 1. RESOLVE
  emit.status("resolve", `Picking the right spot for a ${[...pc.vibe].join(", ") || "great"} trip…`);
  emit.partial({ itinerary: { destinationResolved: pc.destinationResolved, startDate: pc.dates.start, endDate: pc.dates.end } });

  // 2. SCOUR — flights
  emit.status("search_flights", `Searching flights ${pc.origin}→${destShort}…`);
  const flights = await toolbox.searchFlights({
    origin: pc.origin,
    destination: pc.destinationResolved,
    departDate: pc.dates.start,
    returnDate: pc.dates.end,
    dateFlexibility: pc.flexibility,
    adults: pc.partySize.adults,
    ...(pc.partySize.children ? { children: pc.partySize.children } : {}),
    ...(maxStops != null ? { maxStops } : {}),
  });
  const pair = pickFlights(flights, maxStops);
  if (!pair) throw new Error("no_flights");
  emit.partial({ itinerary: { flights: pair } });

  // SCOUR — stays
  emit.status("search_stays", `Comparing stays in ${destShort}…`);
  const nightlyCap = pc.budget ? (pc.budget.amount * 0.45) / pc.dates.nights : undefined;
  const stays = await toolbox.searchStays({
    location: pc.destinationResolved,
    checkIn: pc.dates.start,
    checkOut: pc.dates.end,
    guests: pc.pax,
    ...(pc.lodgingStyle.length ? { style: pc.lodgingStyle } : {}),
    ...(nightlyCap ? { maxNightly: nightlyCap } : {}),
  });
  const stay = pickStay(stays, pc.lodgingStyle);
  if (!stay) throw new Error("no_stay");
  const cheaperStayDelta = stays.length > 1 && stays[0] !== stay ? stays[0]!.listing.price.amount - stay.listing.price.amount : undefined;
  emit.partial({ itinerary: { stays: [stay] } });

  // SCOUR — activities
  emit.status("search_activities", `Finding things to do in ${destShort}…`);
  const activities = await toolbox.searchActivities({
    location: pc.destinationResolved,
    interests: pc.interests,
    partySize: pc.pax,
    ...(pc.partySize.children ? { kidFriendly: true } : {}),
  });

  // 3. RANK / 4. ASSEMBLE
  const fixedSoFar =
    pair[0].listing.price.amount + pair[1].listing.price.amount + stay.listing.price.amount;
  const headroom = pc.budget ? pc.budget.amount * 0.92 - fixedSoFar : Number.POSITIVE_INFINITY;
  const { paid, free } = selectActivities(activities, {
    pace: pc.pace,
    nights: pc.dates.nights,
    headroom,
    hardCap: pc.budget?.type === "hard",
  });
  const transit = provider.transit(pc.destinationResolved, pc.pax);
  const { days, placedActivityListings, transitListings } = assembleDays({
    startDate: pc.dates.start,
    nights: pc.dates.nights,
    destinationShort: destShort,
    paid,
    free,
    transit,
    pace: pc.pace,
  });

  // assumptions (US-5.2)
  for (const a of pc.assumptions) emit.assumption(a);

  // 5. COST — compute_budget is the only summer
  emit.status("compute_budget", "Costing it out…");
  const items: Listing[] = [
    pair[0].listing,
    pair[1].listing,
    stay.listing,
    ...transitListings,
    ...placedActivityListings,
  ];
  const budget = toolbox.computeBudget({
    items,
    currency: pc.currency,
    ...(pc.budget ? { target: pc.budget } : {}),
    nights: pc.dates.nights,
    partySize: pc.pax,
    tier: pc.tier,
  });

  // 7. EXPLAIN — savings + over-budget trims
  budget.savings = buildSavings({
    flightsLine: budget.lines.find((l) => l.category === "flights")?.amount,
    flexibility: pc.flexibility,
    ...(cheaperStayDelta ? { cheaperStayDelta: -cheaperStayDelta } : {}),
  });
  if (budget.status === "over" && budget.overageNote) {
    const trim = placedActivityListings
      .filter((l) => l.price.amount > 0)
      .sort((a, b) => b.price.amount - a.price.amount)[0];
    if (trim) {
      budget.overageNote += ` Trim "${trim.title}" (−${budget.currency} ${trim.price.amount}) to come back under, or keep it.`;
      budget.savings.unshift({ description: `Trim ${trim.title}`, delta: -trim.price.amount, appliesTo: "activity_day" });
    }
  }
  emit.partial({ budget: { currency: budget.currency, total: budget.total, status: budget.status } });

  const degraded = (deps.degradedCategories?.length ?? 0) > 0;
  const trip: Trip = {
    id: makeId("trip", pc.destinationResolved, pc.dates.start, pc.pax),
    request,
    travelers: buildTravelers(pc.partySize.adults, pc.partySize.children, pc.partySize.childAges),
    preferences: buildPreferences(pc, maxStops),
    itinerary: {
      destinationResolved: pc.destinationResolved,
      startDate: pc.dates.start,
      endDate: pc.dates.end,
      flights: pair,
      stays: [stay],
      days,
    },
    budget,
    summary: `${pc.dates.nights} days ${pc.isCurated ? "on" : "in"} ${destShort} — ${budget.currency} ${budget.total} for ${paxWord(pc.partySize.adults, pc.partySize.children)}`,
    assumptions: pc.assumptions,
    status: degraded ? "degraded" : "complete",
  };
  return trip;
}
