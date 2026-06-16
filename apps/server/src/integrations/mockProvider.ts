import type { Flight, Stay, Activity } from "@wayfare/shared";
import type { PricingProvider, FlightQuery, StayQuery, ActivityQuery } from "./provider.js";
import type { MockContext } from "./listingFactory.js";
import { generateFlights } from "./mock/flights.js";
import { generateStays } from "./mock/stays.js";
import { generateActivities } from "./mock/activities.js";
import { findCuratedPack, type TransitLeg } from "./curated/index.js";

/**
 * The two-tier mock provider: curated hero packs where they exist, deterministic procedural
 * generation everywhere else (INTEGRATIONS.md). Every result is honestly labeled mock. Bound
 * to a trip currency + a fixed clock so the same request always yields the same listings.
 */
export class MockProvider implements PricingProvider {
  readonly name = "mock";
  constructor(private readonly ctx: MockContext) {}

  async searchFlights(q: FlightQuery): Promise<Flight[]> {
    const pack = findCuratedPack(q.destination);
    return pack ? pack.buildFlights(q, this.ctx) : generateFlights(q, this.ctx);
  }

  async searchStays(q: StayQuery): Promise<Stay[]> {
    const pack = findCuratedPack(q.location);
    return pack ? pack.buildStays(q, this.ctx) : generateStays(q, this.ctx);
  }

  async searchActivities(q: ActivityQuery): Promise<Activity[]> {
    const pack = findCuratedPack(q.location);
    return pack ? pack.buildActivities(q, this.ctx) : generateActivities(q, this.ctx);
  }

  /**
   * Intra-region transit (ferries/transfers). Not part of the PricingProvider interface — it's
   * only meaningful for some curated destinations (e.g. the Greek islands). Empty otherwise.
   */
  transit(location: string, partySize: number): TransitLeg[] {
    const pack = findCuratedPack(location);
    return pack ? pack.buildTransit({ location, partySize }, this.ctx) : [];
  }
}
