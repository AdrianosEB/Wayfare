import type { Flight, Stay, Activity, TripRequest } from "@wayfare/shared";
import type { FlightQuery, StayQuery, ActivityQuery } from "../provider.js";
import { makeId } from "../../ids.js";
import { resolvePlace } from "../geo.js";
import { mockListing, round, type MockContext } from "../listingFactory.js";
import { nightsBetween } from "../../dates.js";
import type { CuratedPack, TransitLeg } from "./index.js";

/**
 * Greek-islands curated hero pack. Flights route via the Santorini (JTR) gateway with a ferry
 * hop to the chosen island; the quieter vibe resolves to Naxos (the canonical journey). Prices
 * are authored per-person so the canonical 2-traveler request reproduces the ~€2,410 plan, and
 * scale sensibly for other party sizes.
 */

const GATEWAY = { iata: "JTR", name: "Santorini" };

function islandForVibe(request: TripRequest): { name: string; reason: string } {
  const vibe = (request.vibe?.value ?? []).join(" ").toLowerCase();
  const mustHaves = (request.mustHaves?.value ?? []).join(" ").toLowerCase();
  const blob = `${vibe} ${mustHaves}`;
  if (/livel|party|mykonos|nightlife/.test(blob))
    return { name: "Mykonos", reason: "you leaned lively — Mykonos has the nightlife and beach-club scene." };
  if (/mix|balanc/.test(blob))
    return { name: "Paros", reason: "Paros balances buzzy Naoussa nights with quiet southern beaches." };
  return {
    name: "Naxos",
    reason:
      "you wanted quieter — Naxos has long sandy beaches (Agios Prokopios, Plaka), cheaper stays than Mykonos, and easy ferry hops to even quieter islands.",
  };
}

function paxOf(adults: number, children = 0): number {
  return adults + children;
}

const greeceFlights = (q: FlightQuery, ctx: MockContext): Flight[] => {
  const origin = resolvePlace(q.origin);
  const pax = paxOf(q.adults, q.children);
  // per-person round-trip ~€310 (155/leg); a pricier nonstop alternative at 175/leg.
  const options = [
    { perLeg: 155, carrier: "EasyJet", outDep: "07:10", outArr: "13:05", retDep: "14:20", retArr: "16:25" },
    { perLeg: 175, carrier: "Aegean", outDep: "10:30", outArr: "16:15", retDep: "17:40", retArr: "19:50" },
  ];
  return options.flatMap((o, i) => {
    const legParty = round(o.perLeg * pax);
    const out: Flight = {
      id: makeId("fl", "greece", q.origin, "out", i),
      direction: "outbound",
      from: origin.iata,
      to: GATEWAY.iata,
      departISO: `${q.departDate}T${o.outDep}:00Z`,
      arriveISO: `${q.departDate}T${o.outArr}:00Z`,
      stops: 0,
      carrier: o.carrier,
      listing: mockListing(ctx, {
        id: makeId("lst", "fl", "greece", q.origin, "out", i),
        kind: "flight",
        title: `${origin.name} → ${GATEWAY.name}`,
        priceEur: legParty,
        tier: "curated",
        confidence: 0.7,
      }),
    };
    const ret: Flight = {
      id: makeId("fl", "greece", q.origin, "ret", i),
      direction: "return",
      from: GATEWAY.iata,
      to: origin.iata,
      departISO: `${q.returnDate}T${o.retDep}:00Z`,
      arriveISO: `${q.returnDate}T${o.retArr}:00Z`,
      stops: 0,
      carrier: o.carrier,
      listing: mockListing(ctx, {
        id: makeId("lst", "fl", "greece", q.origin, "ret", i),
        kind: "flight",
        title: `${GATEWAY.name} → ${origin.name}`,
        priceEur: legParty,
        tier: "curated",
        confidence: 0.7,
      }),
    };
    return [out, ret];
  });
};

