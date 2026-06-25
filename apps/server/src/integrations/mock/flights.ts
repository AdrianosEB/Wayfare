import type { Flight } from "@wayfare/shared";
import type { FlightQuery } from "../provider.js";
import { Rng } from "../../rng.js";
import { makeId } from "../../ids.js";
import { resolvePlace, distanceKm } from "../geo.js";
import { tierOf, flightPerKmEur } from "../costIndex.js";
import { mockListing, round, type MockContext, type MockTier } from "../listingFactory.js";

/**
 * Procedural flights — priced from great-circle distance × a tier per-km rate, with seeded
 * modifiers for stops, date flexibility, and demand. Returns candidate round trips as
 * consecutive [outbound, return] pairs, best (cheapest) first. Listing prices are party totals.
 */

const CARRIERS = ["EasyJet", "Ryanair", "Vueling", "Lufthansa", "ITA Airways", "Aegean", "KLM", "Wizz Air"];

const FLEX_DISCOUNT = { fixed: 1.0, window: 0.92, very_flexible: 0.85 } as const;

function hhmm(rng: Rng, minHour: number, maxHour: number): string {
  const h = rng.int(minHour, maxHour);
  const m = rng.pick([0, 10, 15, 20, 30, 45]);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function legISO(date: string, time: string): string {
  return `${date}T${time}:00Z`;
}

export function generateFlights(
  q: FlightQuery,
  ctx: MockContext,
  tier: MockTier = "procedural",
): Flight[] {
  const origin = resolvePlace(q.origin);
  const dest = resolvePlace(q.destination);
  const dist = Math.max(120, distanceKm(origin, dest));
  const destTier = tierOf(q.destination);
  const pax = q.adults + (q.children ?? 0);
  const flex = FLEX_DISCOUNT[q.dateFlexibility];

  // base round-trip fare per person (both legs), with a sane floor for very short hops.
  const baseRtPP = Math.max(49, flightPerKmEur(destTier) * dist * 2);

  type Option = { stops: number; mult: number; carrier: string };
  const rng = new Rng("flights", q.origin, q.destination, q.departDate, pax);
  const options: Option[] = [
    { stops: 0, mult: 1.0 * flex, carrier: rng.pick(CARRIERS) },
    { stops: 1, mult: 0.82 * flex, carrier: rng.pick(CARRIERS) },
    { stops: 0, mult: 1.12, carrier: rng.pick(CARRIERS) }, // a pricier fixed-time nonstop
  ].filter((o) => q.maxStops == null || o.stops <= q.maxStops);

  const flightHours = Math.max(1, dist / 750) + 0.6;

  const built = options.map((opt, i) => {
    // Per-person round-trip fare = base × option multiplier × seeded demand jitter, plus a flat
    // €35 per stop. Split evenly across the two legs and scaled to a party total; each leg's
    // Listing price is therefore (rtPP / 2) × pax, and `total` (both legs) drives the sort.
    // (The `opt.stops === 1 ? 1 : 1` term is an intentional no-op placeholder for a future
    // stops-based multiplier — stops are currently priced only via the flat +35 above.)
    const demand = 0.9 + rng.float() * 0.3;
    const rtPP = baseRtPP * opt.mult * demand * (opt.stops === 1 ? 1 : 1) + opt.stops * 35;
    const legPriceParty = round((rtPP / 2) * pax);
    const total = legPriceParty * 2;

    const outDep = hhmm(rng, 6, 11);
    const retDep = hhmm(rng, 12, 19);
    const outArrHour = Math.min(23, parseInt(outDep) + Math.ceil(flightHours) + opt.stops);
    const retArrHour = Math.min(23, parseInt(retDep) + Math.ceil(flightHours) + opt.stops);

    const outbound: Flight = {
      id: makeId("fl", q.origin, q.destination, "out", i),
      direction: "outbound",
      from: origin.iata,
      to: dest.iata,
      departISO: legISO(q.departDate, outDep),
      arriveISO: legISO(q.departDate, `${String(outArrHour).padStart(2, "0")}:05`),
      stops: opt.stops,
      carrier: opt.carrier,
      listing: mockListing(ctx, {
        id: makeId("lst", "fl", q.origin, q.destination, "out", i),
        kind: "flight",
        title: `${origin.name} → ${dest.name}`,
        priceEur: legPriceParty,
        tier,
        confidence: 0.7,
      }),
    };
    const ret: Flight = {
      id: makeId("fl", q.origin, q.destination, "ret", i),
      direction: "return",
      from: dest.iata,
      to: origin.iata,
      departISO: legISO(q.returnDate, retDep),
      arriveISO: legISO(q.returnDate, `${String(retArrHour).padStart(2, "0")}:05`),
      stops: opt.stops,
      carrier: opt.carrier,
      listing: mockListing(ctx, {
        id: makeId("lst", "fl", q.origin, q.destination, "ret", i),
        kind: "flight",
        title: `${dest.name} → ${origin.name}`,
        priceEur: legPriceParty,
        tier,
        confidence: 0.7,
      }),
    };
    return { total, legs: [outbound, ret] as const };
  });

  built.sort((a, b) => a.total - b.total);
  return built.flatMap((b) => b.legs);
}
