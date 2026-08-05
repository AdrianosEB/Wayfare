import type { ListingKind } from "@wayfare/shared";
import type { Candidate, SearchQuery } from "../types.js";

/**
 * SearchProvider — the pluggable seam. A provider is any source of priced candidates:
 * Booking, an airline's own site, Amadeus, Google Places, or the procedural mock used in
 * tests and the demo. The orchestrator fans a SearchQuery out to every provider whose
 * `kinds` match, in parallel, and hands the union to the verifier.
 *
 * `aggregator` is the load-bearing flag for the "cheaper off Booking" story: aggregators
 * (Booking, Expedia) resell inventory; direct providers (a hotel's own booking page) are the
 * ones that can undercut them. The verifier compares the two to surface DirectDeals.
 */
export interface SearchProvider {
  /** stable id, also used verbatim as Listing.source.provider ("booking", "hotel_direct"). */
  readonly id: string;
  readonly displayName: string;
  readonly kinds: readonly ListingKind[];
  readonly aggregator: boolean;
  search(query: SearchQuery): Promise<Candidate[]>;
}
