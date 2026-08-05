import type { ListingKind, Budget } from "@wayfare/shared";
import type {
  ItineraryCombination,
  ItineraryConfirmation,
  ItineraryLeg,
  PersonaWeights,
  PlanResult,
  RankedOption,
  SupervisorStats,
  TravelerProfile,
  TraceEvent,
  VerifiedOption,
  CriticReport,
} from "./types.js";
import type { SearchProvider } from "./providers/types.js";
import { Tracer } from "./trace.js";
import { intake } from "./agents/intake.js";
import { derivePersona } from "./agents/persona.js";
import { planQueries, runSearch } from "./agents/search.js";
import { verify } from "./agents/verify.js";
import { rankByKind, selectLeads, buildBudget } from "./agents/match.js";
import { composeItineraries, itineraryLegs } from "./agents/supervisor.js";
import { repriceItinerary } from "./agents/reprice.js";
import { prepareBookings } from "./agents/booking.js";
import { review } from "./agents/critic.js";

/**
 * Orchestrator — the conductor. It runs the agents as an independent pipeline and closes the
 * loop: intake → persona → (search → verify → rank → supervise → critique)* → reprice → booking.
 *
 * The supervisor fans out across flight × stay × date combinations and prunes branches against
 * budget before expanding; the reprice agent re-checks the winning itinerary at its sources
 * before it is surfaced. When the critic finds a blocker the plan isn't shipped — the search
 * broadens or the persona relaxes and the middle runs again, up to `maxPasses`. What comes out
 * is a whole-trip plan that has graded, re-priced, and corrected itself.
 */

export interface OrchestratorOptions {
  maxPasses?: number;
  kinds?: ListingKind[];
  onEvent?: (e: TraceEvent) => void;
}

export interface PlanOptions {
  maxPasses?: number;
  kinds?: ListingKind[];
}

interface PassResult {
  rankedByKind: Record<string, RankedOption[]>;
  selection: Record<string, RankedOption>;
  itineraries: ItineraryCombination[];
  chosen?: ItineraryCombination;
  legs: ItineraryLeg[];
  stats: SupervisorStats;
  budget: Budget;
  critic: CriticReport;
}

export class Orchestrator {
  private readonly aggregatorIds: Set<string>;

  constructor(
    private readonly providers: SearchProvider[],
    private readonly options: OrchestratorOptions = {},
  ) {
    this.aggregatorIds = new Set(providers.filter((p) => p.aggregator).map((p) => p.id));
  }

  async plan(prompt: string, profile: TravelerProfile, opts: PlanOptions = {}): Promise<PlanResult> {
    const tracer = new Tracer(this.options.onEvent);
    const maxPasses = opts.maxPasses ?? this.options.maxPasses ?? 3;
    const kinds = opts.kinds ?? this.options.kinds ?? (["stay", "flight", "activity"] as ListingKind[]);

    tracer.emit("orchestrator", "start", { prompt, traveler: profile.id, maxPasses });

    const { request, destination } = intake(prompt, profile, tracer);
    const persona = derivePersona(profile, request, tracer);

    let workingWeights: PersonaWeights = { ...persona.weights };
    let breadthMultiplier = 1;

    let best: PassResult | undefined;
    let passes = 0;

    for (let pass = 1; pass <= maxPasses; pass++) {
      passes = pass;
      const result = await this.runPass({
        request,
        profile,
        persona: { ...persona, weights: workingWeights },
        destination,
        kinds,
        breadthMultiplier,
        tracer,
      });
      best = result;

      if (result.critic.passed) break;
      if (pass === maxPasses) break;

      const remedies = new Set(result.critic.issues.map((i) => i.remedy).filter(Boolean));
      if (remedies.has("broaden_search")) breadthMultiplier += 0.6;
      if (remedies.has("relax_quality")) workingWeights = relaxQuality(workingWeights);
      tracer.emit("orchestrator", "retry", { pass, breadthMultiplier, remedies: [...remedies] });
    }

    if (!best) throw new Error("orchestrator produced no plan");

    // final gate: re-price the chosen itinerary at its sources before surfacing it.
    const nights = request.durationDays?.value ?? 5;
    const party = request.partySize?.value;
    const travelers = (party?.adults ?? 1) + (party?.children ?? 0);
    let confirmation: ItineraryConfirmation | undefined;
    if (best.chosen) {
      confirmation = await repriceItinerary({
        combo: best.chosen,
        providers: this.providers,
        destination,
        nights,
        travelers,
        now: new Date().toISOString(),
        tracer,
      });
    }

    const bookingIntents = prepareBookings(best.legs, tracer);
    tracer.emit("orchestrator", "done", {
      passes,
      status: best.budget.status,
      confirmed: confirmation?.confirmed ?? false,
      intents: bookingIntents.length,
    });

    return {
      request,
      persona,
      options: best.rankedByKind,
      selection: best.selection,
      itineraries: best.itineraries,
      ...(best.chosen ? { itinerary: best.chosen } : {}),
      ...(confirmation ? { confirmation } : {}),
      supervisor: best.stats,
      budget: best.budget,
      bookingIntents,
      critic: best.critic,
      passes,
      trace: tracer.drain(),
    };
  }

