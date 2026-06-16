import { z } from "zod";
import { TripSchema } from "./trip.js";
import { TripRequestSchema } from "./request.js";
import { ItemDiffSchema, RefinementScopeSchema } from "./refinement.js";

/**
 * Session & versioning. A Session holds the whole conversation and an ordered list of
 * TripVersions (every refinement = a new version → "what changed" + undo). See
 * DATA_MODEL.md "Session & versioning".
 */

/** The full refinement record stored on a non-initial TripVersion. */
export const RefinementRecordSchema = z
  .object({
    /** what the user said. */
    utterance: z.string(),
    scope: RefinementScopeSchema,
    /** changed items vs previous version. */
    diff: z.array(ItemDiffSchema),
    /** signed, in trip currency. */
    budgetDelta: z.number(),
  })
  .strict();
export type RefinementRecord = z.infer<typeof RefinementRecordSchema>;

export const TripVersionSchema = z
  .object({
    /** 1, 2, 3… */
    version: z.number().int().min(1),
    trip: TripSchema,
    createdAt: z.string(),
    /** absent for v1 (initial plan). */
    refinement: RefinementRecordSchema.optional(),
  })
  .strict();
export type TripVersion = z.infer<typeof TripVersionSchema>;

export const SessionSchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    /** evolving constraints (prompt + answers merged). */
    request: TripRequestSchema,
    /** ordered; last = current. */
    versions: z.array(TripVersionSchema),
  })
  .strict();
export type Session = z.infer<typeof SessionSchema>;
