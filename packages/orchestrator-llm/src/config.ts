/**
 * Every setting is an env var and every default is the cheap one. `WAYFARE_LLM_ORCHESTRATOR`
 * must be the literal string "true"; absent, empty, or malformed means disabled. It is not
 * inferred from an API key being present, because that key is for the existing planner.
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
  /** master switch: WAYFARE_LLM_ORCHESTRATOR === "true". */
  enabled: boolean;
  /** which agents actually call a model; the rest fall back to @wayfare/orchestrator. */
  agents: Set<AgentName>;
  /** hard ceiling on model calls per plan. */
  maxCalls: number;
  /** hard ceiling on total tokens per plan. */
  maxTokens: number;
  /** build + log prompts without calling the API. */
  dryRun: boolean;
  /** LLM path retries less than the deterministic one, since each pass is ~10 calls. */
  maxPasses: number;
  model: string;
  /**
   * Base URL of an OpenAI-compatible server to use instead of Anthropic. Point it at the
   * `mlx_lm.server` serving `training/fused` and the persona agent runs on the locally distilled
   * student, with no API key. When absent, Anthropic is used.
   */
  localBaseUrl: string | undefined;
  /** Model name to send to that server. `mlx_lm.server` accepts the served path. */
  localModel: string;
}

const TRUE = (v: string | undefined): boolean => v === "true";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Parses the agent allowlist. Unset or empty means all ten. Unknown names are ignored, so a typo
 * leaves that agent deterministic instead of breaking a plan.
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
    localBaseUrl: env.WAYFARE_LOCAL_MODEL_URL?.trim() || undefined,
    localModel: env.WAYFARE_LOCAL_MODEL ?? "local-student",
  };
}
