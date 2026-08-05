import type { ListingKind, TripRequest } from "@wayfare/shared";
import type { Candidate, Persona, SearchQuery } from "../types.js";
import type { SearchProvider } from "../providers/types.js";
import type { Tracer } from "../trace.js";

/**
 * SearchAgent — two jobs: turn the request into concrete SearchQueries, then fan them out to
 * every relevant provider *in parallel* and return the union of candidates. It is provider-
 * agnostic; the orchestrator injects the registry (mock in tests, real APIs in production).
 *
 * `breadthMultiplier` is the knob the self-check loop turns: when the critic says "too few
 * verified options" or "over budget", the orchestrator widens the price band and re-runs.
 */

export interface SearchPlanOptions {
  destination: string;
  /** which kinds to shop for. */
  kinds?: ListingKind[];
  /** ≥1; the critic raises this to broaden a thin market on a retry. */
  breadthMultiplier?: number;
}

export function planQueries(
  request: TripRequest,
  _persona: Persona,
  opts: SearchPlanOptions,
): SearchQuery[] {
  const kinds = opts.kinds ?? ["stay", "flight", "activity"];
  const breadth = opts.breadthMultiplier ?? 1;
  const hints = request.vibe?.value ?? [];
  const partySize = request.partySize?.value;
  const budget = request.budget?.value;

  // split the budget into rough per-kind ceilings so each source can prune at the edge.
  const nights = request.durationDays?.value ?? 5;
  const perKindCeiling = (kind: ListingKind): { amount: number; currency: string } | undefined => {
    if (!budget) return undefined;
    const share = kind === "flight" ? 0.4 : kind === "stay" ? 0.4 : 0.2;
    const divisor = kind === "stay" ? Math.max(1, nights) : kind === "activity" ? 4 : 1;
    return {
      amount: Math.round(((budget.amount * share) / divisor) * breadth),
      currency: budget.currency,
    };
  };

  return kinds.map((kind) => ({
    kind,
    where: opts.destination,
    partySize,
    maxPrice: perKindCeiling(kind),
    hints,
  }));
}

export async function runSearch(
  providers: SearchProvider[],
  queries: SearchQuery[],
  tracer: Tracer,
): Promise<Candidate[]> {
  const jobs: Promise<Candidate[]>[] = [];
  for (const query of queries) {
    for (const provider of providers) {
      if (!provider.kinds.includes(query.kind)) continue;
      jobs.push(
        provider
          .search(query)
          .catch((err) => {
            // a flaky source degrades the market, it doesn't fail the plan.
            tracer.emit("search", "provider_error", { provider: provider.id, kind: query.kind, error: String(err) });
            return [] as Candidate[];
          }),
      );
    }
  }

  const settled = await Promise.all(jobs);
  const candidates = settled.flat();
  tracer.emit("search", "fanned_out", {
    providers: providers.length,
    queries: queries.length,
    candidates: candidates.length,
  });
  return candidates;
}
