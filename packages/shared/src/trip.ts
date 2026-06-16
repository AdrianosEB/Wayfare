import { z } from "zod";
import { ListingSchema } from "./listing.js";
import { PaceSchema, TripRequestSchema } from "./request.js";
import { BudgetSchema } from "./budget.js";

/**
 * Trip and its parts. Everything priced — Flight, Stay, Activity — wraps a Listing. The
 * Budget derives from those listings. See DATA_MODEL.md "Trip … Itinerary … Listing".
 */

export const GeoPointSchema = z
  .object({ lat: z.number(), lng: z.number(), name: z.string().optional() })
  .strict();
export type GeoPoint = z.infer<typeof GeoPointSchema>;

export const TravelerSchema = z
  .object({
    id: z.string(),
    type: z.enum(["adult", "child"]),
    /** for child pricing / activity suitability. */
    age: z.number().int().min(0).optional(),
  })
  .strict();
export type Traveler = z.infer<typeof TravelerSchema>;

/** distilled, normalized taste used by the ranker. */
export const PreferencesSchema = z
  .object({
    pace: PaceSchema,
    interests: z.array(z.string()),
    lodgingStyle: z.array(z.string()).optional(),
    flightPrefs: z
      .object({
        maxStops: z.number().int().min(0).optional(),
        preferredTimes: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    dietary: z.array(z.string()).optional(),
  })
  .strict();
export type Preferences = z.infer<typeof PreferencesSchema>;

/** a default the agent took (US-5.2). */
export const AssumptionSchema = z
  .object({ field: z.string(), assumed: z.string(), reason: z.string() })
  .strict();
export type Assumption = z.infer<typeof AssumptionSchema>;

export const ItineraryItemKindSchema = z.enum([
  "activity",
  "transit",
  "meal",
  "free",
]);
export type ItineraryItemKind = z.infer<typeof ItineraryItemKindSchema>;

export const ItineraryItemSchema = z
  .object({
    id: z.string(),
    kind: ItineraryItemKindSchema,
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    /** present when priced (activity/transit); absent for 'free'. */
    listing: ListingSchema.optional(),
    title: z.string(),
    location: GeoPointSchema.optional(),
    /** powers "near the beach" logic. */
    walkingFromPrev: z
      .object({ minutes: z.number(), meters: z.number() })
      .strict()
      .optional(),
    /** for family trips (Journey 3). */
    kidSuitable: z.boolean().optional(),
  })
  .strict();
export type ItineraryItem = z.infer<typeof ItineraryItemSchema>;

export const DaySchema = z
  .object({
    /** 1-based. */
    index: z.number().int().min(1),
    date: z.string(),
    title: z.string(),
    /** ordered through the day. */
    items: z.array(ItineraryItemSchema),
    notes: z.string().optional(),
  })
  .strict();
export type Day = z.infer<typeof DaySchema>;

export const FlightSchema = z
  .object({
    id: z.string(),
    listing: ListingSchema,
    direction: z.enum(["outbound", "return", "intra"]),
    /** airport codes / cities. */
    from: z.string(),
    to: z.string(),
    departISO: z.string(),
    arriveISO: z.string(),
    stops: z.number().int().min(0),
    carrier: z.string().optional(),
    bookingDeepLink: z.string().optional(),
  })
  .strict();
export type Flight = z.infer<typeof FlightSchema>;

export const StayTypeSchema = z.enum([
  "hotel",
  "hostel",
  "apartment",
  "aparthotel",
  "guesthouse",
]);
export type StayType = z.infer<typeof StayTypeSchema>;

export const StaySchema = z
  .object({
    id: z.string(),
    listing: ListingSchema,
    name: z.string(),
    type: StayTypeSchema,
    location: GeoPointSchema,
    checkIn: z.string(),
    checkOut: z.string(),
    nights: z.number().int().min(1),
    /** 0–5. */
    rating: z.number().min(0).max(5).optional(),
    amenities: z.array(z.string()).optional(),
    distanceToFocus: z
      .object({ label: z.string(), meters: z.number() })
      .strict()
      .optional(),
  })
  .strict();
export type Stay = z.infer<typeof StaySchema>;

/** the priced thing behind an 'activity' ItineraryItem. */
export const ActivitySchema = z
  .object({
    id: z.string(),
    listing: ListingSchema,
    /** 'boat_trip','museum','food_tour','free_walk'… */
    category: z.string(),
    durationMin: z.number().int().min(0),
    bookingRequired: z.boolean(),
  })
  .strict();
export type Activity = z.infer<typeof ActivitySchema>;

export const ItinerarySchema = z
  .object({
    /** concrete place the agent settled on ("Naxos, Greece"). */
    destinationResolved: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    /** outbound + return (+ intra legs at v1+). */
    flights: z.array(FlightSchema),
    /** ≥1; each spans a night range. */
    stays: z.array(StaySchema),
    /** length = durationDays. */
    days: z.array(DaySchema),
  })
  .strict();
export type Itinerary = z.infer<typeof ItinerarySchema>;

export const TripStatusSchema = z.enum(["planning", "complete", "degraded"]);
export type TripStatus = z.infer<typeof TripStatusSchema>;

export const TripSchema = z
  .object({
    id: z.string(),
    /** snapshot the plan was built against. */
    request: TripRequestSchema,
    travelers: z.array(TravelerSchema),
    preferences: PreferencesSchema,
    itinerary: ItinerarySchema,
    budget: BudgetSchema,
    /** one-line agent summary ("8 days on Naxos…"). */
    summary: z.string(),
    /** defaults the agent took (US-5.2). */
    assumptions: z.array(AssumptionSchema),
    /** degraded = some prices are fallbacks. */
    status: TripStatusSchema,
  })
  .strict();
export type Trip = z.infer<typeof TripSchema>;
