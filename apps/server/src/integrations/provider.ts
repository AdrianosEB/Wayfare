import { z } from "zod";
import type { Flight, Stay, Activity } from "@wayfare/shared";

/**
 * The internal pricing interface — the ENTIRE contract between the agent and the world's
 * prices (INTEGRATIONS.md). The agent never talks to a provider directly; it calls these.
 * Every method returns `Listing`-wrapped results. `computeBudget` is deterministic and NOT a
 * provider method — it sums Listings locally (see ../agent/budget.ts).
 */

export const FlightQuerySchema = z
  .object({
    origin: z.string(),
    destination: z.string(),
    departDate: z.string(),
    returnDate: z.string(),
    dateFlexibility: z.enum(["fixed", "window", "very_flexible"]),
    adults: z.number().int().min(1),
    children: z.number().int().min(0).optional(),
    maxStops: z.number().int().min(0).optional(),
    cabin: z.enum(["economy", "premium", "business"]).optional(),
  })
  .strict();
export type FlightQuery = z.infer<typeof FlightQuerySchema>;

export const StayQuerySchema = z
  .object({
    location: z.string(),
    checkIn: z.string(),
    checkOut: z.string(),
    guests: z.number().int().min(1),
    style: z.array(z.string()).optional(),
    maxNightly: z.number().optional(),
  })
  .strict();
export type StayQuery = z.infer<typeof StayQuerySchema>;

export const ActivityQuerySchema = z
  .object({
    location: z.string(),
    date: z.string().optional(),
    interests: z.array(z.string()),
    partySize: z.number().int().min(1),
    kidFriendly: z.boolean().optional(),
    maxPrice: z.number().optional(),
  })
  .strict();
export type ActivityQuery = z.infer<typeof ActivityQuerySchema>;

export interface PricingProvider {
  readonly name: string;
  searchFlights(q: FlightQuery): Promise<Flight[]>;
  searchStays(q: StayQuery): Promise<Stay[]>;
  searchActivities(q: ActivityQuery): Promise<Activity[]>;
}
