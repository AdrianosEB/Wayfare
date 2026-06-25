import type {
  Activity,
  Day,
  Flight,
  ItineraryItem,
  Listing,
  Pace,
  Stay,
} from "@wayfare/shared";
import { makeId } from "../ids.js";
import { addDays } from "../dates.js";
import type { TransitLeg } from "../integrations/curated/index.js";

/**
 * Pure assembly helpers: pick coherent options per slot and lay activities out across the days
 * honoring pace (relaxed → fewer scheduled activities/day) and arrival/departure logistics.
 * No day is left empty unless it's a deliberate rest day (US-3.1).
 */

const PACE_CAP: Record<Pace, number> = { relaxed: 1, moderate: 2, packed: 3 };

/** Group the flat flight list (consecutive [outbound, return] pairs) into round trips. */
export function flightPairs(flights: Flight[]): Array<[Flight, Flight]> {
  const pairs: Array<[Flight, Flight]> = [];
  for (let i = 0; i + 1 < flights.length; i += 2) {
    pairs.push([flights[i]!, flights[i + 1]!]);
  }
  return pairs;
}

/** Pick the cheapest round trip that respects a max-stops constraint (cheapest-first input). */
export function pickFlights(flights: Flight[], maxStops?: number): [Flight, Flight] | undefined {
  const pairs = flightPairs(flights);
  const ok = pairs.filter(([o, r]) => maxStops == null || (o.stops <= maxStops && r.stops <= maxStops));
  return (ok[0] ?? pairs[0]);
}

/** Pick a stay: cheapest that satisfies near-beach/pool style wants (input sorted by price). */
export function pickStay(stays: Stay[], style: string[]): Stay | undefined {
  if (stays.length === 0) return undefined;
  const wantBeach = style.includes("near_beach");
  const wantPool = style.includes("pool");
  const matches = stays.filter(
    (s) =>
      (!wantBeach || s.distanceToFocus?.label.includes("beach") || s.amenities?.includes("beachfront")) &&
      (!wantPool || s.amenities?.includes("pool")),
  );
  return (matches[0] ?? stays[0]);
}

/**
 * Select which activities make the plan: keep paid ones (interest-ordered) up to the pace cap
 * across the trip and within budget headroom; free ones are always available for filling days.
 */
export function selectActivities(
  activities: Activity[],
  opts: { pace: Pace; nights: number; headroom: number; hardCap: boolean },
): { paid: Activity[]; free: Activity[] } {
  const paidAll = activities.filter((a) => a.listing.price.amount > 0);
  const free = activities.filter((a) => a.listing.price.amount === 0);
  const cap = PACE_CAP[opts.pace] * opts.nights;

  const paid: Activity[] = [];
  let spent = 0;
  for (const a of paidAll) {
    if (paid.length >= cap) break;
    const next = spent + a.listing.price.amount;
    if (opts.hardCap && next > opts.headroom) continue;
    paid.push(a);
    spent = next;
  }
  return { paid, free };
}

function activityItem(a: Activity, prevWalk?: boolean): ItineraryItem {
  const item: ItineraryItem = {
    id: makeId("it", a.id),
    kind: "activity",
    title: a.listing.title,
    listing: a.listing,
  };
  if (a.bookingRequired) {
    item.startTime = "10:00";
    item.endTime = `${String(10 + Math.round(a.durationMin / 60)).padStart(2, "0")}:00`;
  }
  if (prevWalk) item.walkingFromPrev = { minutes: 8, meters: 600 };
  return item;
}

function transitItem(leg: TransitLeg): ItineraryItem {
  const item: ItineraryItem = {
    id: makeId("it", leg.listing.id),
    kind: "transit",
    title: leg.title,
    listing: leg.listing,
  };
  if (leg.startTime) item.startTime = leg.startTime;
  if (leg.endTime) item.endTime = leg.endTime;
  return item;
}

