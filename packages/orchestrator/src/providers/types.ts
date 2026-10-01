import type { ListingKind } from "@wayfare/shared";
import type { Candidate, SearchQuery } from "../types.js";

/**
 * A provider is any source of priced candidates: Booking, an airline's own site, Amadeus,
 * Google Places, or the mock used in tests and the demo. The orchestrator fans a SearchQuery
 * out to every provider whose `kinds` match and hands the union to the verifier.
 *
 * `aggregator` marks resellers (Booking, Expedia) as opposed to direct providers (a hotel's
 * own booking page). The verifier compares the two to find DirectDeals.
 */
export interface SearchProvider {
  /** stable id, also used verbatim as Listing.source.provider ("booking", "hotel_direct"). */
  readonly id: string;
  readonly displayName: string;
  readonly kinds: readonly ListingKind[];
  readonly aggregator: boolean;
  search(query: SearchQuery): Promise<Candidate[]>;
}
