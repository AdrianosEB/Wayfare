import { z } from "zod";

/**
 * Shared primitives used across the whole contract.
 *
 * Money is always major units (e.g. 2410.0 EUR), never "cents". See API_CONTRACT.md
 * "Currency & money". Timestamps are ISO-8601 UTC strings. IDs are opaque strings.
 */

/** `{ amount, currency }` — major-unit money, ISO-4217 currency. */
export const MoneySchema = z
  .object({
    amount: z.number(),
    currency: z.string(),
  })
  .strict();
export type Money = z.infer<typeof MoneySchema>;

/**
 * Where a tracked constraint value came from.
 * See DATA_MODEL.md `FieldSource` / CONVERSATION_FLOW.md §1.
 */
export const FieldSourceSchema = z.enum([
  "prompt",
  "answer",
  "default",
  "inferred",
]);
export type FieldSource = z.infer<typeof FieldSourceSchema>;

/**
 * `Tracked<T>` — a constraint value plus its provenance and confidence.
 * Lets the conversation layer ask only for what's missing and reveal every assumption.
 */
export const TrackedSchema = <T extends z.ZodTypeAny>(value: T) =>
  z
    .object({
      value,
      source: FieldSourceSchema,
      confidence: z.number().min(0).max(1),
    })
    .strict();

export interface Tracked<T> {
  value: T;
  source: FieldSource;
  confidence: number;
}
