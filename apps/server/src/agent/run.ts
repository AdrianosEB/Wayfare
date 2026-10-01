import Anthropic from "@anthropic-ai/sdk";
import type { Trip, TripRequest } from "@wayfare/shared";
import { planDeterministic, type PlanDeps, type PlanEmitter } from "./planner.js";
import { planWithAgent } from "./agentLoop.js";

/**
 * Picks the Anthropic agent loop when configured, else the deterministic engine. Both stream
 * the same SSE protocol and return a schema-valid Trip.
 */
export interface RunDeps extends PlanDeps {
  anthropic?: Anthropic;
  model: string;
  useAgent: boolean;
}

export async function runPlan(
  request: TripRequest,
  deps: RunDeps,
  emit: PlanEmitter,
): Promise<Trip> {
  if (deps.useAgent && deps.anthropic) {
    return planWithAgent(request, deps, emit, deps.anthropic, deps.model);
  }
  return planDeterministic(request, deps, emit);
}
