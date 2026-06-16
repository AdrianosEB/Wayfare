import type { Flight, Stay, Activity } from "@wayfare/shared";
import type { PricingProvider, FlightQuery, StayQuery, ActivityQuery } from "./provider.js";

export type ProviderCategory = "flights" | "stays" | "activities";

/**
 * CompositeProvider wraps per-category providers and applies the fallback policy: try the
 * real provider; on error/rate-limit, fall back to mock and tag the category degraded
 * (NFR-3). This is what makes "MVP on mock, swap in real per category later" a config change,
 * not a rewrite (NFR-7). In MVP every category is the mock provider, so nothing degrades.
 */
export class CompositeProvider implements PricingProvider {
  readonly name = "composite";
  private readonly degradedSet = new Set<ProviderCategory>();

  constructor(
    private readonly providers: {
      flights: PricingProvider;
      stays: PricingProvider;
      activities: PricingProvider;
      fallback: PricingProvider;
    },
    private readonly onDegrade?: (category: ProviderCategory) => void,
  ) {}

  /** categories that fell back to mock this run. */
  get degraded(): ProviderCategory[] {
    return [...this.degradedSet];
  }

  private async attempt<T>(
    category: ProviderCategory,
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    try {
      return await primary();
    } catch {
      this.degradedSet.add(category);
      this.onDegrade?.(category);
      return fallback();
    }
  }

  searchFlights(q: FlightQuery): Promise<Flight[]> {
    return this.attempt(
      "flights",
      () => this.providers.flights.searchFlights(q),
      () => this.providers.fallback.searchFlights(q),
    );
  }
  searchStays(q: StayQuery): Promise<Stay[]> {
    return this.attempt(
      "stays",
      () => this.providers.stays.searchStays(q),
      () => this.providers.fallback.searchStays(q),
    );
  }
  searchActivities(q: ActivityQuery): Promise<Activity[]> {
    return this.attempt(
      "activities",
      () => this.providers.activities.searchActivities(q),
      () => this.providers.fallback.searchActivities(q),
    );
  }
}
