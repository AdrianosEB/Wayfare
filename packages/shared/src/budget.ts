import { z } from "zod";
import { FreshnessSchema } from "./listing.js";
import { BudgetTypeSchema } from "./request.js";
import { RefinementScopeSchema } from "./refinement.js";

/**
 * Budget — derived, categorized, honest. It is never free-floating: the total is the sum of
 * the chosen listings (computed by `compute_budget`, the only place totals are summed). See
 * DATA_MODEL.md "Budget" and AGENT_DESIGN.md.
 */

export const BudgetCategorySchema = z.enum([
  "flights",
  "stay",
  "activities",
  "transit",
  "food",
  "buffer",
]);
export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;

export const BudgetLineSchema = z
  .object({
    category: BudgetCategorySchema,
    amount: z.number(),
    /** Listing/Item ids that roll up here. */
    itemRefs: z.array(z.string()),
    /** worst-case freshness in this line (drives labeling). */
    freshness: FreshnessSchema,
  })
  .strict();
export type BudgetLine = z.infer<typeof BudgetLineSchema>;

export const SavingHintSchema = z
  .object({
    description: z.string(),
    /** signed; negative = saves money. */
    delta: z.number(),
    /** how acting on it would re-plan. */
    appliesTo: RefinementScopeSchema,
  })
  .strict();
export type SavingHint = z.infer<typeof SavingHintSchema>;

export const BudgetStatusSchema = z.enum(["under", "on_target", "over"]);
export type BudgetStatus = z.infer<typeof BudgetStatusSchema>;

export const BudgetSchema = z
  .object({
    currency: z.string(),
    /** from TripRequest. */
    target: z
      .object({ amount: z.number(), type: BudgetTypeSchema })
      .strict()
      .optional(),
    /** sum of lines. */
    total: z.number(),
    lines: z.array(BudgetLineSchema),
    status: BudgetStatusSchema,
    /** present when over a hard cap (US-4.3). */
    overageNote: z.string().optional(),
    /** surfaced tradeoffs (US-3.5). */
    savings: z.array(SavingHintSchema),
  })
  .strict();
export type Budget = z.infer<typeof BudgetSchema>;