const greeceStays = (q: StayQuery, ctx: MockContext): Stay[] => {
  const nights = Math.max(1, nightsBetween(q.checkIn, q.checkOut));
  const units = Math.max(1, Math.ceil(q.guests / 2));
  // beachfront studio in Agios Prokopios (the canonical pick) + a closer, pricier alt.
  const defs = [
    { id: "studios_ap", name: "Studios Agios Prokopios", nightlyEur: 122.5, meters: 350, rating: 4.5, amenities: ["kitchen", "balcony", "air_conditioning"] },
    { id: "thalassa", name: "Studio Thalassa", nightlyEur: 130, meters: 120, rating: 4.6, amenities: ["kitchen", "balcony", "air_conditioning", "sea_view"] },
  ];
  return defs.map((d, i) => {
    const totalEur = round(d.nightlyEur * nights * units);
    const stay: Stay = {
      id: makeId("stay", "naxos", d.id),
      name: d.name,
      type: "apartment",
      location: { lat: 37.07, lng: 25.35, name: "Agios Prokopios, Naxos" },
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      nights,
      rating: d.rating,
      amenities: d.amenities,
      distanceToFocus: { label: "to beach", meters: d.meters },
      listing: mockListing(ctx, {
        id: makeId("lst", "stay", "naxos", d.id),
        kind: "stay",
        title: `${d.name} — ${nights} night${nights === 1 ? "" : "s"}`,
        priceEur: totalEur,
        tier: "curated",
        confidence: 0.7,
      }),
    };
    return stay;
  });
};

const greeceActivities = (q: ActivityQuery, ctx: MockContext): Activity[] => {
  const pax = q.partySize;
  // per-person prices; sum (paid) = 207 → €414 for two (matches the canonical plan).
  const defs = [
    { id: "boat", title: "Half-day boat trip to Rina Cave", category: "boat_trip", perPerson: 55, durationMin: 240, booking: true },
    { id: "food", title: "Evening food & wine tour in Naxos Town", category: "food_tour", perPerson: 35, durationMin: 180, booking: true },
    { id: "temple", title: "Temple of Apollo (Portara) guided visit", category: "museum", perPerson: 12, durationMin: 90, booking: true },
    { id: "village", title: "Mountain villages & Halki tour", category: "day_trip", perPerson: 30, durationMin: 300, booking: true },
    { id: "kite", title: "Kitesurfing taster at Mikri Vigla", category: "watersport", perPerson: 40, durationMin: 120, booking: true },
    { id: "cooking", title: "Naxian cooking class", category: "cooking_class", perPerson: 35, durationMin: 180, booking: true },
    { id: "beach", title: "Beach day at Agios Prokopios", category: "beach", perPerson: 0, durationMin: 240, booking: false },
    { id: "chora", title: "Sunset & dinner in Naxos Town (Chora)", category: "free_walk", perPerson: 0, durationMin: 180, booking: false },
  ];
  return defs.map((d) => {
    const priceEur = round(d.perPerson * pax);
    const activity: Activity = {
      id: makeId("act", "naxos", d.id),
      category: d.category,
      durationMin: d.durationMin,
      bookingRequired: d.booking,
      listing: mockListing(ctx, {
        id: makeId("lst", "act", "naxos", d.id),
        kind: "activity",
        title: d.title,
        priceEur,
        tier: "curated",
        confidence: 0.7,
      }),
    };
    return activity;
  });
};

const greeceTransit = (
  q: { location: string; partySize: number },
  ctx: MockContext,
): TransitLeg[] => {
  // round-trip ferry Santorini ↔ Naxos; €24pp each way → €96 for two.
  const each = round(24 * q.partySize);
  return [
    {
      placement: "arrival",
      title: "Ferry Santorini → Naxos",
      startTime: "16:00",
      endTime: "18:00",
      listing: mockListing(ctx, {
        id: makeId("lst", "ferry", "in"),
        kind: "transit",
        title: "Ferry to Naxos",
        priceEur: each,
        tier: "curated",
        confidence: 0.7,
      }),
    },
    {
      placement: "departure",
      title: "Ferry Naxos → Santorini (for return flight)",
      startTime: "08:00",
      endTime: "10:00",
      listing: mockListing(ctx, {
        id: makeId("lst", "ferry", "out"),
        kind: "transit",
        title: "Ferry to Santorini",
        priceEur: each,
        tier: "curated",
        confidence: 0.7,
      }),
    },
  ];
};

export const pack: CuratedPack = {
  id: "greece",
  matches(destination: string): boolean {
    return /greece|greek|naxos|mykonos|paros|santorini|milos|cyclades/i.test(destination);
  },
  resolve(request: TripRequest) {
    const island = islandForVibe(request);
    return { destinationResolved: `${island.name}, Greece`, reason: island.reason };
  },
  buildFlights: greeceFlights,
  buildStays: greeceStays,
  buildActivities: greeceActivities,
  buildTransit: greeceTransit,
};
