import type { Activity } from "@wayfare/shared";
import type { ActivityQuery } from "../provider.js";
import { Rng } from "../../rng.js";
import { makeId } from "../../ids.js";
import { resolvePlace } from "../geo.js";
import { tierOf, activityBaseEur } from "../costIndex.js";
import { mockListing, round, type MockContext, type MockTier } from "../listingFactory.js";

/**
 * Procedural activities — drawn from category templates filtered by the user's interests and
 * tagged for kid-suitability. Many "free" options (price 0) serve budget/student personas.
 * Prices are party totals (per-person base × party size).
 */

interface Template {
  category: string;
  title: string;
  /** price multiple of the tier activity base; 0 = free. */
  mult: number;
  durationMin: number;
  tags: string[];
  kid: boolean;
}

const TEMPLATES: Template[] = [
  { category: "free_walk", title: "Free old-town walking tour", mult: 0, durationMin: 120, tags: ["culture", "history", "city"], kid: true },
  { category: "beach", title: "Beach day", mult: 0, durationMin: 240, tags: ["beach", "relaxed", "nature"], kid: true },
  { category: "viewpoint", title: "Sunset viewpoint", mult: 0, durationMin: 60, tags: ["nature", "romantic", "relaxed"], kid: true },
  { category: "park", title: "City park & gardens", mult: 0, durationMin: 120, tags: ["nature", "relaxed", "kids", "city"], kid: true },
  { category: "market", title: "Local food market browse", mult: 0, durationMin: 90, tags: ["food", "culture"], kid: true },
  { category: "museum", title: "Headline museum", mult: 1.0, durationMin: 150, tags: ["culture", "history", "science"], kid: true },
  { category: "science_museum", title: "Hands-on science museum", mult: 1.1, durationMin: 180, tags: ["science", "kids", "family"], kid: true },
  { category: "zoo", title: "Zoo / aquarium", mult: 1.2, durationMin: 210, tags: ["animals", "kids", "family", "nature"], kid: true },
  { category: "boat_trip", title: "Half-day boat trip", mult: 2.4, durationMin: 240, tags: ["beach", "nature", "adventure"], kid: true },
  { category: "food_tour", title: "Evening food & wine tour", mult: 1.8, durationMin: 180, tags: ["food", "nightlife", "culture"], kid: false },
  { category: "cooking_class", title: "Local cooking class", mult: 1.6, durationMin: 180, tags: ["food", "culture"], kid: true },
  { category: "bike_tour", title: "Guided bike tour", mult: 0.9, durationMin: 180, tags: ["nature", "adventure", "city", "kids"], kid: true },
  { category: "day_trip", title: "Day trip to a quieter spot", mult: 1.5, durationMin: 360, tags: ["nature", "adventure", "relaxed"], kid: true },
  { category: "nightlife", title: "A lively night out", mult: 0.8, durationMin: 180, tags: ["nightlife", "party"], kid: false },
  { category: "hike", title: "Coastal or mountain hike", mult: 0, durationMin: 240, tags: ["nature", "adventure"], kid: true },
];

function matches(t: Template, interests: string[]): number {
  if (interests.length === 0) return 1;
  return t.tags.filter((tag) => interests.some((i) => i.toLowerCase().includes(tag) || tag.includes(i.toLowerCase()))).length;
}

export function generateActivities(
  q: ActivityQuery,
  ctx: MockContext,
  tier: MockTier = "procedural",
): Activity[] {
  const place = resolvePlace(q.location);
  const destTier = tierOf(q.location);
  const base = activityBaseEur(destTier);
  const rng = new Rng("activities", q.location, q.interests.join(","), q.partySize);

  let pool = TEMPLATES;
  if (q.kidFriendly) pool = pool.filter((t) => t.kid);

  // rank by interest match, keep a spread of free + paid
  const ranked = [...pool]
    .map((t) => ({ t, score: matches(t, q.interests) + rng.float() * 0.5 }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);

  const chosen = ranked.slice(0, 10);

  return chosen
    .map((t, i) => {
      const perPerson = t.mult === 0 ? 0 : base * t.mult * (0.9 + rng.float() * 0.2);
      const priceEur = round(perPerson * q.partySize);
      if (q.maxPrice != null && priceEur > q.maxPrice) return null;
      const activity: Activity = {
        id: makeId("act", q.location, t.category, i),
        category: t.category,
        durationMin: t.durationMin,
        bookingRequired: t.mult > 0,
        listing: mockListing(ctx, {
          id: makeId("lst", "act", q.location, t.category, i),
          kind: "activity",
          title: `${t.title} in ${place.name}`,
          priceEur,
          tier,
          confidence: 0.7,
        }),
      };
      return activity;
    })
    .filter((a): a is Activity => a !== null);
}
