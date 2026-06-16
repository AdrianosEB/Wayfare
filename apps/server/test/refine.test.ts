import { describe, it, expect } from "vitest";
import { TripSchema, type Trip } from "@wayfare/shared";
import { parsePrompt } from "../src/agent/parse.js";
import { mergeAnswers } from "../src/agent/merge.js";
import { planDeterministic } from "../src/agent/planner.js";
import { refine } from "../src/agent/refine.js";
import { planDeps, capturingEmitter } from "./helpers.js";

const CANONICAL =
  "I want a relaxed 8-day beach trip in Greece in late August for two people, around €2,500 total";

async function baseTrip(): Promise<{ trip: Trip; request: import("@wayfare/shared").TripRequest }> {
  const { request: parsed } = parsePrompt(CANONICAL);
  const request = mergeAnswers(parsed, { origin: "London", vibe_dest: "quieter" }, []);
  const { emit } = capturingEmitter();
  return { trip: await planDeterministic(request, planDeps(), emit), request };
}

describe("refine — partial re-planning (US-4.2, US-4.3, US-4.4)", () => {
  it("the canonical lodging+day-trip refinement matches the fixture deltas", async () => {
    const { trip, request } = await baseTrip();
    const { emit } = capturingEmitter();
    const result = await refine(
      trip,
      request,
      "swap the hotel for something nearer the beach, and add a day trip to a quieter island",
      planDeps(),
      emit,
    );

    expect(result.scope).toBe("lodging");
    expect(() => TripSchema.parse(result.trip)).not.toThrow();
    expect(result.budgetDelta).toBe(145);
    expect(result.trip.budget.total).toBe(2555);
    expect(result.trip.budget.status).toBe("over");
    expect(result.trip.budget.overageNote).toBeTruthy();

    // diff: a stay replace (+60) and a day-trip add (+85)
    const stayDiff = result.diff.find((d) => d.path === "itinerary.stays[0]");
    expect(stayDiff?.op).toBe("replace");
    expect(stayDiff?.priceDelta).toBe(60);
    const addDiff = result.diff.find((d) => d.op === "add");
    expect(addDiff?.priceDelta).toBe(85);
  });

  it("freezes the unaffected slices — flights and day 1 stay byte-identical (US-4.2)", async () => {
    const { trip, request } = await baseTrip();
    const { emit } = capturingEmitter();
    const result = await refine(
      trip,
      request,
      "swap the hotel for something nearer the beach, and add a day trip to a quieter island",
      planDeps(),
      emit,
    );
    expect(result.trip.itinerary.flights).toEqual(trip.itinerary.flights);
    expect(result.trip.itinerary.days[0]).toEqual(trip.itinerary.days[0]);
  });

  it("info-scope questions change nothing (the safety valve)", async () => {
    const { trip, request } = await baseTrip();
    const { emit, captured } = capturingEmitter();
    const result = await refine(trip, request, "why Naxos over Mykonos?", planDeps(), emit);
    expect(result.scope).toBe("info");
    expect(result.budgetDelta).toBe(0);
    expect(result.trip).toEqual(trip);
    expect(captured.messages.length).toBeGreaterThan(0);
  });
});
