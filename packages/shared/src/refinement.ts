import { z } from "zod";

/**
 * Refinement scope + diffing. A refinement is classified into a scope (CONVERSATION_FLOW.md
 * §5 / AGENT_DESIGN.md "Partial re-planning") which determines what re-plans and what stays
 * frozen. The diff is what the UI uses to highlight exactly what changed.
 */

export const RefinementScopeSchema = z.enum([
  "budget_global",
  "lodging",
  "flights",
  "activity_day",
  "dates",
  "destination",
  "info",
]);
export type RefinementScope = z.infer<typeof RefinementScopeSchema>;

export const ItemDiffSchema = z
  .object({
    op: z.enum(["add", "remove", "replace"]),
    /** e.g. "itinerary.stays[0]", "days[4].items[2]". */
    path: z.string(),
    before: z.unknown().optional(),
    after: z.unknown().optional(),
    priceDelta: z.number().optional(),
  })
  .strict();
export type ItemDiff = z.infer<typeof ItemDiffSchema>;
