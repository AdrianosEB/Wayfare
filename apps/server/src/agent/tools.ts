import {
  FlightSchema,
  StaySchema,
  ActivitySchema,
  type Flight,
  type Stay,
  type Activity,
  type Budget,
} from "@wayfare/shared";
import { z } from "zod";
import {
  FlightQuerySchema,
  StayQuerySchema,
  ActivityQuerySchema,
  type PricingProvider,
} from "../integrations/provider.js";
import { computeBudget, ComputeBudgetInputSchema } from "./budget.js";

/**
 * The entire toolset: four read/compute tools, no write/booking tools (least privilege,
 * AGENT_DESIGN.md). Each is Zod-validated on input AND output. The same Toolbox backs both the
 * deterministic planner and the Anthropic tool-use loop, so they are interchangeable.
 */
export class Toolbox {
  constructor(private readonly provider: PricingProvider) {}

  async searchFlights(input: unknown): Promise<Flight[]> {
    const q = FlightQuerySchema.parse(input);
    const out = await this.provider.searchFlights(q);
    return z.array(FlightSchema).parse(out);
  }

  async searchStays(input: unknown): Promise<Stay[]> {
    const q = StayQuerySchema.parse(input);
    const out = await this.provider.searchStays(q);
    return z.array(StaySchema).parse(out);
  }

  async searchActivities(input: unknown): Promise<Activity[]> {
    const q = ActivityQuerySchema.parse(input);
    const out = await this.provider.searchActivities(q);
    return z.array(ActivitySchema).parse(out);
  }

  computeBudget(input: unknown): Budget {
    const i = ComputeBudgetInputSchema.parse(input);
    return computeBudget(i);
  }

  /** Dispatch by tool name (used by the Anthropic loop). */
  async dispatch(name: string, input: unknown): Promise<unknown> {
    switch (name) {
      case "search_flights":
        return this.searchFlights(input);
      case "search_stays":
        return this.searchStays(input);
      case "search_activities":
        return this.searchActivities(input);
      case "compute_budget":
        return this.computeBudget(input);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

/** Anthropic tool definitions (name + description + JSON Schema). Booking/payment are absent. */
export const ANTHROPIC_TOOLS = [
  {
    name: "search_flights",
    description:
      "Search round-trip flight options. Returns Listing-wrapped flights as consecutive [outbound, return] pairs, cheapest first. Read-only; never books.",
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "string" },
        destination: { type: "string" },
        departDate: { type: "string", description: "YYYY-MM-DD" },
        returnDate: { type: "string", description: "YYYY-MM-DD" },
        dateFlexibility: { type: "string", enum: ["fixed", "window", "very_flexible"] },
        adults: { type: "integer", minimum: 1 },
        children: { type: "integer", minimum: 0 },
        maxStops: { type: "integer", minimum: 0 },
        cabin: { type: "string", enum: ["economy", "premium", "business"] },
      },
      required: ["origin", "destination", "departDate", "returnDate", "dateFlexibility", "adults"],
    },
  },
  {
    name: "search_stays",
    description:
      "Search accommodation for a date range. Returns Listing-wrapped stays. Read-only.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string" },
        checkIn: { type: "string", description: "YYYY-MM-DD" },
        checkOut: { type: "string", description: "YYYY-MM-DD" },
        guests: { type: "integer", minimum: 1 },
        style: { type: "array", items: { type: "string" } },
        maxNightly: { type: "number" },
      },
      required: ["location", "checkIn", "checkOut", "guests"],
    },
  },
  {
    name: "search_activities",
    description:
      "Search activities/experiences for a destination, filtered by interests. Returns Listing-wrapped activities (many free options). Read-only.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        interests: { type: "array", items: { type: "string" } },
        partySize: { type: "integer", minimum: 1 },
        kidFriendly: { type: "boolean" },
        maxPrice: { type: "number" },
      },
      required: ["location", "interests", "partySize"],
    },
  },
  {
    name: "compute_budget",
    description:
      "Sum the chosen listings into a categorized budget vs the target. The ONLY way to total costs — never sum prices yourself.",
    input_schema: {
      type: "object",
      properties: {
        items: { type: "array", items: { type: "object" }, description: "the chosen Listings" },
        currency: { type: "string" },
        target: {
          type: "object",
          properties: { amount: { type: "number" }, type: { type: "string", enum: ["hard", "soft"] } },
        },
        nights: { type: "integer", minimum: 1 },
        partySize: { type: "integer", minimum: 1 },
        tier: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["items", "currency", "nights", "partySize", "tier"],
    },
  },
] as const;
