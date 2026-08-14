import {
  Orchestrator,
  type PlanResult,
  type SearchProvider,
  type TraceEvent,
  type TravelerProfile,
} from "@wayfare/orchestrator";
import { readConfig, type LlmConfig } from "./config.js";
import { AnthropicStructuredModel, DryRunModel, type StructuredModel } from "./model.js";
import { AGENT_TOOLS } from "./prompts.js";
import { LlmOrchestrator } from "./graph.js";

/**
 * `Planner` — the interface both orchestrators satisfy.
 *
 * Deliberately declared here rather than in @wayfare/shared: its signature needs `PlanResult`
 * and `TravelerProfile`, which live in @wayfare/orchestrator, and @wayfare/shared does not (and
 * should not) depend on @wayfare/orchestrator — that would invert the package graph. This
 * package already depends on both, so it is the correct home.
 */
export interface Planner {
  plan(prompt: string, profile: TravelerProfile): Promise<PlanResult>;
}

export interface CreateOrchestratorOptions {
  config?: LlmConfig;
  onEvent?: (e: TraceEvent) => void;
  /** injected in tests; when absent a real ChatAnthropic model is built from the env. */
  model?: StructuredModel;
  env?: NodeJS.ProcessEnv;
}

/**
 * Returns the LangGraph orchestrator when the flag is on **and** a key is present (or a model is
 * injected, or dry-run is on); otherwise the existing deterministic Orchestrator.
 *
 * The default is always the free path. With `WAYFARE_LLM_ORCHESTRATOR` unset, behaviour is
 * indistinguishable from today and not a single token is spent.
 */
export function createOrchestrator(
  providers: SearchProvider[],
  opts: CreateOrchestratorOptions = {},
): Planner {
  const env = opts.env ?? process.env;
  const config = opts.config ?? readConfig(env);

  if (!config.enabled) {
    return new Orchestrator(providers, opts.onEvent ? { onEvent: opts.onEvent } : {});
  }

  const model = opts.model ?? buildModel(config, env);
  if (!model) {
    // flag on but nothing to talk to — degrade rather than throw
    return new Orchestrator(providers, opts.onEvent ? { onEvent: opts.onEvent } : {});
  }

  return new LlmOrchestrator({
    providers,
    model,
    config,
    ...(opts.onEvent ? { onEvent: opts.onEvent } : {}),
  });
}

function buildModel(config: LlmConfig, env: NodeJS.ProcessEnv): StructuredModel | undefined {
  if (config.dryRun) return new DryRunModel(AGENT_TOOLS);
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return undefined;
  return new AnthropicStructuredModel(config, key);
}
