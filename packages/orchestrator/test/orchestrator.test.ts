import { describe, it, expect } from "vitest";
import { PlanResultSchema } from "../src/types.js";
import { Orchestrator, mockProviderRegistry } from "../src/index.js";
import type { TravelerProfile } from "../src/index.js";

/**
 * End-to-end: a full plan against the mock market must (1) conform to PlanResultSchema, (2)
 * never lead with a suspect option, (3) keep the budget total equal to the sum of its lines,
 * and (4) stage every booking as approval-required — the orchestration never books on its own.
 */

const traveler: TravelerProfile = {
  id: "u_test",
  homeCity: "London",
  signals: ["foodie on a budget", "wants to be central"],
  budget: { amount: 1800, currency: "EUR", type: "soft" },
  partySize: { adults: 2 },
  mustHaves: [],
  avoid: [],
};

const prompt = "5 day foodie trip to Naxos in September, budget around €1800 for two";

describe("Orchestrator.plan", () => {
  it("produces a schema-valid plan", async () => {
    const plan = await new Orchestrator(mockProviderRegistry()).plan(prompt, traveler);
    expect(() => PlanResultSchema.parse(plan)).not.toThrow();
  });

  it("selects verified options and never leads with a suspect one", async () => {
    const plan = await new Orchestrator(mockProviderRegistry()).plan(prompt, traveler);
    expect(Object.keys(plan.selection).length).toBeGreaterThan(0);
    for (const r of Object.values(plan.selection)) {
      expect(r.option.verdict).not.toBe("suspect");
    }
  });

  it("keeps the budget total equal to the sum of its lines", async () => {
    const plan = await new Orchestrator(mockProviderRegistry()).plan(prompt, traveler);
    const sum = plan.budget.lines.reduce((a, l) => a + l.amount, 0);
    expect(plan.budget.total).toBe(sum);
  });

  it("stages every booking as approval-required and never executes one", async () => {
    const plan = await new Orchestrator(mockProviderRegistry()).plan(prompt, traveler);
    expect(plan.bookingIntents.length).toBeGreaterThan(0);
    for (const intent of plan.bookingIntents) {
      expect(intent.status).toBe("requires_approval");
    }
  });

  it("reads personality from signals into persona weights", async () => {
    const plan = await new Orchestrator(mockProviderRegistry()).plan(prompt, traveler);
    // "on a budget" should push price to the top axis.
    const top = Object.entries(plan.persona.weights).sort((a, b) => b[1] - a[1])[0]?.[0];
    expect(top).toBe("price");
  });

  it("is deterministic for the same input", async () => {
    const a = await new Orchestrator(mockProviderRegistry()).plan(prompt, traveler);
    const b = await new Orchestrator(mockProviderRegistry()).plan(prompt, traveler);
    expect(b.selection.stay?.option.entity.key).toBe(a.selection.stay?.option.entity.key);
    expect(b.budget.total).toBe(a.budget.total);
  });
});
