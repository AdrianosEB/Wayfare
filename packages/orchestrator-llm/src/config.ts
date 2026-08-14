/**
 * Configuration — every knob is an env var, and every default is the cheap one.
 *
 * The governing rule: this orchestrator costs tokens, so it is off unless someone explicitly
 * turned it on. `WAYFARE_LLM_ORCHESTRATOR` must be the literal string "true"; absent, empty, or
 * malformed is disabled. It is deliberately NOT inferred from an API key being present — a key
 * on disk is for the existing planner and must never silently opt you into nine agents.
 */

/** The ten graph nodes, in execution order. `select` is split out of `supervisor`. */
export const AGENT_NAMES = [
  "intake",
  "persona",
  "planQueries",
  "search",
  "verify",
  "match",
  "supervisor",
  "select",
  "reprice",
  "critic",
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

export interface LlmConfig {
  /** master switch — WAYFARE_LLM_ORCHESTRATOR === "true". */
  enabled: boolean;
  /** which agents actually call a model; the rest fall back to @wayfare/orchestrator. */
  agents: Set<AgentName>;
  /** hard ceiling on model calls per plan. */
  maxCalls: number;
  /** hard ceiling on total tokens per plan. */
  maxTokens: number;
  /** build + log prompts without calling the API. */
  dryRun: boolean;
  /** LLM path retries less than the deterministic one — each pass is ~10 calls. */
  maxPasses: number;
  model: string;
}

const TRUE = (v: string | undefined): boolean => v === "true";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Parse the agent allowlist. Unset or empty → all ten. Unknown names are ignored rather than
 * throwing, so a typo degrades to "that agent stays deterministic" instead of breaking a plan.
 */
export function parseAgents(raw: string | undefined): Set<AgentName> {
  if (raw == null || raw.trim() === "") return new Set(AGENT_NAMES);
  const wanted = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const known = new Set<AgentName>();
  for (const w of wanted) {
    const hit = AGENT_NAMES.find((a) => a === w);
    if (hit) known.add(hit);
  }
  return known;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  return {
    enabled: TRUE(env.WAYFARE_LLM_ORCHESTRATOR),
    agents: parseAgents(env.WAYFARE_LLM_AGENTS),
    maxCalls: parsePositiveInt(env.WAYFARE_LLM_MAX_CALLS, 30),
    maxTokens: parsePositiveInt(env.WAYFARE_LLM_MAX_TOKENS, 120_000),
    dryRun: TRUE(env.WAYFARE_LLM_DRY_RUN),
    maxPasses: parsePositiveInt(env.WAYFARE_LLM_MAX_PASSES, 2),
    model: env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
  };
}
