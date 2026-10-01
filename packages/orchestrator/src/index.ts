/**
 * @wayfare/orchestrator
 *
 * Pipeline: intake (sentence → structured request) → persona → search (fan out to every
 * provider in parallel) → verify (cross-check listings and prices, find direct-vs-aggregator
 * deals) → match (rank on the persona's weights, within budget) → critique (re-run on
 * failure) → booking (staged for human approval, never executed).
 *
 * Real providers plug in behind the SearchProvider interface.
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
