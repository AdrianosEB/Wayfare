/**
 * @wayfare/orchestrator-llm: the same ten-agent pipeline as @wayfare/orchestrator, with every
 * agent an LLM agent wired as a LangGraph state graph.
 *
 * This runs alongside @wayfare/orchestrator, which stays the default. With
 * WAYFARE_LLM_ORCHESTRATOR unset, `createOrchestrator` returns the deterministic Orchestrator.
 *
 * The agent decides, the tool computes: every number in a PlanResult comes from a tool wrapping
 * a function exported by @wayfare/orchestrator.
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
  LocalStructuredModel,
  SchemaValidationError,
  extractJsonObject,
} from "./model.js";
export type { StructuredModel, StructuredCall, StructuredResult, TranscriptEntry } from "./model.js";

export { SYSTEM_PROMPTS, AGENT_TOOLS } from "./prompts.js";
export { ToolLedger, TOOL_NAMES } from "./tools.js";
export type { ToolContext, ToolCallRecord } from "./tools.js";

export { PlanState } from "./state.js";
export type { PlanStateType } from "./state.js";

export { SelectionSchema } from "./nodes.js";
