import { z } from "zod";
import { MoneySchema } from "./common.js";

/**
 * Listing — the uniform priced unit. Every price in Wayfare is a Listing, so the agent,
 * budget, and UI treat mock and real prices identically, including their honesty about
 * source. See DATA_MODEL.md "Listing".
 */

/** How fresh/reliable a price is. In MVP every Listing is `mock`. */
export const FreshnessSchema = z.enum(["live", "cached", "estimate", "mock"]);
export type Freshness = z.infer<typeof FreshnessSchema>;

export const ListingKindSchema = z.enum([
  "flight",
  "stay",
  "activity",
  "transit",
]);
export type ListingKind = z.infer<typeof ListingKindSchema>;

/** Where a price came from + the human label the UI renders next to it. */
export const PriceSourceSchema = z
  .object({
    /** 'mock:procedural' | 'mock:curated' | 'amadeus' | 'booking' | 'google_places' … */
    provider: z.string(),
    /** human: "Mock estimate" | "Estimated price" | "Amadeus · 2h ago" */
    label: z.string(),
    url: z.string().optional(),
  })
  .strict();
export type PriceSource = z.infer<typeof PriceSourceSchema>;

export const ListingSchema = z
  .object({
    id: z.string(),
    kind: ListingKindSchema,
    title: z.string(),
    price: MoneySchema,
    // --- transparency: required on EVERY listing (US-3.4, US-5.1) ---
    source: PriceSourceSchema,
    /** ISO timestamp the price was obtained. */
    fetchedAt: z.string(),
    freshness: FreshnessSchema,
    /** 0–1, how reliable the number is. */
    confidence: z.number().min(0).max(1),
    /** where to book it (v1). */
    deepLink: z.string().optional(),
    /** provider payload, server-side only — never sent raw to the client. */
    raw: z.unknown().optional(),
  })
  .strict();
export type Listing = z.infer<typeof ListingSchema>;
