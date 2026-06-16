import { describe, it, expect } from "vitest";
import { TripSchema, type AnswerValue, type ClarifyQuestion } from "@wayfare/shared";
import { parsePrompt } from "../src/agent/parse.js";
import { selectClarifyQuestions } from "../src/agent/clarify.js";
import { mergeAnswers } from "../src/agent/merge.js";
import { planDeterministic } from "../src/agent/planner.js";
import { planDeps, capturingEmitter } from "./helpers.js";

/**
 * The three VISION.md journeys must each plan end-to-end through the one loop: one sentence →
 * a couple of smart questions → a costed whole-trip plan (DoD #4).
 */

const PERSONA_ANSWERS: Record<string, AnswerValue> = {
  origin: "Berlin",
  avoid: "Barcelona",
  vibe_dest: "quieter",
  budget: { amount: 2000, currency: "EUR" },
  budget_firmness: "soft",
  dates_exact: "very_flexible",
  interests: ["beach", "food"],
  party: { adults: 2 },
};

function answerFor(q: ClarifyQuestion, overrides: Record<string, AnswerValue>): AnswerValue {
  return overrides[q.id] ?? PERSONA_ANSWERS[q.id] ?? (q.format === "multiselect" ? ["food"] : "anything");
}

async function planJourney(prompt: string, overrides: Record<string, AnswerValue>) {
  const { request: parsed } = parsePrompt(prompt);
  const questions = selectClarifyQuestions(parsed);
  const answers: Record<string, AnswerValue> = {};
  for (const q of questions) answers[q.id] = answerFor(q, overrides);
  const request = mergeAnswers(parsed, answers, []);
  const { emit } = capturingEmitter();
  return { request, trip: await planDeterministic(request, planDeps(), emit) };
}

function assertCoherent(trip: import("@wayfare/shared").Trip, expectedDays: number) {
  expect(() => TripSchema.parse(trip)).not.toThrow();
  // complete itinerary: transport both ways, a stay covering the nights, no empty day (US-3.1)
  expect(trip.itinerary.flights.some((f) => f.direction === "outbound")).toBe(true);
  expect(trip.itinerary.flights.some((f) => f.direction === "return")).toBe(true);
  expect(trip.itinerary.stays.length).toBeGreaterThanOrEqual(1);
  expect(trip.itinerary.days).toHaveLength(expectedDays);
  for (const d of trip.itinerary.days) expect(d.items.length).toBeGreaterThanOrEqual(1);
  // budget honesty invariant + every priced item has source/freshness
  expect(trip.budget.lines.reduce((a, l) => a + l.amount, 0)).toBe(trip.budget.total);
  for (const d of trip.itinerary.days)
    for (const it of d.items) if (it.listing) expect(it.listing.freshness).toBe("mock");
}

describe("VISION journeys plan end-to-end (DoD #4)", () => {
  it("Journey 1 — Maya's €600 hard-cap solo week (value-first)", async () => {
    const { trip } = await planJourney(
      "cheap sunny week somewhere in Europe in March, I'm flexible on dates, max €600 all in, just me",
      { origin: "Berlin", avoid: "Barcelona" },
    );
    assertCoherent(trip, 7);
    expect(trip.travelers).toHaveLength(1);
    expect(trip.budget.target?.type).toBe("hard");
    // hard cap: either within budget, or honestly flagged over with a way back (US-4.3)
    if (trip.budget.status === "over") expect(trip.budget.overageNote).toBeTruthy();
  });

  it("Journey 2 — Sam & Alex's €2,500 Greek beach trip", async () => {
    const { trip } = await planJourney(
      "I want a relaxed 8-day beach trip in Greece in late August for two people, around €2,500 total",
      { origin: "London", vibe_dest: "quieter" },
    );
    assertCoherent(trip, 8);
    expect(trip.itinerary.destinationResolved).toBe("Naxos, Greece");
    expect(trip.budget.total).toBe(2410);
  });

  it("Journey 3 — the Okonkwo family £1,800 Easter city break", async () => {
    const { trip } = await planJourney(
      "4-day city trip somewhere fun for the kids over Easter weekend, budget £1,800, somewhere not too far",
      { origin: "Manchester", party: { adults: 2, children: 2, childAges: [9, 12] } },
    );
    assertCoherent(trip, 4);
    expect(trip.travelers.filter((t) => t.type === "child")).toHaveLength(2);
    expect(trip.budget.currency).toBe("GBP");
  });
});
