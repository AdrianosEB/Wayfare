import {
  Orchestrator,
  type PlanResult,
  type SearchProvider,
  type TraceEvent,
  type TravelerProfile,
} from "@wayfare/orchestrator";
import { readConfig, type LlmConfig } from "./config.js";
import {
  AnthropicStructuredModel,
  DryRunModel,
  LocalStructuredModel,
  type StructuredModel,
} from "./model.js";
import { AGENT_TOOLS } from "./prompts.js";
import { LlmOrchestrator } from "./graph.js";

/**
 * The interface both orchestrators satisfy. Declared here and not in @wayfare/shared because it
 * needs `PlanResult` and `TravelerProfile` from @wayfare/orchestrator, which @wayfare/shared
 * must not depend on.
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
 * Returns the LangGraph orchestrator when the flag is on and a key is present (or a model is
 * injected, or dry-run is on). Otherwise returns the deterministic Orchestrator, which spends no
 * tokens.
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
    // flag on but nothing to talk to: degrade, don't throw
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
  // A local OpenAI-compatible server wins over Anthropic and needs no key. The distilled student
  // in `training/fused` is served this way.
  if (config.localBaseUrl) return new LocalStructuredModel(config, config.localBaseUrl);
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return undefined;
  return new AnthropicStructuredModel(config, key);
}