  private async runPass(args: {
    request: PlanResult["request"];
    profile: TravelerProfile;
    persona: PlanResult["persona"];
    destination: string;
    kinds: ListingKind[];
    breadthMultiplier: number;
    tracer: Tracer;
  }): Promise<PassResult> {
    const { request, persona, destination, kinds, breadthMultiplier, tracer, profile } = args;

    const queries = planQueries(request, persona, { destination, kinds, breadthMultiplier });
    const candidates = await runSearch(this.providers, queries, tracer);
    const verified = verify(candidates, this.aggregatorIds, tracer);

    const optionsByKind = groupByKind(verified);
    const rankedByKind = rankByKind(optionsByKind, persona);

    // supervisor composes whole itineraries with budget-pruned branch-and-bound.
    const { itineraries, stats } = composeItineraries({ rankedByKind, persona, request, tracer });
    const chosen = itineraries.find((i) => i.withinBudget) ?? itineraries[0];
    const legs = chosen ? itineraryLegs(chosen) : [];

    const budget = buildBudget(legs, request, tracer);
    // per-kind leads for display; the itinerary is what gets booked.
    const selection = chosen ? itinerarySelection(legs, rankedByKind) : selectLeads(rankedByKind);

    const critic = review(
      { selection, budget, request, profile, expectedKinds: kinds },
      tracer,
    );

    return { rankedByKind, selection, itineraries, ...(chosen ? { chosen } : {}), legs, stats, budget, critic };
  }
}

function groupByKind(options: VerifiedOption[]): Record<string, VerifiedOption[]> {
  const out: Record<string, VerifiedOption[]> = {};
  for (const o of options) {
    (out[o.entity.kind] ??= []).push(o);
  }
  return out;
}

/** Map the chosen itinerary's legs back to their ranked entries (one per kind, for display). */
function itinerarySelection(
  legs: ItineraryLeg[],
  rankedByKind: Record<string, RankedOption[]>,
): Record<string, RankedOption> {
  const sel: Record<string, RankedOption> = {};
  for (const leg of legs) {
    if (sel[leg.kind]) continue;
    const ranked = (rankedByKind[leg.kind] ?? []).find(
      (r) => r.option.entity.key === leg.option.entity.key,
    );
    sel[leg.kind] = ranked ?? {
      option: leg.option,
      score: 0,
      breakdown: { price: 0, quality: 0, location: 0, vibe: 0, verification: 0 },
    };
  }
  return sel;
}

function relaxQuality(w: PersonaWeights): PersonaWeights {
  const next: PersonaWeights = {
    ...w,
    price: w.price + 0.1,
    quality: Math.max(0, w.quality - 0.1),
  };
  const sum = Object.values(next).reduce((a, b) => a + b, 0) || 1;
  return {
    price: next.price / sum,
    quality: next.quality / sum,
    location: next.location / sum,
    vibe: next.vibe / sum,
    flexibility: next.flexibility / sum,
  };
}
