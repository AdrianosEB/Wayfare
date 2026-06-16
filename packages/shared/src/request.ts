import { z } from "zod";
import { TrackedSchema } from "./common.js";

/**
 * TripRequest — the structured output of prompt parsing + clarifying answers. Every field
 * tracks where it came from. Fields are both optional (not yet known) and nullable (the
 * parser can emit `origin: null` to mark a known-missing required field — see the
 * session-create fixture). See DATA_MODEL.md "TripRequest" and CONVERSATION_FLOW.md §1.
 */

export const DateFlexibilitySchema = z.enum(["fixed", "window", "very_flexible"]);
export type DateFlexibility = z.infer<typeof DateFlexibilitySchema>;

export const DatePartSchema = z.enum(["early", "mid", "late"]);
export type DatePart = z.infer<typeof DatePartSchema>;

export const TripDatesSchema = z
  .object({
    exact: z
      .object({ start: z.string(), end: z.string() })
      .strict()
      .optional(),
    month: z.number().int().min(1).max(12).optional(),
    part: DatePartSchema.optional(),
    season: z.string().optional(),
    flexibility: DateFlexibilitySchema,
  })
  .strict();
export type TripDates = z.infer<typeof TripDatesSchema>;

export const PartySizeSchema = z
  .object({
    adults: z.number().int().min(1),
    children: z.number().int().min(0).optional(),
    childAges: z.array(z.number().int().min(0)).optional(),
  })
  .strict();
export type PartySize = z.infer<typeof PartySizeSchema>;

export const BudgetTypeSchema = z.enum(["hard", "soft"]);
export type BudgetType = z.infer<typeof BudgetTypeSchema>;

export const BudgetConstraintSchema = z
  .object({
    amount: z.number(),
    currency: z.string(),
    type: BudgetTypeSchema,
  })
  .strict();
export type BudgetConstraint = z.infer<typeof BudgetConstraintSchema>;

export const PaceSchema = z.enum(["relaxed", "moderate", "packed"]);
export type Pace = z.infer<typeof PaceSchema>;

/** optional + nullable: a field may be absent or explicitly `null` to mark it known-missing. */
const tracked = <T extends z.ZodTypeAny>(value: T) =>
  TrackedSchema(value).nullish();

export const TripRequestSchema = z
  .object({
    destination: tracked(z.string()),
    origin: tracked(z.string()),
    durationDays: tracked(z.number()),
    dates: tracked(TripDatesSchema),
    partySize: tracked(PartySizeSchema),
    budget: tracked(BudgetConstraintSchema),
    vibe: tracked(z.array(z.string())),
    pace: tracked(PaceSchema),
    mustHaves: tracked(z.array(z.string())),
    avoid: tracked(z.array(z.string())),
  })
  .strict();
export type TripRequest = z.infer<typeof TripRequestSchema>;

/**
 * ClarifyQuestion — frozen shape (API_CONTRACT.md §1). The selector asks at most 4,
 * leverage-ranked, every one skippable with a stated default.
 */
export const ClarifyFormatSchema = z.enum([
  "chips",
  "multiselect",
  "stepper",
  "city",
  "text",
  "currency",
]);
export type ClarifyFormat = z.infer<typeof ClarifyFormatSchema>;

export const ClarifyOptionSchema = z
  .object({ value: z.string(), label: z.string() })
  .strict();
export type ClarifyOption = z.infer<typeof ClarifyOptionSchema>;

export const ClarifyQuestionSchema = z
  .object({
    /** stable id from the catalogue, e.g. "origin", "vibe_dest". */
    id: z.string(),
    question: z.string(),
    format: ClarifyFormatSchema,
    /** for chips/multiselect. */
    options: z.array(ClarifyOptionSchema).optional(),
    skippable: z.boolean(),
    /** human description of the assumption taken on skip. */
    skipDefault: z.string().optional(),
    /** for text/city/currency. */
    placeholder: z.string().optional(),
  })
  .strict();
export type ClarifyQuestion = z.infer<typeof ClarifyQuestionSchema>;