function freeItem(title: string): ItineraryItem {
  return { id: makeId("it", "free", title), kind: "free", title };
}

/** Build the day-by-day plan. Returns the days and the listings actually placed (for budgeting). */
export function assembleDays(opts: {
  startDate: string;
  nights: number;
  destinationShort: string;
  paid: Activity[];
  free: Activity[];
  transit: TransitLeg[];
  pace: Pace;
}): { days: Day[]; placedActivityListings: Listing[]; transitListings: Listing[] } {
  const { startDate, nights, destinationShort, paid, free, transit, pace } = opts;
  const cap = PACE_CAP[pace];
  const arrival = transit.find((t) => t.placement === "arrival");
  const departure = transit.find((t) => t.placement === "departure");

  const dayItems: ItineraryItem[][] = Array.from({ length: nights }, () => []);
  const placedActivityListings: Listing[] = [];
  const transitListings: Listing[] = [];

  // arrival (day 1) + departure (last day) transit
  if (arrival) {
    dayItems[0]!.push(transitItem(arrival));
    transitListings.push(arrival.listing);
  }
  if (departure && nights >= 1) {
    dayItems[nights - 1]!.push(transitItem(departure));
    transitListings.push(departure.listing);
  }

  // distribute paid activities across middle days, respecting the per-day cap.
  // Fill order biases toward interior days (2..N) first, leaving the arrival day (index 0)
  // for last and lightly — you rarely want a packed schedule on the day you land. `cursor`
  // round-robins across days so activities spread out instead of stacking on the first slot.
  const interiorOrder: number[] = [];
  for (let d = 1; d < nights; d++) interiorOrder.push(d); // day 2..N (0-based 1..N-1)
  interiorOrder.push(0); // day 1 last, lightly
  let cursor = 0;
  for (const a of paid) {
    let placed = false;
    for (let attempt = 0; attempt < interiorOrder.length && !placed; attempt++) {
      const d = interiorOrder[(cursor + attempt) % interiorOrder.length]!;
      const scheduledCount = dayItems[d]!.filter((i) => i.kind === "activity").length;
      const limit = d === 0 ? 1 : cap;
      if (scheduledCount < limit) {
        dayItems[d]!.push(activityItem(a, dayItems[d]!.length > 0));
        placedActivityListings.push(a.listing);
        placed = true;
        cursor++;
      }
    }
    if (!placed) {
      // everything full — append to the least-busy interior day anyway
      const d = interiorOrder.reduce((best, x) => (dayItems[x]!.length < dayItems[best]!.length ? x : best), interiorOrder[0]!);
      dayItems[d]!.push(activityItem(a, true));
      placedActivityListings.push(a.listing);
    }
  }

  // fill empty days with free activities, then a generic relaxed item
  let freeIdx = 0;
  for (let d = 0; d < nights; d++) {
    if (dayItems[d]!.length === 0) {
      const f = free[freeIdx % Math.max(1, free.length)];
      if (f && free.length > 0) {
        dayItems[d]!.push(activityItem(f));
        placedActivityListings.push(f.listing);
        freeIdx++;
      } else {
        dayItems[d]!.push(freeItem(`Free day to relax in ${destinationShort}`));
      }
    }
  }

  // a free evening flourish on day 1 if only transit so far
  if (dayItems[0]!.every((i) => i.kind === "transit")) {
    dayItems[0]!.push(freeItem(`Settle in, evening stroll in ${destinationShort}`));
  }

  const days: Day[] = dayItems.map((items, idx) => {
    const date = addDays(startDate, idx);
    const headline = items.find((i) => i.kind === "activity") ?? items[0]!;
    let title: string;
    if (idx === 0) title = `Arrive in ${destinationShort}`;
    else if (idx === nights - 1) title = `Last day & departure`;
    else title = headline.title;
    return { index: idx + 1, date, title, items };
  });

  return { days, placedActivityListings, transitListings };
}
