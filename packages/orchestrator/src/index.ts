/**
 * @wayfare/orchestrator — an orchestration of independent travel agents.
 *
 * The pipeline: intake (sentence → structured request) → persona (who is this traveler) →
 * search (fan out to every provider in parallel) → verify (cross-check listings for
 * authenticity and price honesty; surface direct-vs-aggregator deals) → match (rank on the
 * persona's weights, within budget) → critique (self-check and, on failure, re-run) → booking
 * (stage bookings and hotel calls for human approval — never executed autonomously).
 *
 * Every price is a shared `Listing`, so its source, freshness, and confidence travel with the
 * number the whole way through. This package is the base for an AI-native travel agency; drop
 * real providers in behind the SearchProvider seam and the rest is unchanged.
 */
export * from "./types.js";
export { Orchestrator } from "./orchestrator.js";
export type { OrchestratorOptions, PlanOptions } from "./orchestrator.js";
export { Tracer } from "./trace.js";
export type { SearchProvider } from "./providers/types.js";
export { mockProviderRegistry } from "./providers/mock.js";

// individual agents, exported so they can be composed or replaced piecemeal.
export { intake } from "./agents/intake.js";
export type { IntakeResult } from "./agents/intake.js";
export { derivePersona } from "./agents/persona.js";
export { planQueries, runSearch } from "./agents/search.js";
export type { SearchPlanOptions } from "./agents/search.js";
export { verify } from "./agents/verify.js";
export type { VerifyOptions } from "./agents/verify.js";
export { rankByKind, rankKind, selectLeads, buildBudget, legMultiplier } from "./agents/match.js";
export {
  composeItineraries,
  deriveWindows,
  computeItineraryTotal,
  itineraryLegs,
} from "./agents/supervisor.js";
export type { SupervisorOptions, ComposeArgs } from "./agents/supervisor.js";
export { repriceItinerary } from "./agents/reprice.js";
export type { RepriceArgs } from "./agents/reprice.js";
export { prepareBookings } from "./agents/booking.js";
export { review } from "./agents/critic.js";
export type { CriticInput } from "./agents/critic.js";

// fan-out limiting primitives
export { Limiter, SingleFlight, TTLCache, SearchLimits, queryKey } from "./limits.js";
export type { SearchLimitsOptions, SearchStats } from "./limits.js";
