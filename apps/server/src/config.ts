/**
 * Server configuration, read from the environment. ANTHROPIC_API_KEY is the only secret and is
 * optional: without it the deterministic planner runs. Keys stay server-side (NFR-4).
 */

export type PlannerMode = "auto" | "deterministic" | "agent";

export interface Config {
  port: number;
  anthropicApiKey: string | undefined;
  anthropicModel: string;
  plannerMode: PlannerMode;
  /** fixed wall clock for deterministic `fetchedAt`/`createdAt` timestamps (NFR-6). */
  now: string;
}

function readPlannerMode(raw: string | undefined): PlannerMode {
  if (raw === "deterministic" || raw === "agent" || raw === "auto") return raw;
  return "auto";
}

export const config: Config = {
  port: Number(process.env.PORT ?? 3000),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
  plannerMode: readPlannerMode(process.env.PLANNER_MODE),
  now: process.env.WAYFARE_NOW ?? "2026-06-16T10:00:00Z",
};

/** Whether the Anthropic agent should drive planning. `auto` means agent iff a key is present. */
export function useAgent(cfg: Config = config): boolean {
  if (cfg.plannerMode === "deterministic") return false;
  if (cfg.plannerMode === "agent") return true;
  return Boolean(cfg.anthropicApiKey);
}
