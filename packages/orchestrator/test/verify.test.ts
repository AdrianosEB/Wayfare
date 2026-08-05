import { describe, it, expect } from "vitest";
import type { Listing } from "@wayfare/shared";
import { verify, Tracer } from "../src/index.js";
import type { Candidate } from "../src/index.js";

/**
 * The verifier is the trust boundary, so it gets the closest scrutiny: corroboration →
 * verified, one source → unconfirmed, wildly disagreeing sources → suspect, and a direct
 * price under the aggregator → a surfaced DirectDeal.
 */

function listing(provider: string, amount: number, over: Partial<Listing> = {}): Listing {
  return {
    id: `${provider}:x`,
    kind: "stay",
    title: "Test Stay",
    price: { amount, currency: "EUR" },
    source: { provider, label: `${provider} · sample` },
    fetchedAt: new Date().toISOString(),
    freshness: "mock",
    confidence: 0.8,
    ...over,
  };
}

function candidate(provider: string, amount: number, entityKey = "stay:naxos:test-stay"): Candidate {
  return {
    listing: { ...listing(provider, amount), id: `${provider}:${entityKey}` },
    entity: { key: entityKey, name: "Test Stay", kind: "stay", locality: "Naxos" },
    rating: 4.2,
    distanceToFocusMeters: 400,
    tags: ["central"],
  };
}

const tracer = () => new Tracer();
const aggregators = new Set(["booking", "expedia"]);

describe("verify", () => {
  it("marks an entity verified when independent sources corroborate the price", () => {
    const [option] = verify(
      [candidate("booking", 120), candidate("expedia", 126)],
      aggregators,
      tracer(),
    );
    expect(option?.verdict).toBe("verified");
    expect(option?.sources).toHaveLength(2);
    expect(option?.best.price.amount).toBe(120); // cheapest trustworthy price
    expect(option?.confidence).toBeGreaterThan(0.6);
  });

  it("marks a single-source entity unconfirmed", () => {
    const [option] = verify([candidate("booking", 120)], aggregators, tracer());
    expect(option?.verdict).toBe("unconfirmed");
    expect(option?.flags).toContain("single_source");
  });

  it("marks an entity suspect when sources disagree wildly", () => {
    const [option] = verify(
      [candidate("booking", 120), candidate("expedia", 260)],
      aggregators,
      tracer(),
    );
    expect(option?.verdict).toBe("suspect");
    expect(option?.flags).toContain("price_mismatch");
    // suspect prices don't get to win on the cheap outlier alone.
    expect(option?.confidence).toBeLessThanOrEqual(0.4);
  });

  it("surfaces a direct deal when a direct source undercuts the aggregators", () => {
    const [option] = verify(
      [candidate("booking", 130), candidate("hotel_direct", 110)],
      aggregators,
      tracer(),
    );
    expect(option?.directDeal).toBeDefined();
    expect(option?.directDeal?.directSource).toBe("hotel_direct");
    expect(option?.directDeal?.savings).toBe(20);
    expect(option?.flags).toContain("direct_cheaper");
  });

  it("groups candidates by entity, not by source", () => {
    const options = verify(
      [
        candidate("booking", 120, "stay:naxos:a"),
        candidate("expedia", 122, "stay:naxos:a"),
        candidate("booking", 90, "stay:naxos:b"),
      ],
      aggregators,
      tracer(),
    );
    expect(options).toHaveLength(2);
  });
});
