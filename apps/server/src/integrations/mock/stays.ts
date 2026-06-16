import type { Stay, StayType } from "@wayfare/shared";
import type { StayQuery } from "../provider.js";
import { Rng } from "../../rng.js";
import { makeId } from "../../ids.js";
import { resolvePlace } from "../geo.js";
import { tierOf, nightlyBaseEur } from "../costIndex.js";
import { mockListing, round, type MockContext, type MockTier } from "../listingFactory.js";
import { nightsBetween } from "../../dates.js";

/**
 * Procedural stays — nightly rate from the destination cost tier × a style multiplier
 * (hostel < guesthouse < apartment < aparthotel < hotel) × a location multiplier (central /
 * near-beach cost more). Returns ~3 candidates spanning the price/quality spectrum.
 */

const STYLE_MULT: Record<StayType, number> = {
  hostel: 0.5,
  guesthouse: 0.78,
  apartment: 1.0,
  aparthotel: 1.12,
  hotel: 1.35,
};

const AMENITIES_POOL = [
  "wifi", "air_conditioning", "kitchen", "balcony", "pool", "breakfast",
  "parking", "beachfront", "sea_view", "family_room",
];

function wantsNearBeach(style?: string[]): boolean {
  return !!style?.some((s) => /beach|sea|coast/i.test(s));
}
function wantsCentral(style?: string[]): boolean {
  return !!style?.some((s) => /central|center|centre|town/i.test(s));
}
function wantsBudget(style?: string[]): boolean {
  return !!style?.some((s) => /budget|cheap|hostel/i.test(s));
}

export function generateStays(
  q: StayQuery,
  ctx: MockContext,
  tier: MockTier = "procedural",
): Stay[] {
  const place = resolvePlace(q.location);
  const nights = Math.max(1, nightsBetween(q.checkIn, q.checkOut));
  const destTier = tierOf(q.location);
  const nightly0 = nightlyBaseEur(destTier);
  const rng = new Rng("stays", q.location, q.checkIn, q.guests);

  // candidate types skewed by requested style
  const types: StayType[] = wantsBudget(q.style)
    ? ["hostel", "guesthouse", "apartment"]
    : ["apartment", "aparthotel", "hotel"];

  const nearBeach = wantsNearBeach(q.style);
  const central = wantsCentral(q.style);
  const locationMult = nearBeach || central ? 1.18 : 1.0;
  const guestFactor = 1 + Math.max(0, q.guests - 2) * 0.25;

  const candidates = types.map((type, i) => {
    const variance = 0.92 + rng.float() * 0.22;
    const nightly = nightly0 * STYLE_MULT[type] * locationMult * guestFactor * variance;
    const totalEur = round(nightly * nights);
    const rating = Math.round((3.7 + rng.float() * 1.2) * 10) / 10;

    const amenities = new Set<string>(["wifi"]);
    if (nearBeach) amenities.add("beachfront");
    if (type === "hotel" || type === "aparthotel") amenities.add("pool");
    if (type !== "hostel") amenities.add("air_conditioning");
    while (amenities.size < 4) amenities.add(rng.pick(AMENITIES_POOL));

    const name = `${place.name} ${type === "hostel" ? "Hostel" : type === "hotel" ? "Hotel" : "Studios"} ${["Bay", "Centro", "Vista", "Marina", "Plaza"][i % 5]}`;

    const stay: Stay = {
      id: makeId("stay", q.location, type, i),
      name,
      type,
      location: { lat: place.lat, lng: place.lng, name: place.name },
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      nights,
      rating,
      amenities: [...amenities],
      ...(nearBeach
        ? { distanceToFocus: { label: "to beach", meters: rng.int(80, 600) } }
        : central
          ? { distanceToFocus: { label: "to center", meters: rng.int(100, 800) } }
          : {}),
      listing: mockListing(ctx, {
        id: makeId("lst", "stay", q.location, type, i),
        kind: "stay",
        title: `${name} — ${nights} night${nights === 1 ? "" : "s"}`,
        priceEur: totalEur,
        tier,
        confidence: 0.7,
      }),
    };
    return stay;
  });

  const capped = q.maxNightly
    ? candidates.filter((s) => s.listing.price.amount / s.nights <= q.maxNightly! * 1.05)
    : candidates;
  const list = capped.length > 0 ? capped : candidates;
  return [...list].sort((a, b) => a.listing.price.amount - b.listing.price.amount);
}
