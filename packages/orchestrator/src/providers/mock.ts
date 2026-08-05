import type { Listing, ListingKind } from "@wayfare/shared";
import type { Candidate, EntityRef, SearchQuery } from "../types.js";
import type { SearchProvider } from "./types.js";

/**
 * Procedural mock providers — deterministic, dependency-free stand-ins that exercise the
 * whole orchestration exactly as real providers will, including the cases that make
 * verification worth doing:
 *   - the same entity listed by several sources at slightly different prices,
 *   - a direct source that undercuts the aggregators (a DirectDeal),
 *   - a single-source entity (unconfirmed),
 *   - a "trap" entity with a wild price spread (suspect).
 *
 * Provenance is honest: every Listing is stamped `freshness: "mock"`. Per the project's
 * price-provenance rule, the UI must render source/freshness rather than assume live data —
 * these are sample numbers and they say so.
 */

// --- tiny deterministic RNG so the same query always yields the same market ---------------
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CatalogEntity {
  entity: EntityRef;
  basePrice: number;
  currency: string;
  rating: number;
  distanceToFocusMeters: number;
  tags: string[];
  /** a plausible-looking listing whose price is wildly out of line across sources. */
  trap: boolean;
}

const NAMES: Record<ListingKind, string[]> = {
  stay: [
    "Aegean Blue Studios",
    "Old Town Guesthouse",
    "Harbour View Rooms",
    "Cliffside Boutique Hotel",
    "Whitewash Apartments",
    "Sunset Deal Suites",
  ],
  flight: [
    "Nonstop 08:40",
    "1-stop via ATH 06:15",
    "Nonstop 13:20",
    "1-stop via FRA 21:10",
    "Nonstop 17:55",
  ],
  activity: [
    "Small-group Boat Trip",
    "Old Town Food Tour",
    "Sunset Kayak",
    "Wine Tasting",
    "Village Cooking Class",
    "Deal: Full-day Island Tour",
  ],
  transit: ["Airport Transfer", "Ferry Day Pass", "Scooter Rental"],
};

/** The shared, provider-independent truth of what exists for a query. */
function buildCatalog(query: SearchQuery): CatalogEntity[] {
  const rng = mulberry32(hashString(`${query.kind}|${query.where}`));
  const currency = query.maxPrice?.currency ?? "EUR";
  const names = NAMES[query.kind];
  const baseFloor = query.kind === "flight" ? 90 : query.kind === "stay" ? 55 : 20;
  const baseSpan = query.kind === "flight" ? 260 : query.kind === "stay" ? 190 : 70;
  return names.map((name, i) => {
    const trap = name.toLowerCase().includes("deal");
    return {
      entity: {
        key: `${query.kind}:${query.where}:${name}`.toLowerCase().replace(/\s+/g, "-"),
        name,
        kind: query.kind,
        locality: query.where,
      },
      basePrice: Math.round(baseFloor + rng() * baseSpan),
      currency,
      rating: Number((3.4 + rng() * 1.6).toFixed(1)),
      distanceToFocusMeters: Math.round(80 + rng() * 2600),
      tags: pickTags(query.kind, rng, i),
      trap,
    };
  });
}

function pickTags(kind: ListingKind, rng: () => number, i: number): string[] {
  const pools: Record<ListingKind, string[]> = {
    stay: ["boutique", "quiet", "central", "sea_view", "family", "budget", "design"],
    flight: ["nonstop", "morning", "evening", "extra_legroom", "budget_carrier"],
    activity: ["small_group", "foodie", "outdoors", "cultural", "family", "romantic"],
    transit: ["shared", "private", "eco"],
  };
  const pool = pools[kind];
  const out = new Set<string>();
  const n = 1 + Math.floor(rng() * 2);
  for (let k = 0; k < n; k++) out.add(pool[(i + k + Math.floor(rng() * pool.length)) % pool.length]!);
  return [...out];
}

