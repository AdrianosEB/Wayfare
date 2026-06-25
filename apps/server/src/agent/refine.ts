import type {
  Budget,
  ItemDiff,
  Listing,
  RefinementScope,
  Stay,
  Trip,
  TripRequest,
} from "@wayfare/shared";
import { makeId } from "../ids.js";
import { tierOf } from "../integrations/costIndex.js";
import { moneyFromEur, type MockContext } from "../integrations/listingFactory.js";
import { MockProvider } from "../integrations/mockProvider.js";
import { Toolbox } from "./tools.js";
import { planDeterministic, type PlanDeps, type PlanEmitter } from "./planner.js";

/**
 * Refine-by-chat: classify the utterance into a scope (one structured step), re-plan ONLY the
 * affected slice with the rest of the trip frozen, then diff vs the current version and report a
 * budget delta (AGENT_DESIGN.md "Partial re-planning"; CONVERSATION_FLOW.md §5). This is what
 * makes exploration feel free — fewer tool calls, smaller footprint, byte-identical elsewhere.
 */

export interface RefineResult {
  trip: Trip;
  scope: RefinementScope;
  diff: ItemDiff[];
  budgetDelta: number;
}

const STATUS_BY_SCOPE: Record<RefinementScope, string> = {
  lodging: "Finding a better-matched stay…",
  flights: "Re-checking flights…",
  activity_day: "Adjusting the day plan…",
  dates: "Re-pricing for new dates…",
  budget_global: "Re-optimizing the whole trip toward your budget…",
  destination: "Re-planning for a new destination…",
  info: "Looking that up…",
};

/**
 * Map a free-text refinement utterance to a single scope. Order matters: question-detection
 * runs first (so "why this hotel?" is `info`, not `lodging`), then scopes are checked
 * most-impactful → least (destination/budget/dates trigger a full re-plan; lodging/flights/
 * activity_day touch one slice). Anything unmatched falls through to `info` — change nothing,
 * just answer — which is the safe default against over-eager re-planning.
 */
