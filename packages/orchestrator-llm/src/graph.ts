import { StateGraph, START, END } from "@langchain/langgraph";
import {
  prepareBookings,
  SearchLimits,
  Tracer,
  type Candidate,
  type PlanResult,
  type SearchProvider,
  type TraceEvent,
  type TravelerProfile,
} from "@wayfare/orchestrator";
import { readConfig, type LlmConfig } from "./config.js";
import { LlmBudget, type UsageSummary } from "./budget.js";
import { ToolLedger, type ToolContext } from "./tools.js";
import type { StructuredModel } from "./model.js";
import { PlanState, type PlanStateType } from "./state.js";
import {
  intakeNode,
  personaNode,
  planQueriesNode,
  searchNode,
  verifyNode,
  matchNode,
  supervisorNode,
  selectNode,
  repriceNode,
  criticNode,
  widenNode,
  shouldRetry,
  type NodeDeps,
} from "./nodes.js";

/**
 * The LangGraph orchestrator.
 *
 *   intake → persona → planQueries → search → verify → match
 *          → supervisor → select → reprice → critic
 *          → critic.passed ? END : widen → back to planQueries
 *
 * The conditional edge back to planQueries is the reason this is a StateGraph: the retry is a
 * genuine cycle over mutating state (`pass`, `breadthMultiplier`), not a linear pipeline.
 */

export interface LlmPlanResult extends PlanResult {
  /** per-agent token/tool accounting for this plan. */
  usage: UsageSummary;
  /** the finalist's justification, from the select agent. */
  rationale: string;
}

export interface LlmOrchestratorDeps {
  providers: SearchProvider[];
  model: StructuredModel;
  config?: LlmConfig;
  onEvent?: (e: TraceEvent) => void;
}

export class LlmOrchestrator {
  private readonly config: LlmConfig;
  private readonly aggregatorIds: Set<string>;
  private readonly searchLimits: SearchLimits<Candidate[]>;

  constructor(private readonly deps: LlmOrchestratorDeps) {
    this.config = deps.config ?? readConfig();
    this.aggregatorIds = new Set(
      deps.providers.filter((p) => p.aggregator).map((p) => p.id),
    );
    // Reuse the fan-out limiter from @wayfare/orchestrator rather than duplicating it, so the
    // LLM path inherits the same per-provider cap, coalescing, and TTL cache.
    this.searchLimits = new SearchLimits<Candidate[]>();
  }

  async plan(prompt: string, profile: TravelerProfile): Promise<LlmPlanResult> {
    const tracer = new Tracer(this.deps.onEvent);
    const budget = new LlmBudget(this.config, tracer);
    const ledger = new ToolLedger(tracer);

    const ctx: ToolContext = {
      providers: this.deps.providers,
      aggregatorIds: this.aggregatorIds,
      limits: this.searchLimits,
      tracer,
      ledger,
    };
    const nodeDeps: NodeDeps = { model: this.deps.model, budget, ctx, tracer };

    tracer.emit("llm", "start", {
      prompt,
      traveler: profile.id,
      agents: [...this.config.agents],
      maxCalls: this.config.maxCalls,
      maxTokens: this.config.maxTokens,
      maxPasses: this.config.maxPasses,
      dryRun: this.config.dryRun,
    });

    const compiled = buildGraph(nodeDeps);
    const final = (await compiled.invoke({
      prompt,
      profile,
      destination: "",
      maxPasses: this.config.maxPasses,
    })) as PlanStateType;

    const bookingIntents = prepareBookings(final.legs, tracer);
    const usage = budget.summary();
    tracer.emit("llm", "done", {
      passes: final.pass,
      calls: usage.calls,
      totalTokens: usage.totalTokens,
      toolCalls: ledger.size,
      capped: usage.capped,
    });

    return {
      request: final.request!,
      persona: final.persona!,
      options: final.rankedByKind,
      selection: selectionOf(final),
      itineraries: final.itineraries,
      ...(final.chosen ? { itinerary: final.chosen } : {}),
      ...(final.confirmation ? { confirmation: final.confirmation } : {}),
      supervisor: final.supervisorStats ?? {
        windows: 0,
        expanded: 0,
        prunedOnBudget: 0,
        kept: 0,
      },
      budget: final.budget!,
      bookingIntents,
      critic: final.critic!,
      passes: final.pass,
      trace: tracer.drain(),
      usage,
      rationale: final.chosenRationale,
    };
  }
}

function selectionOf(s: PlanStateType): PlanResult["selection"] {
  const sel: PlanResult["selection"] = {};
  for (const leg of s.legs) {
    if (sel[leg.kind]) continue;
    const found = (s.rankedByKind[leg.kind] ?? []).find(
      (r) => r.option.entity.key === leg.option.entity.key,
    );
    sel[leg.kind] = found ?? {
      option: leg.option,
      score: 0,
      breakdown: { price: 0, quality: 0, location: 0, vibe: 0, verification: 0 },
    };
  }
  return sel;
}

/**
 * Assemble the StateGraph. Exported so tests can drive it directly.
 *
 * Nodes carry an `Agent` suffix because LangGraph forbids a node name from colliding with a
 * state channel — `persona` and `critic` are both channels here.
 */
export function buildGraph(deps: NodeDeps) {
  return new StateGraph(PlanState)
    .addNode("intakeAgent", intakeNode(deps))
    .addNode("personaAgent", personaNode(deps))
    .addNode("planQueriesAgent", planQueriesNode(deps))
    .addNode("searchAgent", searchNode(deps))
    .addNode("verifyAgent", verifyNode(deps))
    .addNode("matchAgent", matchNode(deps))
    .addNode("supervisorAgent", supervisorNode(deps))
    .addNode("selectAgent", selectNode(deps))
    .addNode("repriceAgent", repriceNode(deps))
    .addNode("criticAgent", criticNode(deps))
    .addNode("widenStep", widenNode(deps))
    .addEdge(START, "intakeAgent")
    .addEdge("intakeAgent", "personaAgent")
    .addEdge("personaAgent", "planQueriesAgent")
    .addEdge("planQueriesAgent", "searchAgent")
    .addEdge("searchAgent", "verifyAgent")
    .addEdge("verifyAgent", "matchAgent")
    .addEdge("matchAgent", "supervisorAgent")
    .addEdge("supervisorAgent", "selectAgent")
    .addEdge("selectAgent", "repriceAgent")
    .addEdge("repriceAgent", "criticAgent")
    // the cycle: fail → widen → re-plan queries; pass (or out of passes) → END
    .addConditionalEdges("criticAgent", shouldRetry, { retry: "widenStep", done: END })
    .addEdge("widenStep", "planQueriesAgent")
    .compile();
}
