import type { ListingKind } from "@wayfare/shared";
import type {
  PersonaWeights,
  PlanResult,
  TravelerProfile,
  TraceEvent,
  VerifiedOption,
} from "./types.js";
import type { SearchProvider } from "./providers/types.js";
import { Tracer } from "./trace.js";
import { intake } from "./agents/intake.js";
import { derivePersona } from "./agents/persona.js";
import { planQueries, runSearch } from "./agents/search.js";
import { verify } from "./agents/verify.js";
import { match } from "./agents/match.js";
import { prepareBookings } from "./agents/booking.js";
import { review } from "./agents/critic.js";

/**
 * Orchestrator — the conductor. It runs the agents as an independent pipeline and, crucially,
 * closes the loop: intake → persona → (search → verify → match → critique)* → booking. When the
 * critic finds a blocker it doesn't ship the plan — it adjusts the search breadth or the
 * persona weights and runs the middle again, up to `maxPasses`. What comes out is a plan that
 * has already graded and corrected itself.
 *
 * Every priced thing stays a shared `Listing`, so provenance rides along end-to-end and the UI
 * can be honest about what's live, cached, estimated, or (here) sample data.
 */

export interface OrchestratorOptions {
  /** how many self-correcting passes before shipping the best-so-far plan. */
  maxPasses?: number;
  /** which listing kinds to shop for. */
  kinds?: ListingKind[];
  /** stream trace events as they happen (e.g. to SSE). */
  onEvent?: (e: TraceEvent) => void;
}

export interface PlanOptions {
  maxPasses?: number;
  kinds?: ListingKind[];
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

    // a mutable copy of the persona the loop is allowed to nudge (relax_quality remedy).
    let workingWeights: PersonaWeights = { ...persona.weights };
    let breadthMultiplier = 1;

    let best: Awaited<ReturnType<typeof this.runPass>> | undefined;
    let passes = 0;

    for (let pass = 1; pass <= maxPasses; pass++) {
      passes = pass;
      const result = await this.runPass({
        pass,
        prompt,
        profile,
        request,
        persona: { ...persona, weights: workingWeights },
        destination,
        kinds,
        breadthMultiplier,
        tracer,
      });
      best = result;

      if (result.critic.passed) break;
      if (pass === maxPasses) break;

      // act on the critic's remedies before the next pass.
      const remedies = new Set(result.critic.issues.map((i) => i.remedy).filter(Boolean));
      if (remedies.has("broaden_search")) breadthMultiplier += 0.6;
      if (remedies.has("relax_quality")) workingWeights = relaxQuality(workingWeights);
      tracer.emit("orchestrator", "retry", { pass, breadthMultiplier, remedies: [...remedies] });
    }

    if (!best) throw new Error("orchestrator produced no plan");

    const bookingIntents = prepareBookings(best.selection, tracer);
    tracer.emit("orchestrator", "done", { passes, status: best.budget.status, intents: bookingIntents.length });

    return {
      request,
      persona,
      options: mapValues(best.ranked, (arr) => arr),
      selection: best.selection,
      budget: best.budget,
      bookingIntents,
      critic: best.critic,
      passes,
      trace: tracer.drain(),
    };
  }

  private async runPass(args: {
    pass: number;
    prompt: string;
    profile: TravelerProfile;
    request: PlanResult["request"];
    persona: PlanResult["persona"];
    destination: string;
    kinds: ListingKind[];
    breadthMultiplier: number;
    tracer: Tracer;
  }) {
    const { request, persona, destination, kinds, breadthMultiplier, tracer, profile } = args;

    const queries = planQueries(request, persona, { destination, kinds, breadthMultiplier });
    const candidates = await runSearch(this.providers, queries, tracer);
    const verified = verify(candidates, this.aggregatorIds, tracer);

    const optionsByKind = groupByKind(verified);
    const { ranked, selection, budget } = match(optionsByKind, persona, request, tracer);
    const critic = review(
      { selection, budget, request, profile, expectedKinds: kinds },
      tracer,
    );

    return { ranked, selection, budget, critic };
  }
}

function groupByKind(options: VerifiedOption[]): Record<string, VerifiedOption[]> {
  const out: Record<string, VerifiedOption[]> = {};
  for (const o of options) {
    (out[o.entity.kind] ??= []).push(o);
  }
  return out;
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

function mapValues<V, R>(obj: Record<string, V>, fn: (v: V) => R): Record<string, R> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));
}
