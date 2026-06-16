import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Assumption } from "@wayfare/shared";
import type { PlanEmitter } from "../src/agent/planner.js";

const dir = dirname(fileURLToPath(import.meta.url));
export const readFixture = (name: string) =>
  JSON.parse(readFileSync(join(dir, "fixtures", name), "utf8"));

export const NOW = "2026-06-16T10:00:00Z";
export const YEAR = 2026;
export const planDeps = () => ({ ctx: { now: NOW, currency: "EUR" }, year: YEAR, useAgent: false, model: "test" });

export interface Captured {
  steps: string[];
  patches: Array<Record<string, unknown>>;
  assumptions: Assumption[];
  messages: string[];
}

export function capturingEmitter(): { emit: PlanEmitter; captured: Captured } {
  const captured: Captured = { steps: [], patches: [], assumptions: [], messages: [] };
  const emit: PlanEmitter = {
    status: (step) => captured.steps.push(step),
    partial: (patch) => captured.patches.push(patch),
    assumption: (a) => captured.assumptions.push(a),
    message: (text) => captured.messages.push(text),
  };
  return { emit, captured };
}
