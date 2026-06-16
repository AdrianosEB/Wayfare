import Anthropic from "@anthropic-ai/sdk";
import type {
  Activity,
  Flight,
  Listing,
  Stay,
  Trip,
  TripRequest,
} from "@wayfare/shared";
import { makeId } from "../ids.js";
import { tierOf } from "../integrations/costIndex.js";
import { MockProvider } from "../integrations/mockProvider.js";
import { Toolbox, ANTHROPIC_TOOLS } from "./tools.js";
import { buildPlanContext } from "./resolve.js";
import { assembleDays, selectActivities } from "./assemble.js";
import { planDeterministic, type PlanDeps, type PlanEmitter } from "./planner.js";
import { SYSTEM_PROMPT } from "./prompts.js";

/**
 * The Anthropic tool-use loop (AGENT_DESIGN.md). The MODEL orchestrates — it resolves the
 * destination, calls the four read/compute tools, and chooses the combination via `present_plan`
 * — while deterministic CODE does the math and final assembly (compute_budget is the only
 * summer; structure is schema-valid by construction). Bounded turns/tool-calls (NFR-5); on
 * exhaustion or malformed output it falls back to the deterministic best-so-far plan (NFR).
 */

const MAX_TURNS = 10;
const MAX_TOOL_CALLS = 16;

const PRESENT_PLAN_TOOL: Anthropic.Tool = {
  name: "present_plan",
  description:
    "Finalize the trip once you've searched and decided. Provide the chosen listing ids; the system assembles the day-by-day plan and totals the budget deterministically.",
  input_schema: {
    type: "object",
    properties: {
      destinationResolved: { type: "string", description: "concrete place, e.g. 'Naxos, Greece'" },
      outboundFlightId: { type: "string" },
      returnFlightId: { type: "string" },
      stayId: { type: "string" },
      activityIds: { type: "array", items: { type: "string" } },
      summary: { type: "string", description: "one-line summary, e.g. '8 days on Naxos — €2,410 for two'" },
      savingHint: {
        type: "object",
        properties: {
          description: { type: "string" },
          delta: { type: "number" },
          appliesTo: { type: "string" },
        },
      },
    },
    required: ["destinationResolved", "outboundFlightId", "returnFlightId", "stayId", "activityIds", "summary"],
  },
};

interface Selection {
  destinationResolved: string;
  outboundFlightId: string;
  returnFlightId: string;
  stayId: string;
  activityIds: string[];
  summary: string;
  savingHint?: { description: string; delta: number; appliesTo: string };
}

export async function planWithAgent(
  request: TripRequest,
  deps: PlanDeps,
  emit: PlanEmitter,
  client: Anthropic,
  model: string,
): Promise<Trip> {
  const pc = buildPlanContext(request, deps.year);
  const provider = new MockProvider({ now: deps.ctx.now, currency: pc.currency });
  const toolbox = new Toolbox(provider);

  // registries so we can resolve the model's chosen ids back to typed objects
  const flightsById = new Map<string, Flight>();
  const staysById = new Map<string, Stay>();
  const activitiesById = new Map<string, Activity>();

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Plan this trip. Constraints (TripRequest JSON):\n${JSON.stringify(request)}\n\nResolved hints — origin: ${pc.origin}, dates: ${pc.dates.start}→${pc.dates.end} (${pc.dates.nights} nights), party: ${pc.pax}, currency: ${pc.currency}, tier: ${pc.tier}. Search, then call present_plan.`,
    },
  ];

  let toolCalls = 0;
  let selection: Selection | undefined;

  for (let turn = 0; turn < MAX_TURNS && !selection; turn++) {
    const res = await client.messages.create({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [...ANTHROPIC_TOOLS, PRESENT_PLAN_TOOL] as Anthropic.Tool[],
      messages,
    });
    messages.push({ role: "assistant", content: res.content });

    const toolUses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      if (tu.name === "present_plan") {
        selection = tu.input as Selection;
        results.push({ type: "tool_result", tool_use_id: tu.id, content: "ok" });
        continue;
      }
      if (++toolCalls > MAX_TOOL_CALLS) {
        results.push({ type: "tool_result", tool_use_id: tu.id, content: "tool budget exhausted; call present_plan now", is_error: true });
        continue;
      }
      try {
        emitStatusFor(tu.name, emit);
        const out = await toolbox.dispatch(tu.name, tu.input);
        capture(tu.name, out, flightsById, staysById, activitiesById, emit);
        results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) });
      } catch (err) {
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `error: ${(err as Error).message}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: results });
  }

  if (!selection) {
    emit.message("Wrapping up with a solid default plan.");
    return planDeterministic(request, deps, emit);
  }

  const assembled = assembleFromSelection(selection, request, pc, provider, { flightsById, staysById, activitiesById }, toolbox, deps);
  return assembled ?? planDeterministic(request, deps, emit);
}