interface MockProviderConfig {
  id: string;
  displayName: string;
  label: string;
  kinds: readonly ListingKind[];
  aggregator: boolean;
  /** applied to base price; <1 undercuts the market. */
  priceMultiplier: number;
  /** fraction of entities this source lists (0–1); drives single-source cases. */
  coverage: number;
  /** how reliable this source's *price* is, 0–1. */
  confidence: number;
  freshnessLabel?: string;
}

function makeProvider(cfg: MockProviderConfig): SearchProvider {
  return {
    id: cfg.id,
    displayName: cfg.displayName,
    kinds: cfg.kinds,
    aggregator: cfg.aggregator,
    async search(query: SearchQuery): Promise<Candidate[]> {
      if (!cfg.kinds.includes(query.kind)) return [];
      const catalog = buildCatalog(query);
      const rng = mulberry32(hashString(`${cfg.id}|${query.kind}|${query.where}`));
      const out: Candidate[] = [];
      for (const c of catalog) {
        if (rng() > cfg.coverage) continue; // this source doesn't carry this entity
        // ±6% honest noise, plus the provider's structural multiplier.
        const noise = 1 + (rng() - 0.5) * 0.12;
        let amount = Math.round(c.basePrice * cfg.priceMultiplier * noise);
        // the trap entity: aggregators quote it high, so cross-checking flags a mismatch.
        if (c.trap && cfg.aggregator) amount = Math.round(amount * 1.9);
        if (query.maxPrice && amount > query.maxPrice.amount * 1.15) continue;

        const listing: Listing = {
          id: `${cfg.id}:${c.entity.key}`,
          kind: query.kind,
          title: c.entity.name,
          price: { amount, currency: c.currency },
          source: {
            provider: cfg.id,
            label: cfg.label,
            url: `https://example.invalid/${cfg.id}/${encodeURIComponent(c.entity.key)}`,
          },
          fetchedAt: new Date().toISOString(),
          freshness: "mock",
          confidence: cfg.confidence,
          deepLink: `https://example.invalid/${cfg.id}/book/${encodeURIComponent(c.entity.key)}`,
        };
        out.push({
          listing,
          entity: c.entity,
          rating: c.rating,
          distanceToFocusMeters: c.distanceToFocusMeters,
          tags: c.tags,
        });
      }
      return out;
    },
  };
}

/**
 * A default market: two aggregators + one direct source per bookable kind. The direct
 * sources undercut and don't carry everything — exactly the shape that produces DirectDeals
 * and single-source (unconfirmed) options for the verifier to reason about.
 */
export function mockProviderRegistry(): SearchProvider[] {
  return [
    // stays
    makeProvider({ id: "booking", displayName: "Booking.com", label: "Booking.com · sample", kinds: ["stay"], aggregator: true, priceMultiplier: 1.0, coverage: 0.95, confidence: 0.8 }),
    makeProvider({ id: "expedia", displayName: "Expedia", label: "Expedia · sample", kinds: ["stay"], aggregator: true, priceMultiplier: 1.05, coverage: 0.8, confidence: 0.78 }),
    makeProvider({ id: "hotel_direct", displayName: "Hotel direct", label: "Direct rate · sample", kinds: ["stay"], aggregator: false, priceMultiplier: 0.88, coverage: 0.6, confidence: 0.7 }),
    // flights
    makeProvider({ id: "skyscanner", displayName: "Skyscanner", label: "Skyscanner · sample", kinds: ["flight"], aggregator: true, priceMultiplier: 1.0, coverage: 0.95, confidence: 0.82 }),
    makeProvider({ id: "airline_direct", displayName: "Airline direct", label: "Airline direct · sample", kinds: ["flight"], aggregator: false, priceMultiplier: 0.94, coverage: 0.7, confidence: 0.8 }),
    // activities
    makeProvider({ id: "getyourguide", displayName: "GetYourGuide", label: "GetYourGuide · sample", kinds: ["activity"], aggregator: true, priceMultiplier: 1.0, coverage: 0.9, confidence: 0.75 }),
    makeProvider({ id: "operator_direct", displayName: "Operator direct", label: "Operator direct · sample", kinds: ["activity"], aggregator: false, priceMultiplier: 0.85, coverage: 0.55, confidence: 0.68 }),
  ];
}
