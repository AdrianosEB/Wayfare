import { z } from "zod";
import { TripRequestSchema } from "@wayfare/shared";
import {
  intake as deterministicIntake,
  derivePersona,
  planQueries as deterministicPlanQueries,
  selectLeads,
  review,
  PersonaSchema,
  SearchQuerySchema,
  VerifiedOptionSchema,
  RankedOptionSchema,
  ItineraryCombinationSchema,
  ItineraryConfirmationSchema,
  CriticReportSchema,
  type ItineraryLeg,
  type RankedOption,
  type Tracer,
} from "@wayfare/orchestrator";
import type { AgentName } from "./config.js";
import type { LlmBudget } from "./budget.js";
import { DryRunSkip, type StructuredModel } from "./model.js";
import { SYSTEM_PROMPTS } from "./prompts.js";
import * as T from "./tools.js";
import type { ToolContext } from "./tools.js";
import type { PlanStateType, PlanStateUpdate } from "./state.js";

/**
 * The ten agent nodes.
 *
 * Every node has the same shape, and it is the shape that makes this safe:
 *
 *   1. ask the model for a *decision* (structured output, validated against the shared schema)
 *   2. run the deterministic tool to produce the *numbers*
 *   3. merge — judgment shapes the inputs and the choice; the tool supplies every figure
 *
 * If the agent is not in the allowlist, a ceiling is spent, dry-run is on, or the model errors,
 * step 1 is skipped and the deterministic implementation from @wayfare/orchestrator supplies the
 * decision too. The plan always lands.
 */

export interface NodeDeps {
  model: StructuredModel;
  budget: LlmBudget;
  ctx: ToolContext;
  tracer: Tracer;
}

/**
 * Run one agent's model call under the budget, falling back to `fallback` on any of: not
 * allowlisted, ceiling spent, dry-run, or a model/validation error. Records usage either way.
 *
 * A SchemaValidationError is deliberately re-thrown rather than swallowed — an off-schema
 * response is a real failure the caller must see, not something to silently paper over.
 */
async function decide<T>(
  deps: NodeDeps,
  agent: AgentName,
  // Input left unconstrained: shared schemas using `.default([])` have distinct input/output
  // types, and `ZodType<T>` would bind T to the input (pre-default) shape.
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  user: string,
  fallback: () => T,
  wire?: { wireSchema: z.ZodType<unknown, z.ZodTypeDef, unknown>; repair: (raw: unknown) => unknown },
): Promise<T> {
  const started = Date.now();
  if (!deps.budget.allows(agent)) {
    const value = fallback();
    deps.budget.record({
      agent,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: 0,
      ms: Date.now() - started,
      llm: false,
    });
    return value;
  }

  try {
    const out = await deps.model.invoke({
      agent,
      system: SYSTEM_PROMPTS[agent],
      user,
      schema,
      ...(wire ?? {}),
    });
    deps.budget.record({
      agent,
      inputTokens: out.inputTokens,
      outputTokens: out.outputTokens,
      toolCalls: 0,
      ms: Date.now() - started,
      llm: true,
    });
    return out.value;
  } catch (err) {
    if (err instanceof DryRunSkip) {
      const value = fallback();
      deps.budget.record({
        agent,
        inputTokens: 0,
        outputTokens: 0,
        toolCalls: 0,
        ms: Date.now() - started,
        llm: false,
      });
      return value;
    }
    if (err instanceof Error && err.name === "SchemaValidationError") throw err;
    deps.tracer.emit("llm", "agent_error", { agent, error: String(err) });
    const value = fallback();
    deps.budget.record({
      agent,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: 0,
      ms: Date.now() - started,
      llm: false,
    });
    return value;
  }
}

