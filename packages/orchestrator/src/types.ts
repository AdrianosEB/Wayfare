import { z } from "zod";
import {
  ListingSchema,
  ListingKindSchema,
  MoneySchema,
  GeoPointSchema,
  PreferencesSchema,
  BudgetConstraintSchema,
  PartySizeSchema,
  BudgetSchema,
  TripRequestSchema,
} from "@wayfare/shared";

/**
 * Orchestration types — the vocabulary the agents speak to each other. Every priced thing is
 * a `Listing` from @wayfare/shared, so provenance (source / freshness / confidence) travels
 * with the number and the verifier can reason about honesty, never just magnitude.
 *
 * Nothing here books or calls anyone. Booking and outbound calls are modeled as *intents*
 * that require explicit human approval — see BookingIntent and agents/booking.ts.
 */

// ---------------------------------------------------------------------------
// Traveler + persona
// ---------------------------------------------------------------------------

/**
 * TravelerProfile — the raw human input. `signals` are free-text observations about the
 * person ("hates 6am flights", "foodie", "will pay for location"); the persona agent distils
 * them into normalized Preferences + PersonaWeights. Hard constraints (budget, party) sit
 * alongside so the matcher can enforce them.
 */
export const TravelerProfileSchema = z
  .object({
    id: z.string(),
    displayName: z.string().optional(),
    homeCity: z.string().optional(),
    /** free-text taste + personality signals, in the traveler's own words. */
    signals: z.array(z.string()).default([]),
    budget: BudgetConstraintSchema.optional(),
    partySize: PartySizeSchema.optional(),
    /** things the plan MUST contain (drives the critic's constraint check). */
    mustHaves: z.array(z.string()).default([]),
    /** things to keep out of the plan. */
    avoid: z.array(z.string()).default([]),
  })
  .strict();
export type TravelerProfile = z.infer<typeof TravelerProfileSchema>;

/**
 * PersonaWeights — how much each axis matters to *this* traveler. They sum to ~1 and drive
 * the ranker. A budget-conscious person weights `price` high; a "location is everything"
 * person weights `location`.
 */
export const PersonaWeightsSchema = z
  .object({
    price: z.number().min(0),
    quality: z.number().min(0),
    location: z.number().min(0),
    vibe: z.number().min(0),
    flexibility: z.number().min(0),
  })
  .strict();
export type PersonaWeights = z.infer<typeof PersonaWeightsSchema>;

export const PersonaSchema = z
  .object({
    weights: PersonaWeightsSchema,
    preferences: PreferencesSchema,
    /** one-line, human-readable read on the traveler ("cost-led foodie, hates early starts"). */
    summary: z.string(),
  })
  .strict();
export type Persona = z.infer<typeof PersonaSchema>;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** A single fan-out unit of work handed to every relevant provider in parallel. */
export const SearchQuerySchema = z
  .object({
    kind: ListingKindSchema,
    /** resolved locality, e.g. "Naxos, Greece" or "JFK→ATH". */
    where: z.string(),
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    partySize: PartySizeSchema.optional(),
    /** soft ceiling used to prune obviously-out-of-band results at the source. */
    maxPrice: MoneySchema.optional(),
    /** free-text refinements ("near old town", "nonstop"). */
    hints: z.array(z.string()).default([]),
  })
  .strict();
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/**
 * EntityRef — the normalized identity a listing points at, independent of who listed it.
 * Two listings of the same hotel from Booking and the hotel's own site share an entity key;
 * that is what lets the verifier cross-check them.
 */
export const EntityRefSchema = z
  .object({
    key: z.string(),
    name: z.string(),
    kind: ListingKindSchema,
    locality: z.string().optional(),
  })
  .strict();
export type EntityRef = z.infer<typeof EntityRefSchema>;

/** Candidate — one provider's answer for one entity, price + provenance carried by Listing. */
export const CandidateSchema = z
  .object({
    listing: ListingSchema,
    entity: EntityRefSchema,
    rating: z.number().min(0).max(5).optional(),
    location: GeoPointSchema.optional(),
    /** proximity to the trip's focus, if the provider knows it. */
    distanceToFocusMeters: z.number().optional(),
    /** provider-native tags used for vibe matching ("boutique", "quiet", "family"). */
    tags: z.array(z.string()).default([]),
  })
  .strict();
export type Candidate = z.infer<typeof CandidateSchema>;

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export const VerdictSchema = z.enum(["verified", "unconfirmed", "suspect"]);
export type Verdict = z.infer<typeof VerdictSchema>;

/**
 * DirectDeal — the "cheaper off Booking" signal. When a direct (non-aggregator) source lists
 * the same entity below the best aggregator price, the traveler saves by booking direct.
 */
export const DirectDealSchema = z
  .object({
    aggregatorPrice: z.number(),
    aggregatorSource: z.string(),
    directPrice: z.number(),
    directSource: z.string(),
    savings: z.number(),
    currency: z.string(),
  })
  .strict();
