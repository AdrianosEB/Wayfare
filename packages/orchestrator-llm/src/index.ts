/**
 * @wayfare/orchestrator-llm — the same nine-agent pipeline as @wayfare/orchestrator, but every
 * agent is a real LLM agent wired as a LangGraph state graph.
 *
 * Parallel implementation, not a replacement. @wayfare/orchestrator stays the default and the
 * fail-safe: with WAYFARE_LLM_ORCHESTRATOR unset, `createOrchestrator` hands back the
 * deterministic Orchestrator and loading the site costs nothing.
 *
 * The design principle throughout: the agent decides, the tool computes. Every number in a
 * PlanResult comes from a tool wrapping a function already exported by @wayfare/orchestrator —
 * no logic is reimplemented here and no model does arithmetic.
 */
export { createOrchestrator } from "./factory.js";
export type { Planner, CreateOrchestratorOptions } from "./factory.js";

export { LlmOrchestrator, buildGraph } from "./graph.js";
export type { LlmPlanResult, LlmOrchestratorDeps } from "./graph.js";

export { readConfig, parseAgents, AGENT_NAMES } from "./config.js";
export type { LlmConfig, AgentName } from "./config.js";

export { LlmBudget } from "./budget.js";
export type { AgentUsage, UsageSummary } from "./budget.js";

export {
  AnthropicStructuredModel,
  DryRunModel,
  DryRunSkip,
  SchemaValidationError,
} from "./model.js";
export type { StructuredModel, StructuredCall, StructuredResult, TranscriptEntry } from "./model.js";

export { SYSTEM_PROMPTS, AGENT_TOOLS } from "./prompts.js";
export { ToolLedger, TOOL_NAMES } from "./tools.js";
export type { ToolContext, ToolCallRecord } from "./tools.js";

export { PlanState } from "./state.js";
export type { PlanStateType } from "./state.js";

export { SelectionSchema } from "./nodes.js";