function emitStatusFor(name: string, emit: PlanEmitter): void {
  if (name === "search_flights") emit.status("search_flights", "Searching flights…");
  else if (name === "search_stays") emit.status("search_stays", "Comparing stays…");
  else if (name === "search_activities") emit.status("search_activities", "Finding things to do…");
  else if (name === "compute_budget") emit.status("compute_budget", "Costing it out…");
}

function capture(
  name: string,
  out: unknown,
  flightsById: Map<string, Flight>,
  staysById: Map<string, Stay>,
  activitiesById: Map<string, Activity>,
  emit: PlanEmitter,
): void {
  if (name === "search_flights" && Array.isArray(out)) {
    for (const f of out as Flight[]) flightsById.set(f.id, f);
    if (out.length >= 2) emit.partial({ itinerary: { flights: (out as Flight[]).slice(0, 2) } });
  } else if (name === "search_stays" && Array.isArray(out)) {
    for (const s of out as Stay[]) staysById.set(s.id, s);
  } else if (name === "search_activities" && Array.isArray(out)) {
    for (const a of out as Activity[]) activitiesById.set(a.id, a);
  }
}

function assembleFromSelection(
  sel: Selection,
  request: TripRequest,
  pc: ReturnType<typeof buildPlanContext>,
  provider: MockProvider,
  reg: { flightsById: Map<string, Flight>; staysById: Map<string, Stay>; activitiesById: Map<string, Activity> },
  toolbox: Toolbox,
  deps: PlanDeps,
): Trip | undefined {
  const out = reg.flightsById.get(sel.outboundFlightId);
  const ret = reg.flightsById.get(sel.returnFlightId);
  const stay = reg.staysById.get(sel.stayId);
  if (!out || !ret || !stay) return undefined;

  const chosen = sel.activityIds.map((id) => reg.activitiesById.get(id)).filter((a): a is Activity => !!a);
  const paid = chosen.filter((a) => a.listing.price.amount > 0);
  const free = chosen.filter((a) => a.listing.price.amount === 0);
  const transit = provider.transit(sel.destinationResolved, pc.pax);
  const destShort = sel.destinationResolved.split(",")[0]!.trim();

  const { days, placedActivityListings, transitListings } = assembleDays({
    startDate: pc.dates.start,
    nights: pc.dates.nights,
    destinationShort: destShort,
    paid,
    free,
    transit,
    pace: pc.pace,
  });

  const items: Listing[] = [out.listing, ret.listing, stay.listing, ...transitListings, ...placedActivityListings];
  const budget = toolbox.computeBudget({
    items,
    currency: pc.currency,
    ...(pc.budget ? { target: pc.budget } : {}),
    nights: pc.dates.nights,
    partySize: pc.pax,
    tier: pc.tier,
  });
  budget.savings = sel.savingHint
    ? [{ description: sel.savingHint.description, delta: sel.savingHint.delta, appliesTo: (sel.savingHint.appliesTo as never) }]
    : [{ description: "Travel mid-week for cheaper flights", delta: -25, appliesTo: "flights" }];

  const degraded = (deps.degradedCategories?.length ?? 0) > 0;
  const travelers = [
    ...Array.from({ length: pc.partySize.adults }, (_, i) => ({ id: makeId("trav", "a", i), type: "adult" as const })),
    ...Array.from({ length: pc.partySize.children }, (_, i) => {
      const age = pc.partySize.childAges[i];
      return age != null ? { id: makeId("trav", "c", i), type: "child" as const, age } : { id: makeId("trav", "c", i), type: "child" as const };
    }),
  ];

  return {
    id: makeId("trip", sel.destinationResolved, pc.dates.start, pc.pax),
    request,
    travelers,
    preferences: { pace: pc.pace, interests: pc.interests, ...(pc.lodgingStyle.length ? { lodgingStyle: pc.lodgingStyle } : {}) },
    itinerary: {
      destinationResolved: sel.destinationResolved,
      startDate: pc.dates.start,
      endDate: pc.dates.end,
      flights: [out, ret],
      stays: [stay],
      days,
    },
    budget,
    summary: sel.summary,
    assumptions: pc.assumptions,
    status: degraded ? "degraded" : "complete",
  };
}