export function classifyScope(utterance: string): RefinementScope {
  const u = utterance.toLowerCase();
  const isQuestion =
    /^(why|what|whats|what's|how|is|are|does|do|can|could|when|where|which)\b/.test(u.trim()) ||
    (u.includes("?") && !/\b(add|swap|change|make|move|remove|replace|cut|drop|switch|book|find)\b/.test(u));
  if (isQuestion) return "info";
  if (/\b(what about|instead|different (place|destination)|actually.*\b(italy|spain|france|portugal|greece)\b)/.test(u)) return "destination";
  if (/\b(cheaper|save money|spend less|more money|on a budget|too expensive|bring.*cost)\b/.test(u)) return "budget_global";
  if (/\b(week earlier|week later|days? earlier|days? later|make it \d+ days|more days|fewer days|go .* earlier|push.*back)\b/.test(u)) return "dates";
  if (/\b(hotel|stay|room|accommodation|apartment|hostel|nearer the beach|closer to the beach|near the beach|pool|villa)\b/.test(u)) return "lodging";
  if (/\b(flight|fly|layover|airport|gatwick|heathrow|earlier flight|nonstop|non-stop|direct)\b/.test(u)) return "flights";
  if (/\b(day trip|add a day|day \d|less |more |activity|museum|tour|boat|hike|excursion|too packed)\b/.test(u)) return "activity_day";
  return "info";
}

/** Walk a trip and collect every priced Listing (flights, stay, transit, day activities). */
function gatherListings(trip: Trip): Listing[] {
  const out: Listing[] = [];
  for (const f of trip.itinerary.flights) out.push(f.listing);
  for (const s of trip.itinerary.stays) out.push(s.listing);
  for (const d of trip.itinerary.days) for (const it of d.items) if (it.listing) out.push(it.listing);
  return out;
}

function recomputeBudget(trip: Trip): Budget {
  const provider = new MockProvider({ now: trip.itinerary.flights[0]?.listing.fetchedAt ?? "", currency: trip.budget.currency });
  const toolbox = new Toolbox(provider);
  const nights = trip.itinerary.stays[0]?.nights ?? trip.itinerary.days.length;
  return toolbox.computeBudget({
    items: gatherListings(trip),
    currency: trip.budget.currency,
    ...(trip.budget.target ? { target: trip.budget.target } : {}),
    nights,
    partySize: trip.travelers.length,
    tier: tierOf(trip.itinerary.destinationResolved),
  });
}

const priceSummary = (name: string, price: { amount: number; currency: string }) => ({ name, price });

/** Swap the stay for a better-matched one (closer to the beach if asked); lodging slice only. */
async function refineLodging(
  prev: Trip,
  utterance: string,
  ctx: MockContext,
  emit: PlanEmitter,
  diff: ItemDiff[],
): Promise<Trip> {
  const u = utterance.toLowerCase();
  const provider = new MockProvider(ctx);
  const toolbox = new Toolbox(provider);
  const current = prev.itinerary.stays[0]!;
  emit.status("search_stays", STATUS_BY_SCOPE.lodging);
  const stays = await toolbox.searchStays({
    location: prev.itinerary.destinationResolved,
    checkIn: current.checkIn,
    checkOut: current.checkOut,
    guests: prev.travelers.length,
    style: ["near_beach"],
  });
  const wantsCloser = /near|clos|beach/.test(u);
  const alternatives = stays.filter((s) => s.name !== current.name);
  const chosen: Stay | undefined = wantsCloser
    ? [...alternatives].sort((a, b) => (a.distanceToFocus?.meters ?? 9e9) - (b.distanceToFocus?.meters ?? 9e9))[0]
    : [...alternatives].sort((a, b) => a.listing.price.amount - b.listing.price.amount)[0];
  if (!chosen) return prev;

  const next: Trip = structuredClone(prev);
  next.itinerary.stays[0] = chosen;
  diff.push({
    op: "replace",
    path: "itinerary.stays[0]",
    before: priceSummary(current.name, current.listing.price),
    after: priceSummary(chosen.name, chosen.listing.price),
    priceDelta: chosen.listing.price.amount - current.listing.price.amount,
  });
  emit.partial({ itinerary: { stays: [chosen] } });
  return next;
}

/** Insert a day trip into a mid-trip day (used by the compound canonical refinement). */
function addDayTrip(trip: Trip, utterance: string, ctx: MockContext, diff: ItemDiff[]): Trip {
  const next = trip;
  const pax = trip.travelers.length;
  const priceEur = 42.5 * pax; // ≈ €85 for two, incl. ferry
  const listing: Listing = {
    id: makeId("lst", "daytrip", trip.id),
    kind: "transit",
    title: "Day trip to a quieter island (incl. ferry)",
    price: moneyFromEur(priceEur, trip.budget.currency),
    source: { provider: "mock:curated", label: "Estimated price" },
    fetchedAt: ctx.now,
    freshness: "mock",
    confidence: 0.7,
  };
  // Drop the day trip on a mid-trip day (never day 1/arrival), capped at day index 4 so it
  // lands in the heart of the stay even on long trips.
  const dayIdx = Math.min(4, Math.max(1, Math.floor(trip.itinerary.days.length / 2)));
  const day = next.itinerary.days[dayIdx];
  if (!day) return next;
  day.items.unshift({ id: makeId("it", listing.id), kind: "transit", title: listing.title, listing });
  diff.push({
    op: "add",
    path: `itinerary.days[${dayIdx}].items[0]`,
    after: { kind: "transit", title: listing.title, price: listing.price },
    priceDelta: listing.price.amount,
  });
  return next;
}

export async function refine(
  prev: Trip,
  request: TripRequest,
  utterance: string,
  deps: PlanDeps,
  emit: PlanEmitter,
): Promise<RefineResult> {
  const scope = classifyScope(utterance);

  // info: answer in chat, change nothing (the safety valve against over-eager re-planning)
  if (scope === "info") {
    emit.message(answerInfo(prev, utterance));
    return { trip: prev, scope, diff: [], budgetDelta: 0 };
  }

  // full re-plan scopes
  if (scope === "destination" || scope === "dates" || scope === "budget_global") {
    emit.status("resolve", STATUS_BY_SCOPE[scope]);
    const next = await planDeterministic(request, deps, emit);
    const budgetDelta = next.budget.total - prev.budget.total;
    return {
      trip: next,
      scope,
      diff: [{ op: "replace", path: "itinerary", priceDelta: budgetDelta }],
      budgetDelta,
    };
  }

  // targeted slice scopes — freeze the rest of the trip. Bind to the trip's currency.
  const localCtx: MockContext = { now: deps.ctx.now, currency: prev.budget.currency };
  const diff: ItemDiff[] = [];
  let next = prev;
  if (scope === "lodging") {
    next = await refineLodging(prev, utterance, localCtx, emit, diff);
    // the canonical compound utterance also adds a day trip
    if (/\b(add|day trip|excursion)\b/.test(utterance.toLowerCase())) {
      next = addDayTrip(structuredClone(next), utterance, localCtx, diff);
    }
  } else if (scope === "flights") {
    next = await refineFlights(prev, localCtx, emit, diff);
  } else {
    next = addDayTrip(structuredClone(prev), utterance, localCtx, diff);
  }

  // re-cost (compute_budget is still the only summer) + over-budget trims.
  // If a slice refiner couldn't make a change it returns `prev` unmodified; clone before we
  // mutate budget/id/summary so we never write through to the stored previous version.
  emit.status("compute_budget", "Re-costing…");
  const rebuilt: Trip = next === prev ? structuredClone(prev) : next;
  const newBudget = recomputeBudget(rebuilt);
  newBudget.savings = prev.budget.savings;
  if (newBudget.status === "over" && newBudget.overageNote) {
    const trim = gatherListings(rebuilt)
      .filter((l) => l.kind === "activity" && l.price.amount > 0)
      .sort((a, b) => b.price.amount - a.price.amount)[0];
    if (trim) {
      newBudget.overageNote += ` Trim "${trim.title}" (−${newBudget.currency} ${trim.price.amount}) to come back under, or keep it.`;
      newBudget.savings = [{ description: `Trim ${trim.title}`, delta: -trim.price.amount, appliesTo: "activity_day" }];
    }
  }
  rebuilt.budget = newBudget;
  rebuilt.id = makeId("trip", prev.id, "refined", utterance);
  rebuilt.summary = `${rebuilt.itinerary.days.length} days on ${rebuilt.itinerary.destinationResolved.split(",")[0]} — ${newBudget.currency} ${newBudget.total}`;
  emit.partial({ budget: { total: newBudget.total, status: newBudget.status } });

  return { trip: rebuilt, scope, diff, budgetDelta: newBudget.total - prev.budget.total };
}

async function refineFlights(prev: Trip, ctx: MockContext, emit: PlanEmitter, diff: ItemDiff[]): Promise<Trip> {
  const provider = new MockProvider(ctx);
  const toolbox = new Toolbox(provider);
  const out = prev.itinerary.flights.find((f) => f.direction === "outbound")!;
  emit.status("search_flights", STATUS_BY_SCOPE.flights);
  const flights = await toolbox.searchFlights({
    origin: out.from,
    destination: prev.itinerary.destinationResolved,
    departDate: out.departISO.slice(0, 10),
    returnDate: prev.itinerary.flights.find((f) => f.direction === "return")!.departISO.slice(0, 10),
    dateFlexibility: "window",
    adults: prev.travelers.filter((t) => t.type === "adult").length,
    maxStops: 0,
  });
  const next = structuredClone(prev);
  if (flights.length >= 2) {
    const before = prev.itinerary.flights.map((f) => f.listing.price.amount).reduce((a, b) => a + b, 0);
    next.itinerary.flights = [flights[0]!, flights[1]!];
    const after = flights[0]!.listing.price.amount + flights[1]!.listing.price.amount;
    diff.push({ op: "replace", path: "itinerary.flights", priceDelta: after - before });
    emit.partial({ itinerary: { flights: next.itinerary.flights } });
  }
  return next;
}

/** A tiny canned explainer for info-scope questions (no tools, no re-plan). */
function answerInfo(trip: Trip, utterance: string): string {
  const dest = trip.itinerary.destinationResolved.split(",")[0];
  const stay = trip.itinerary.stays[0];
  if (/why/.test(utterance.toLowerCase())) {
    return `${dest} fits what you asked for — ${trip.preferences.interests.join(", ") || "a good all-round trip"} — and the plan lands at ${trip.budget.currency} ${trip.budget.total}. ${stay ? `Your stay (${stay.name}) is ${stay.distanceToFocus ? `${stay.distanceToFocus.meters}m ${stay.distanceToFocus.label}` : "well located"}.` : ""} I won't change anything unless you say so.`;
  }
  return `Happy to help with that. Your current plan is ${trip.itinerary.days.length} days in ${dest} at ${trip.budget.currency} ${trip.budget.total}. Tell me what to change and I'll update only that part.`;
}
