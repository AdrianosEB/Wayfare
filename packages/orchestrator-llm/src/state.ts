import { Annotation } from "@langchain/langgraph";
import type { Budget, TripRequest } from "@wayfare/shared";
import type {
  Candidate,
  CriticReport,
  ItineraryCombination,
  ItineraryConfirmation,
  ItineraryLeg,
  Persona,
  RankedOption,
  SearchQuery,
  SupervisorStats,
  TravelerProfile,
  VerifiedOption,
} from "@wayfare/orchestrator";

/**
 * Graph state. The critic→retry edge is a cycle over mutating state: `pass` and
 * `breadthMultiplier` carry forward and everything from planQueries down is recomputed.
 */
export const PlanState = Annotation.Root({
  // inputs, fixed for the run
  prompt: Annotation<string>(),
  profile: Annotation<TravelerProfile>(),

  // produced by the agents
  request: Annotation<TripRequest | undefined>(),
  destination: Annotation<string>(),
  persona: Annotation<Persona | undefined>(),
  queries: Annotation<SearchQuery[]>({ reducer: (_, b) => b, default: () => [] }),
  candidates: Annotation<Candidate[]>({ reducer: (_, b) => b, default: () => [] }),
  verified: Annotation<VerifiedOption[]>({ reducer: (_, b) => b, default: () => [] }),
  rankedByKind: Annotation<Record<string, RankedOption[]>>({
    reducer: (_, b) => b,
    default: () => ({}),
  }),
  itineraries: Annotation<ItineraryCombination[]>({ reducer: (_, b) => b, default: () => [] }),
  supervisorStats: Annotation<SupervisorStats | undefined>(),
  chosen: Annotation<ItineraryCombination | undefined>(),
  chosenRationale: Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  legs: Annotation<ItineraryLeg[]>({ reducer: (_, b) => b, default: () => [] }),
  budget: Annotation<Budget | undefined>(),
  confirmation: Annotation<ItineraryConfirmation | undefined>(),
  critic: Annotation<CriticReport | undefined>(),

  // loop control
  /** 1-based; incremented on every retry through the cycle. */
  pass: Annotation<number>({ reducer: (_, b) => b, default: () => 1 }),
  maxPasses: Annotation<number>({ reducer: (_, b) => b, default: () => 2 }),
  /** widened by the critic's "broaden_search" remedy before the graph loops back. */
  breadthMultiplier: Annotation<number>({ reducer: (_, b) => b, default: () => 1 }),
});

export type PlanStateType = typeof PlanState.State;
export type PlanStateUpdate = Partial<PlanStateType>;