const brief = (v: unknown, max = 1800): string => {
  const s = JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max)}…(truncated)` : s;
};

/* -------------------------------------------------------------------------- */
/* 1. intake                                                                   */
/* -------------------------------------------------------------------------- */

export function intakeNode(deps: NodeDeps) {
  return async (s: PlanStateType): Promise<PlanStateUpdate> => {
    const det = deterministicIntake(s.prompt, s.profile, deps.tracer);
    const request = await decide(
      deps,
      "intake",
      TripRequestSchema,
      `Sentence: ${s.prompt}\nTraveler profile: ${brief(s.profile)}`,
      () => det.request,
    );
    const destination = request.destination?.value ?? det.destination;
    return { request, destination };
  };
}

/* -------------------------------------------------------------------------- */
/* 2. persona                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Models put `reasoning` inside `preferences` on 13–19% of persona calls, across three prompt
 * revisions that told them not to in increasingly explicit terms. That one misplacement fails
 * the strict parse three ways at once: `reasoning` missing at the top level, an unrecognised key
 * in a `.strict()` `preferences`, and `preferences`' own required fields displaced.
 *
 * So the model is handed a schema lenient enough to accept the misplacement, and the shape is
 * repaired here before the STRICT `PersonaSchema` validates it. The strict schema is still the
 * contract — nothing downstream sees an unrepaired object — but a recoverable formatting slip
 * no longer costs an eighth of a paid teacher pass.
 *
 * Repaired rows are counted, not hidden: the hoist rate is a reported number (see
 * training/RESULTS.md). If it climbs, the prompt or the schema is drifting and that is worth
 * knowing rather than silently absorbing.
 */
export const PersonaWireSchema = PersonaSchema.extend({
  reasoning: z.array(z.string()).optional(),
  preferences: PersonaSchema.shape.preferences.partial().passthrough(),
});

let personaHoists = 0;
/** How many persona objects needed the `preferences.reasoning` hoist this process. */
export const personaHoistCount = (): number => personaHoists;

export function repairPersonaShape(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const o = raw as Record<string, unknown>;
  const prefs = o.preferences as Record<string, unknown> | undefined;
  if (!prefs || typeof prefs !== "object") return raw;

  // Only hoist keys that belong at the top level and are missing there — never overwrite a
  // value the model put in the right place.
  const misplaced = ["reasoning", "weights", "summary"] as const;
  const moved: Record<string, unknown> = {};
  for (const k of misplaced) {
    if (k in prefs && o[k] === undefined) moved[k] = prefs[k];
  }
  if (!Object.keys(moved).length) return raw;

  personaHoists++;
  const cleanedPrefs = { ...prefs };
  for (const k of Object.keys(moved)) delete cleanedPrefs[k];
  return { ...o, ...moved, preferences: cleanedPrefs };
}

export function personaNode(deps: NodeDeps) {
  return async (s: PlanStateType): Promise<PlanStateUpdate> => {
    const request = s.request!;
    const persona = await decide(
      deps,
      "persona",
      PersonaSchema,
      `Signals: ${brief(s.profile.signals)}\nTrip vibe: ${brief(request.vibe?.value ?? [])}\n` +
        `Budget: ${brief(request.budget?.value)}`,
      () => derivePersona(s.profile, request, deps.tracer),
      { wireSchema: PersonaWireSchema, repair: repairPersonaShape },
    );
    return { persona };
  };
}

/* -------------------------------------------------------------------------- */
/* 3. planQueries — build_query                                                */
/* -------------------------------------------------------------------------- */

export function planQueriesNode(deps: NodeDeps) {
  return async (s: PlanStateType): Promise<PlanStateUpdate> => {
    const request = s.request!;
    const persona = s.persona!;
    const fallback = () =>
      deterministicPlanQueries(request, persona, {
        destination: s.destination,
        breadthMultiplier: s.breadthMultiplier,
      });

    const proposed = await decide(
      deps,
      "planQueries",
      z.array(SearchQuerySchema),
      `Destination: ${s.destination}\nRequest: ${brief(request)}\n` +
        `Pass ${s.pass} of ${s.maxPasses}; breadth multiplier ${s.breadthMultiplier}` +
        (s.pass > 1 ? `\nLast pass failed with: ${brief(s.critic?.issues ?? [])}` : ""),
      fallback,
    );

    // the tool validates the agent's proposal against the real schema
    const queries = T.buildQueryTool(deps.ctx, "planQueries")({ queries: proposed });
    return { queries: queries.length ? queries : fallback() };
  };
}

/* -------------------------------------------------------------------------- */
/* 4. search — run_search                                                      */
/* -------------------------------------------------------------------------- */

export function searchNode(deps: NodeDeps) {
  return async (s: PlanStateType): Promise<PlanStateUpdate> => {
    // The agent decides which queries are worth running; the tool runs them under the shared
    // SearchLimits (per-provider cap, coalescing, TTL cache).
    const chosen = await decide(
      deps,
      "search",
      z.array(SearchQuerySchema),
      `Proposed queries: ${brief(s.queries)}`,
      () => s.queries,
    );
    const toRun = chosen.length ? chosen : s.queries;
    const candidates = await T.runSearchTool(deps.ctx, "search")(toRun);
    return { candidates };
  };
}

/* -------------------------------------------------------------------------- */
/* 5. verify — cross_check                                                     */
/* -------------------------------------------------------------------------- */

export function verifyNode(deps: NodeDeps) {
  return async (s: PlanStateType): Promise<PlanStateUpdate> => {
    // Tool first here: the cross-check IS the computation, and the agent interprets its output.
    const crossChecked = T.crossCheckTool(deps.ctx, "verify")(s.candidates);
    const verified = await decide(
      deps,
      "verify",
      z.array(VerifiedOptionSchema),
      `Cross-check results (verdicts, spreads, flags, direct deals): ${brief(crossChecked, 3000)}`,
      () => crossChecked,
    );
    return { verified: verified.length ? verified : crossChecked };
  };
}

/* -------------------------------------------------------------------------- */
/* 6. match — score_options + compute_budget                                   */
/* -------------------------------------------------------------------------- */

function groupByKind(options: PlanStateType["verified"]): Record<string, typeof options> {
  const out: Record<string, typeof options> = {};
  for (const o of options) (out[o.entity.kind] ??= []).push(o);
  return out;
}

export function matchNode(deps: NodeDeps) {
  return async (s: PlanStateType): Promise<PlanStateUpdate> => {
    const persona = s.persona!;
    const byKind = groupByKind(s.verified);
    const scored = T.scoreOptionsTool(deps.ctx, "match")(byKind, persona);

    const rankedByKind = await decide(
      deps,
      "match",
      z.record(z.array(RankedOptionSchema)),
      `Persona weights: ${brief(persona.weights)}\nScored options: ${brief(scored, 3000)}`,
      () => scored,
    );
    return { rankedByKind: Object.keys(rankedByKind).length ? rankedByKind : scored };
  };
}

/* -------------------------------------------------------------------------- */
/* 7. supervisor — enumerate_itineraries + compute_total                       */
/* -------------------------------------------------------------------------- */

export function supervisorNode(deps: NodeDeps) {
  return async (s: PlanStateType): Promise<PlanStateUpdate> => {
    const request = s.request!;
    const persona = s.persona!;
    const composed = T.enumerateItinerariesTool(deps.ctx, "supervisor")(
      s.rankedByKind,
      persona,
      request,
    );

    const itineraries = await decide(
      deps,
      "supervisor",
      z.array(ItineraryCombinationSchema),
      `Enumerated ${composed.itineraries.length} itineraries after pruning ` +
        `${composed.stats.prunedOnBudget} on budget: ${brief(composed.itineraries, 3000)}`,
      () => composed.itineraries,
    );

    return {
      itineraries: itineraries.length ? itineraries : composed.itineraries,
      supervisorStats: composed.stats,
    };
  };
}

/* -------------------------------------------------------------------------- */
/* 8. select — reasons over the supervisor's tool output                       */
/* -------------------------------------------------------------------------- */

export const SelectionSchema = z
  .object({ chosenIndex: z.number().int().min(0), rationale: z.string() })
  .strict();

export function selectNode(deps: NodeDeps) {
  return async (s: PlanStateType): Promise<PlanStateUpdate> => {
    if (!s.itineraries.length) return { chosen: undefined, legs: [] };

    // deterministic fallback: affordable first, else best-scoring (the list is pre-sorted).
    const fallbackIndex = Math.max(
      0,
      s.itineraries.findIndex((i) => i.withinBudget),
    );

    const picked = await decide(
      deps,
      "select",
      SelectionSchema,
      `Choose one finalist. Itineraries (already priced by tool): ${brief(s.itineraries, 3000)}`,
      () => ({
        chosenIndex: fallbackIndex,
        rationale: "Cheapest itinerary that lands within the stated budget.",
      }),
    );

    const index = picked.chosenIndex < s.itineraries.length ? picked.chosenIndex : fallbackIndex;
    const chosen = s.itineraries[index];
    if (!chosen) return { chosen: undefined, legs: [] };

    const legs: ItineraryLeg[] = T.itineraryLegsTool(deps.ctx, "select")(chosen);
    const budget = T.computeBudgetTool(deps.ctx, "select")(legs, s.request!);
    return { chosen, legs, budget, chosenRationale: picked.rationale };
  };
}

/* -------------------------------------------------------------------------- */
/* 9. reprice — fetch_current_price                                            */
/* -------------------------------------------------------------------------- */

export function repriceNode(deps: NodeDeps) {
  return async (s: PlanStateType): Promise<PlanStateUpdate> => {
    if (!s.chosen) return {};
    const request = s.request!;
    const nights = request.durationDays?.value ?? 5;
    const party = request.partySize?.value;
    const travelers = (party?.adults ?? 1) + (party?.children ?? 0);

    const checked = await T.fetchCurrentPriceTool(deps.ctx, "reprice")({
      combo: s.chosen,
      destination: s.destination,
      nights,
      travelers,
    });

    const confirmation = await decide(
      deps,
      "reprice",
      ItineraryConfirmationSchema,
      `At-source re-price result: ${brief(checked, 2500)}`,
      () => checked,
    );
    return { confirmation };
  };
}

/* -------------------------------------------------------------------------- */
/* 10. critic — compute_budget                                                 */
/* -------------------------------------------------------------------------- */

function selectionForCritic(
  legs: ItineraryLeg[],
  rankedByKind: Record<string, RankedOption[]>,
): Record<string, RankedOption> {
  const sel: Record<string, RankedOption> = {};
  for (const leg of legs) {
    if (sel[leg.kind]) continue;
    const found = (rankedByKind[leg.kind] ?? []).find(
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

export function criticNode(deps: NodeDeps) {
  return async (s: PlanStateType): Promise<PlanStateUpdate> => {
    const request = s.request!;
    // re-check the total against the target through the tool, never by eye
    const budget = s.legs.length
      ? T.computeBudgetTool(deps.ctx, "critic")(s.legs, request)
      : s.budget;
    const selection = s.legs.length
      ? selectionForCritic(s.legs, s.rankedByKind)
      : selectLeads(s.rankedByKind);

    const deterministicReport = review(
      {
        selection,
        budget: budget!,
        request,
        profile: s.profile,
        expectedKinds: ["stay", "flight", "activity"],
      },
      deps.tracer,
    );

    const critic = await decide(
      deps,
      "critic",
      CriticReportSchema,
      `Budget: ${brief(budget)}\nSelection: ${brief(selection, 2000)}\n` +
        `Confirmation: ${brief(s.confirmation)}\nDeterministic findings: ${brief(deterministicReport)}`,
      () => deterministicReport,
    );

    return { critic, ...(budget ? { budget } : {}) };
  };
}

/* -------------------------------------------------------------------------- */
/* the conditional edge — the cycle                                            */
/* -------------------------------------------------------------------------- */

/**
 * The graph's one cycle. On a critic failure with passes remaining we widen and go back to
 * planQueries; everything downstream recomputes against the wider market. This is the whole
 * reason for a StateGraph over a chain.
 */
export function shouldRetry(s: PlanStateType): "retry" | "done" {
  if (s.critic?.passed) return "done";
  if (s.pass >= s.maxPasses) return "done";
  return "retry";
}

export function widenNode(deps: NodeDeps) {
  return async (s: PlanStateType): Promise<PlanStateUpdate> => {
    const remedies = new Set((s.critic?.issues ?? []).map((i) => i.remedy).filter(Boolean));
    const next = s.breadthMultiplier + (remedies.has("broaden_search") ? 0.6 : 0.3);
    deps.tracer.emit("llm", "retry", {
      pass: s.pass,
      nextPass: s.pass + 1,
      breadthMultiplier: next,
      remedies: [...remedies],
    });
    return { pass: s.pass + 1, breadthMultiplier: next };
  };
}
