import { z } from "zod";
import { TripSchema } from "./trip.js";
import { AssumptionSchema } from "./trip.js";
import { RefinementRecordSchema } from "./session.js";
import { ErrorCodeSchema } from "./api.js";

/**
 * SSE protocol — the streaming contract for POST /answers and /refine (API_CONTRACT.md
 * "SSE protocol"). Each event has a named `event:` and a single-line JSON `data:` payload.
 * The stream terminates in a `complete` event carrying the full Trip.
 */

/** The agent's progress step, surfaced in `status` events. */
export const AgentStepSchema = z.enum([
  "resolve",
  "search_flights",
  "search_stays",
  "search_activities",
  "compute_budget",
  "assemble",
]);
export type AgentStep = z.infer<typeof AgentStepSchema>;

/**
 * A `partial` patch is an RFC-7386-style shallow JSON-merge-patch against the working Trip;
 * arrays replace (no index merging). It is intentionally permissive — patches are for
 * perceived progress only; the `complete` event is authoritative. Don't validate working
 * state against this for correctness.
 */
export const TripPatchSchema = z.record(z.string(), z.unknown());
export type TripPatch = z.infer<typeof TripPatchSchema>;

/* ----- per-event data payloads ----- */

export const StatusEventDataSchema = z
  .object({ step: AgentStepSchema, message: z.string() })
  .strict();
export type StatusEventData = z.infer<typeof StatusEventDataSchema>;

export const PartialEventDataSchema = z
  .object({ patch: TripPatchSchema })
  .strict();
export type PartialEventData = z.infer<typeof PartialEventDataSchema>;

/** `assumption` data is exactly an Assumption (field/assumed/reason). */
export const AssumptionEventDataSchema = AssumptionSchema;
export type AssumptionEventData = z.infer<typeof AssumptionEventDataSchema>;

export const MessageEventDataSchema = z.object({ text: z.string() }).strict();
export type MessageEventData = z.infer<typeof MessageEventDataSchema>;

export const CompleteEventDataSchema = z
  .object({
    trip: TripSchema,
    version: z.number().int().min(1),
    /** present on a refine stream; carries the diff + budget delta. */
    refinement: RefinementRecordSchema.optional(),
  })
  .strict();
export type CompleteEventData = z.infer<typeof CompleteEventDataSchema>;

export const ErrorEventDataSchema = z
  .object({
    code: ErrorCodeSchema,
    message: z.string(),
    /** if true, the plan still completes with labeled estimates. */
    degraded: z.literal(true).optional(),
  })
  .strict();
export type ErrorEventData = z.infer<typeof ErrorEventDataSchema>;

/* ----- the discriminated event union ----- */

export const SSE_EVENT_NAMES = [
  "status",
  "partial",
  "assumption",
  "message",
  "complete",
  "error",
] as const;

export const SseEventNameSchema = z.enum(SSE_EVENT_NAMES);
export type SseEventName = z.infer<typeof SseEventNameSchema>;

/** A fully-typed `{ event, data }` pair, discriminated on `event`. */
export const SseEventSchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("status"), data: StatusEventDataSchema }).strict(),
  z.object({ event: z.literal("partial"), data: PartialEventDataSchema }).strict(),
  z
    .object({ event: z.literal("assumption"), data: AssumptionEventDataSchema })
    .strict(),
  z.object({ event: z.literal("message"), data: MessageEventDataSchema }).strict(),
  z
    .object({ event: z.literal("complete"), data: CompleteEventDataSchema })
    .strict(),
  z.object({ event: z.literal("error"), data: ErrorEventDataSchema }).strict(),
]);
export type SseEvent = z.infer<typeof SseEventSchema>;
