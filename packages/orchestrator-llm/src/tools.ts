import { z } from "zod";
import type { TripRequest } from "@wayfare/shared";
import {
  runSearch,
  verify,
  rankByKind,
  buildBudget,
  composeItineraries,
  computeItineraryTotal,
  itineraryLegs,
  repriceItinerary,
  SearchQuerySchema,
  type Candidate,
  type ItineraryCombination,
  type ItineraryConfirmation,
  type ItineraryLeg,
  type Persona,
  type RankedOption,
  type SearchLimits,
  type SearchProvider,
  type SearchQuery,
  type SupervisorStats,
  type Tracer,
  type VerifiedOption,
} from "@wayfare/orchestrator";
import type { Budget } from "@wayfare/shared";

/**
 * The tool layer — and the whole point of this package.
 *
 *   The agent decides. The tool computes.
 *
 * A model must never do arithmetic, ranking, or combinatorial enumeration in its own head. It
 * will eventually get it wrong, silently, and this product's entire claim is price honesty. So
 * every number that reaches a PlanResult is produced here, by a thin wrapper around a function
 * already exported from @wayfare/orchestrator — none of that logic is reimplemented.
 *
 * Each call is recorded on a ToolLedger, which is what lets the tool-boundary test assert that
 * no figure in the output was invented by a model.
 */

/** One recorded tool invocation — the audit trail behind every number in the plan. */
export interface ToolCallRecord {
  tool: string;
  agent: string;
  at: string;
}

export class ToolLedger {
  readonly #records: ToolCallRecord[] = [];

  constructor(private readonly tracer?: Tracer) {}

  record(tool: string, agent: string): void {
    const entry: ToolCallRecord = { tool, agent, at: new Date().toISOString() };
    this.#records.push(entry);
    this.tracer?.emit("tool", tool, { agent });
  }

  all(): ToolCallRecord[] {
    return [...this.#records];
  }

  countFor(tool: string): number {
    return this.#records.filter((r) => r.tool === tool).length;
  }

  get size(): number {
    return this.#records.length;
  }
}

/** Shared context every tool closes over. */
export interface ToolContext {
  providers: SearchProvider[];
  aggregatorIds: Set<string>;
  limits: SearchLimits<Candidate[]>;
  tracer: Tracer;
  ledger: ToolLedger;
}

/* -------------------------------------------------------------------------- */
/* Tool input schemas — what the agent is allowed to decide                    */
/* -------------------------------------------------------------------------- */

export const BuildQueryInputSchema = z
  .object({ queries: z.array(SearchQuerySchema) })
  .strict();

export const RunSearchInputSchema = z
  .object({ queries: z.array(SearchQuerySchema) })
  .strict();

export const ComputeTotalInputSchema = z
  .object({
    flightUnit: z.number().optional(),
    stayUnit: z.number().optional(),
    activityUnits: z.array(z.number()),
    nights: z.number(),
    travelers: z.number(),
    priceFactor: z.number(),
  })
  .strict();

/* -------------------------------------------------------------------------- */
/* The tools                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `build_query` — validates the agent's proposed queries against the real SearchQuerySchema.
 * The agent chooses what to shop for; the schema decides whether that is expressible.
 */
export function buildQueryTool(ctx: ToolContext, agent: string) {
  return (input: unknown): SearchQuery[] => {
    ctx.ledger.record("build_query", agent);
    return BuildQueryInputSchema.parse(input).queries;
  };
}

/** `run_search` — wraps runSearch(), threading the shared SearchLimits so the LLM path gets the
 * same per-provider concurrency cap, coalescing, and TTL cache as the deterministic one. */
export function runSearchTool(ctx: ToolContext, agent: string) {
  return async (queries: SearchQuery[]): Promise<Candidate[]> => {
    ctx.ledger.record("run_search", agent);
    return runSearch(ctx.providers, queries, ctx.tracer, ctx.limits);
  };
}

/** `cross_check` — wraps verify(); returns verdicts, flags, spreads, direct-deal findings. */
export function crossCheckTool(ctx: ToolContext, agent: string) {
  return (candidates: Candidate[]): VerifiedOption[] => {
    ctx.ledger.record("cross_check", agent);
    return verify(candidates, ctx.aggregatorIds, ctx.tracer);
  };
}

/** `score_options` — wraps rankByKind(). All ranking arithmetic happens here, not in a prompt. */
export function scoreOptionsTool(ctx: ToolContext, agent: string) {
  return (
    optionsByKind: Record<string, VerifiedOption[]>,
    persona: Persona,
  ): Record<string, RankedOption[]> => {
    ctx.ledger.record("score_options", agent);
    return rankByKind(optionsByKind, persona);
  };
}

/** `compute_budget` — wraps buildBudget(). The ONLY way to total costs. */
export function computeBudgetTool(ctx: ToolContext, agent: string) {
  return (legs: ItineraryLeg[], request: TripRequest): Budget => {
    ctx.ledger.record("compute_budget", agent);
    return buildBudget(legs, request, ctx.tracer);
  };
}

/** `enumerate_itineraries` — wraps composeItineraries(); the branch-and-bound fan-out. */
export function enumerateItinerariesTool(ctx: ToolContext, agent: string) {
  return (
    rankedByKind: Record<string, RankedOption[]>,
    persona: Persona,
    request: TripRequest,
  ): { itineraries: ItineraryCombination[]; stats: SupervisorStats } => {
    ctx.ledger.record("enumerate_itineraries", agent);
    return composeItineraries({ rankedByKind, persona, request, tracer: ctx.tracer });
  };
}

/** `compute_total` — wraps computeItineraryTotal(); the single whole-trip cost formula. */
export function computeTotalTool(ctx: ToolContext, agent: string) {
  return (input: unknown): number => {
    ctx.ledger.record("compute_total", agent);
    return computeItineraryTotal(ComputeTotalInputSchema.parse(input));
  };
}

/** `fetch_current_price` — wraps repriceItinerary(); the at-source re-check before surfacing. */
export function fetchCurrentPriceTool(ctx: ToolContext, agent: string) {
  return async (args: {
    combo: ItineraryCombination;
    destination: string;
    nights: number;
    travelers: number;
  }): Promise<ItineraryConfirmation> => {
    ctx.ledger.record("fetch_current_price", agent);
    return repriceItinerary({
      combo: args.combo,
      providers: ctx.providers,
      destination: args.destination,
      nights: args.nights,
      travelers: args.travelers,
      now: new Date().toISOString(),
      tracer: ctx.tracer,
      limits: ctx.limits,
    });
  };
}

/** `itinerary_legs` — wraps itineraryLegs(); structural, but keeps leg derivation off the model. */
export function itineraryLegsTool(ctx: ToolContext, agent: string) {
  return (combo: ItineraryCombination): ItineraryLeg[] => {
    ctx.ledger.record("itinerary_legs", agent);
    return itineraryLegs(combo);
  };
}

/** Every tool name, for the dry-run transcript and the tool-boundary test. */
export const TOOL_NAMES = [
  "build_query",
  "run_search",
  "cross_check",
  "score_options",
  "compute_budget",
  "enumerate_itineraries",
  "compute_total",
  "fetch_current_price",
  "itinerary_legs",
] as const;
