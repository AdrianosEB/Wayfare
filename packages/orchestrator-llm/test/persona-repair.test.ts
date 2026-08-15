import { describe, expect, it } from "vitest";
import { PersonaSchema } from "@wayfare/orchestrator";

import { PersonaWireSchema, repairPersonaShape } from "../src/nodes.js";

/**
 * The hoist is a safety net over a paid teacher pass and over the production persona path, so it
 * has to be exactly as narrow as advertised: move a misplaced value, never invent or overwrite
 * one. These cover the shape actually observed in the wild (13–19% of calls put `reasoning`
 * inside `preferences`) plus the ways a careless repair could do damage.
 */

const goodPreferences = { pace: "relaxed" as const, interests: ["food"] };
const goodWeights = { price: 0.2, quality: 0.2, location: 0.2, vibe: 0.2, flexibility: 0.2 };

describe("repairPersonaShape", () => {
  it("hoists reasoning out of preferences and leaves a strictly-valid persona", () => {
    const wire = {
      weights: goodWeights,
      preferences: { ...goodPreferences, reasoning: ["counts every euro -> price up"] },
      summary: "cost-led",
    };
    // The observed wire shape must at least parse against the lenient schema, or the repair
    // never runs — that is the whole mechanism.
    expect(PersonaWireSchema.safeParse(wire).success).toBe(true);

    const repaired = repairPersonaShape(wire);
    const parsed = PersonaSchema.safeParse(repaired);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.reasoning).toEqual(["counts every euro -> price up"]);
    // and it must not leave a copy behind in preferences, which is `.strict()`
    expect((repaired as { preferences: Record<string, unknown> }).preferences.reasoning).toBeUndefined();
  });

  it("never overwrites a value the model put in the right place", () => {
    const wire = {
      reasoning: ["correct -> price up"],
      weights: goodWeights,
      preferences: { ...goodPreferences, reasoning: ["misplaced -> vibe down"] },
      summary: "s",
    };
    const repaired = repairPersonaShape(wire) as { reasoning: string[] };
    expect(repaired.reasoning).toEqual(["correct -> price up"]);
  });

  it("leaves a well-formed persona byte-identical", () => {
    const good = { reasoning: ["a -> price up"], weights: goodWeights, preferences: goodPreferences, summary: "s" };
    expect(repairPersonaShape(good)).toBe(good);
  });

  it("cannot invent a missing field — an unrepairable object still fails strict validation", () => {
    // `weights` absent everywhere: the repair must not fabricate it, so this stays a failure.
    const wire = { preferences: { ...goodPreferences, reasoning: ["a -> price up"] }, summary: "s" };
    expect(PersonaSchema.safeParse(repairPersonaShape(wire)).success).toBe(false);
  });

  it("tolerates non-objects and objects without preferences", () => {
    expect(repairPersonaShape(null)).toBeNull();
    expect(repairPersonaShape("nope")).toBe("nope");
    const noPrefs = { weights: goodWeights };
    expect(repairPersonaShape(noPrefs)).toBe(noPrefs);
  });
});
