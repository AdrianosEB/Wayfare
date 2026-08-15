import { describe, it, expect } from "vitest";
import type { TripRequest } from "@wayfare/shared";
import {
  composeItineraries,
  deriveWindows,
  computeItineraryTotal,
  Tracer,
} from "../src/index.js";
import type { Persona, RankedOption, VerifiedOption } from "../src/index.js";

/**
 * The supervisor must (1) branch over date windows, (2) prune branches that blow the budget
 * before it expands them with activities, and (3) return whole-itinerary combinations priced
 * as a unit.
 */

const persona: Persona = {
  reasoning: ["test fixture -> price up"],
  weights: { price: 0.5, quality: 0.15, location: 0.15, vibe: 0.1, flexibility: 0.1 },
  preferences: { pace: "moderate", interests: [] },
  summary: "test",
};

function opt(kind: "flight" | "stay" | "activity", name: string, amount: number): VerifiedOption {
  return {
    entity: { key: `${kind}:naxos:${name}`, name, kind, locality: "Naxos" },
    verdict: "verified",
    confidence: 0.8,
    best: {
      id: `x:${name}`,
      kind,
      title: name,
      price: { amount, currency: "EUR" },
      source: { provider: "booking", label: "Booking.com · sample" },
      fetchedAt: "2026-06-16T10:00:00Z",
      freshness: "mock",
      confidence: 0.8,
    },
    corroboration: [],
    sources: ["booking", "expedia"],
    priceSpread: { min: amount, max: amount, currency: "EUR" },
    tags: [],
    flags: [],
  };
}

function ranked(o: VerifiedOption, score: number): RankedOption {
  return { option: o, score, breakdown: { price: score, quality: 0, location: 0, vibe: 0, verification: 0 } };
}

const request: TripRequest = {
  destination: { value: "Naxos", source: "prompt", confidence: 0.8 },
  origin: null,
  durationDays: { value: 4, source: "prompt", confidence: 0.9 },
  dates: { value: { month: 9, flexibility: "window" }, source: "prompt", confidence: 0.6 },
  partySize: { value: { adults: 2 }, source: "prompt", confidence: 0.8 },
  budget: { value: { amount: 1500, currency: "EUR", type: "soft" }, source: "prompt", confidence: 0.8 },
  vibe: null,
  pace: null,
  mustHaves: null,
  avoid: null,
};

describe("supervisor", () => {
  it("derives early/mid/late windows for flexible dates", () => {
    const windows = deriveWindows(request, 4);
    expect(windows).toHaveLength(3);
    expect(windows.map((w) => w.priceFactor)).toEqual([0.95, 1, 1.05]);
  });

  it("prices a whole itinerary as flight×travelers + stay×nights (+window factor)", () => {
    const total = computeItineraryTotal({
      flightUnit: 100,
      stayUnit: 80,
      activityUnits: [20],
      nights: 4,
      travelers: 2,
      priceFactor: 1,
    });
    // (100*2 + 80*4)*1 + 20 = 200 + 320 + 20 = 540
    expect(total).toBe(540);
  });

  it("prunes over-budget branches before expanding, and keeps affordable ones", () => {
    const rankedByKind = {
      flight: [ranked(opt("flight", "cheap-air", 120), 0.9), ranked(opt("flight", "pricey-air", 900), 0.4)],
      stay: [ranked(opt("stay", "cheap-stay", 90), 0.9), ranked(opt("stay", "lux-stay", 700), 0.3)],
      activity: [ranked(opt("activity", "food-tour", 25), 0.8)],
    };
    const { itineraries, stats } = composeItineraries({ rankedByKind, persona, request, tracer: new Tracer() });

    // 3 windows × 2 flights × 2 stays = 12 branches expanded.
    expect(stats.expanded).toBe(12);
    // the pricey-air + lux-stay combos exceed 1500*(1.1) and must be pruned before expansion.
    expect(stats.prunedOnBudget).toBeGreaterThan(0);
    // the best itinerary leads with the affordable, within-budget combination.
    expect(itineraries[0]?.withinBudget).toBe(true);
    expect(itineraries[0]?.flight?.entity.name).toBe("cheap-air");
    expect(itineraries[0]?.stay?.entity.name).toBe("cheap-stay");
  });
});
