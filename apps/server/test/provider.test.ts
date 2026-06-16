import { describe, it, expect } from "vitest";
import { FlightSchema, StaySchema, ActivitySchema } from "@wayfare/shared";
import { z } from "zod";
import { MockProvider } from "../src/integrations/mockProvider.js";
import { CompositeProvider } from "../src/integrations/composite.js";
import type { PricingProvider, FlightQuery } from "../src/integrations/provider.js";

const ctx = { now: "2026-06-16T10:00:00Z", currency: "EUR" };
const flightQ: FlightQuery = {
  origin: "Berlin",
  destination: "Lisbon, Portugal",
  departDate: "2026-09-10",
  returnDate: "2026-09-17",
  dateFlexibility: "window",
  adults: 2,
};

describe("MockProvider — determinism (NFR-6)", () => {
  it("returns byte-identical results for identical queries", async () => {
    const a = new MockProvider(ctx);
    const b = new MockProvider(ctx);
    const ra = await a.searchFlights(flightQ);
    const rb = await b.searchFlights(flightQ);
    expect(ra).toEqual(rb);
  });

  it("produces schema-valid, Listing-wrapped results for ANY destination (US-3.6)", async () => {
    const p = new MockProvider(ctx);
    for (const dest of ["Tbilisi, Georgia", "Reykjavik", "Hanoi, Vietnam", "Nowhere-on-Earth"]) {
      const flights = await p.searchFlights({ ...flightQ, destination: dest });
      const stays = await p.searchStays({ location: dest, checkIn: "2026-09-10", checkOut: "2026-09-17", guests: 2 });
      const acts = await p.searchActivities({ location: dest, interests: ["food", "history"], partySize: 2 });
      expect(() => z.array(FlightSchema).parse(flights)).not.toThrow();
      expect(() => z.array(StaySchema).parse(stays)).not.toThrow();
      expect(() => z.array(ActivitySchema).parse(acts)).not.toThrow();
      expect(flights.length).toBeGreaterThan(0);
      for (const f of flights) expect(f.listing.freshness).toBe("mock");
    }
  });

  it("curated Greece routes via the Santorini gateway", async () => {
    const p = new MockProvider(ctx);
    const flights = await p.searchFlights({ ...flightQ, origin: "London", destination: "Naxos, Greece" });
    expect(flights[0]!.to).toBe("JTR");
    expect(flights[0]!.listing.source.provider).toBe("mock:curated");
  });
});

describe("CompositeProvider — graceful degradation (NFR-3)", () => {
  it("falls back to mock and tags the category degraded when a provider throws", async () => {
    const mock = new MockProvider(ctx);
    const broken: PricingProvider = {
      name: "broken",
      async searchFlights() {
        throw new Error("rate limited");
      },
      searchStays: mock.searchStays.bind(mock),
      searchActivities: mock.searchActivities.bind(mock),
    };
    const composite = new CompositeProvider({ flights: broken, stays: mock, activities: mock, fallback: mock });
    const flights = await composite.searchFlights(flightQ);
    expect(flights.length).toBeGreaterThan(0);
    expect(composite.degraded).toContain("flights");
  });
});