export type DirectDeal = z.infer<typeof DirectDealSchema>;

/**
 * VerifiedOption — the verifier's cross-checked ruling on one entity. `best` is the lowest
 * *trustworthy* price; `corroboration` is every independent listing that agrees it is real.
 */
export const VerifiedOptionSchema = z
  .object({
    entity: EntityRefSchema,
    verdict: VerdictSchema,
    /** 0–1 blend of corroboration count, source quality, and price agreement. */
    confidence: z.number().min(0).max(1),
    /** lowest trustworthy listing — what we'd actually book. */
    best: ListingSchema,
    /** every listing pointing at this entity, across sources. */
    corroboration: z.array(ListingSchema),
    sources: z.array(z.string()),
    priceSpread: z
      .object({ min: z.number(), max: z.number(), currency: z.string() })
      .strict(),
    directDeal: DirectDealSchema.optional(),
    rating: z.number().min(0).max(5).optional(),
    distanceToFocusMeters: z.number().optional(),
    tags: z.array(z.string()).default([]),
    /** machine flags the critic reads: "single_source", "price_mismatch", "stale_price"… */
    flags: z.array(z.string()).default([]),
  })
  .strict();
export type VerifiedOption = z.infer<typeof VerifiedOptionSchema>;

/** A verified option plus the persona-weighted score that ranked it. */
export const RankedOptionSchema = z
  .object({
    option: VerifiedOptionSchema,
    score: z.number(),
    /** per-axis contributions, for explainability. */
    breakdown: z
      .object({
        price: z.number(),
        quality: z.number(),
        location: z.number(),
        vibe: z.number(),
        verification: z.number(),
      })
      .strict(),
  })
  .strict();
export type RankedOption = z.infer<typeof RankedOptionSchema>;

// ---------------------------------------------------------------------------
// Booking (intent only — never executed autonomously)
// ---------------------------------------------------------------------------

export const BookingChannelSchema = z.enum(["web_deeplink", "phone_call", "email"]);
export type BookingChannel = z.infer<typeof BookingChannelSchema>;

/**
 * BookingIntent — a *prepared* booking or hotel call. Status is always `requires_approval`:
 * this package never completes a purchase, submits a form, or places a call on its own. The
 * intent is a hand-off to a human (or an approval-gated tool) with everything staged.
 */
export const BookingIntentSchema = z
  .object({
    entity: EntityRefSchema,
    channel: BookingChannelSchema,
    listing: ListingSchema,
    /** deep link for web_deeplink; phone number for phone_call. */
    target: z.string().optional(),
    /** for phone_call: what to ask the hotel (rate match, direct discount, availability). */
    callScript: z.array(z.string()).default([]),
    status: z.literal("requires_approval"),
    note: z.string(),
  })
  .strict();
export type BookingIntent = z.infer<typeof BookingIntentSchema>;

// ---------------------------------------------------------------------------
// Self-check + result
// ---------------------------------------------------------------------------

export const CriticSeveritySchema = z.enum(["blocker", "warning", "info"]);
export type CriticSeverity = z.infer<typeof CriticSeveritySchema>;

export const CriticIssueSchema = z
  .object({
    severity: CriticSeveritySchema,
    code: z.string(),
    message: z.string(),
    /** what the orchestrator should change on the next pass ("broaden_search", "relax_quality"). */
    remedy: z.string().optional(),
  })
  .strict();
export type CriticIssue = z.infer<typeof CriticIssueSchema>;

export const CriticReportSchema = z
  .object({
    passed: z.boolean(),
    issues: z.array(CriticIssueSchema),
  })
  .strict();
export type CriticReport = z.infer<typeof CriticReportSchema>;

/** One entry in the orchestration trace — an audit trail of who did what. */
export const TraceEventSchema = z
  .object({
    at: z.string(),
    agent: z.string(),
    event: z.string(),
    detail: z.record(z.unknown()).optional(),
  })
  .strict();
export type TraceEvent = z.infer<typeof TraceEventSchema>;

/** The whole deliverable: verified, ranked options per category + budget + staged bookings. */
export const PlanResultSchema = z
  .object({
    request: TripRequestSchema,
    persona: PersonaSchema,
    /** ranked, low-end-first, per listing kind. */
    options: z.record(z.array(RankedOptionSchema)),
    /** the single pick per kind the orchestrator would lead with. */
    selection: z.record(RankedOptionSchema),
    budget: BudgetSchema,
    bookingIntents: z.array(BookingIntentSchema),
    critic: CriticReportSchema,
    /** how many search→verify→match passes it took to satisfy the critic. */
    passes: z.number().int().min(1),
    trace: z.array(TraceEventSchema),
  })
  .strict();
export type PlanResult = z.infer<typeof PlanResultSchema>;
