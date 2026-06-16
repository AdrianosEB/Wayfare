import { describe, it, expect } from "vitest";
import { TripSchema, ClarifyQuestionSchema } from "@wayfare/shared";
import { z } from "zod";
import { parsePrompt } from "../src/agent/parse.js";
import { selectClarifyQuestions } from "../src/agent/clarify.js";
import { mergeAnswers } from "../src/agent/merge.js";
import { planDeterministic } from "../src/agent/planner.js";
import { readFixture, planDeps, capturingEmitter } from "./helpers.js";

const CANONICAL =
  "I want a relaxed 8-day beach trip in Greece in late August for two people, around €2,500 total";

describe("prompt parsing + clarify (US-1.2, US-2.1)", () => {
  it("extracts the canonical sentence exactly like the session-create fixture", () => {
    const { request } = parsePrompt(CANONICAL);
    const fixture = readFixture("session-create.response.json");
    expect(request).toEqual(fixture.extracted);
  });

  it("asks exactly the two fixture clarify questions (origin + Greek-island vibe)", () => {
    const { request } = parsePrompt(CANONICAL);
    const qs = selectClarifyQuestions(request);
    const fixture = readFixture("session-create.response.json");
    expect(qs).toEqual(fixture.clarifyQuestions);
    for (const q of qs) expect(() => ClarifyQuestionSchema.parse(q)).not.toThrow();
  });
});

describe("deterministic plan — canonical Greek journey (Journey 2)", () => {
  function planCanonical() {
    const { request: parsed } = parsePrompt(CANONICAL);
    const request = mergeAnswers(parsed, { origin: "London", vibe_dest: "quieter" }, []);
    const { emit, captured } = capturingEmitter();
    return { request, captured, run: planDeterministic(request, planDeps(), emit) };
  }

  it("produces a schema-valid Trip resolved to Naxos", async () => {
    const { run } = planCanonical();
    const trip = await run;
    expect(() => TripSchema.parse(trip)).not.toThrow();
    expect(trip.itinerary.destinationResolved).toBe("Naxos, Greece");
    expect(trip.itinerary.days).toHaveLength(8);
    expect(trip.itinerary.stays[0]!.nights).toBe(8);
    expect(trip.status).toBe("complete");
  });

  it("reproduces the documented €2,410 budget breakdown", async () => {
    const { run } = planCanonical();
    const trip = await run;
    expect(trip.budget.total).toBe(2410);
    expect(trip.budget.status).toBe("under");
    const amounts = Object.fromEntries(trip.budget.lines.map((l) => [l.category, l.amount]));
    expect(amounts).toEqual({ flights: 620, transit: 96, stay: 980, activities: 414, buffer: 300 });
  });

  it("budget total always equals the sum of its lines (honesty invariant)", async () => {
    const { run } = planCanonical();
    const trip = await run;
    const sum = trip.budget.lines.reduce((a, l) => a + l.amount, 0);
    expect(sum).toBe(trip.budget.total);
  });

  it("request snapshot matches the trip-complete fixture request", async () => {
    const { run } = planCanonical();
    const trip = await run;
    expect(trip.request).toEqual(readFixture("trip-complete.json").trip.request);
  });

  it("surfaces ≥1 saving hint and states the dates assumption (US-3.5, US-5.2)", async () => {
    const { run } = planCanonical();
    const trip = await run;
    expect(trip.budget.savings.length).toBeGreaterThanOrEqual(1);
    expect(trip.assumptions.some((a) => a.field === "dates")).toBe(true);
  });

  it("streams progress steps in the documented order (NFR-2)", async () => {
    const { captured, run } = planCanonical();
    await run;
    expect(captured.steps).toEqual([
      "resolve",
      "search_flights",
      "search_stays",
      "search_activities",
      "compute_budget",
    ]);
    expect(captured.assumptions.some((a) => a.field === "dates")).toBe(true);
  });

  it("is deterministic — same inputs yield the same plan (NFR-6)", async () => {
    const a = await planCanonical().run;
    const b = await planCanonical().run;
    expect(a).toEqual(b);
  });
});
