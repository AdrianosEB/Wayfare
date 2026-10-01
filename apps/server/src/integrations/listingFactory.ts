import type { Listing, ListingKind, Money } from "@wayfare/shared";
import { convertFromEur } from "./costIndex.js";

/**
 * Helpers for building `Listing`s. MVP is mock-only, so every Listing is `freshness: 'mock'`
 * with source `mock:curated` or `mock:procedural` and the label "Estimated price" (US-5.1).
 * Prices round to whole major units.
 */

export type MockTier = "curated" | "procedural";

export interface MockContext {
  /** ISO timestamp the price was "obtained" (deterministic clock). */
  now: string;
  /** trip currency; EUR-base costs convert to this. */
  currency: string;
}

export const round = (n: number) => Math.round(n);

export function moneyFromEur(amountEur: number, currency: string): Money {
  return { amount: round(convertFromEur(amountEur, currency)), currency };
}

interface ListingInput {
  id: string;
  kind: ListingKind;
  title: string;
  /** price in EUR; converted to ctx.currency. */
  priceEur: number;
  tier: MockTier;
  confidence: number;
  deepLink?: string;
}

export function mockListing(ctx: MockContext, input: ListingInput): Listing {
  const listing: Listing = {
    id: input.id,
    kind: input.kind,
    title: input.title,
    price: moneyFromEur(input.priceEur, ctx.currency),
    source: {
      provider: input.tier === "curated" ? "mock:curated" : "mock:procedural",
      label: "Estimated price",
    },
    fetchedAt: ctx.now,
    freshness: "mock",
    confidence: input.confidence,
  };
  if (input.deepLink) listing.deepLink = input.deepLink;
  return listing;
}
