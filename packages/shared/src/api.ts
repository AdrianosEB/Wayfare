import { z } from "zod";
import { MoneySchema } from "./common.js";
import {
  ClarifyQuestionSchema,
  PartySizeSchema,
  TripRequestSchema,
} from "./request.js";
import { TripSchema } from "./trip.js";
import { RefinementScopeSchema } from "./refinement.js";

/**
 * HTTP request/response schemas for every endpoint in API_CONTRACT.md. These serialize to
 * exactly the JSON in docs/fixtures/. The SSE event schemas live in ./sse.
 */

/* -------------------------------------------------------------------------- */
/* Errors (uniform shape)                                                     */
/* -------------------------------------------------------------------------- */

export const ErrorCodeSchema = z.enum([
  "invalid_request", // 400 — body fails schema validation
  "session_not_found", // 404 — unknown sessionId
  "not_ready", // 409 — refine/answers called before a valid state
  "unplannable", // 422 — constraints contradictory/meaningless
  "rate_limited", // 429 — provider/agent budget exhausted
  "internal", // 500 — unexpected
  // --- auth (see ./auth) — same { error: { code, message } } envelope ---
  "email_taken", // 409 — signup email already exists
  "invalid_credentials", // 401 — login failed (email unknown OR wrong password; never distinguish)
  "unauthenticated", // 401 — protected route without a valid session (NOT planner routes)
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z
  .object({
    error: z
      .object({
        code: ErrorCodeSchema,
        message: z.string(),
        details: z.unknown().optional(),
      })
      .strict(),
  })
  .strict();
export type ApiError = z.infer<typeof ApiErrorSchema>;

/* -------------------------------------------------------------------------- */
/* 1. POST /api/session                                                       */
/* -------------------------------------------------------------------------- */

export const SessionCreateRequestSchema = z
  .object({ prompt: z.string().min(1) })
  .strict();
export type SessionCreateRequest = z.infer<typeof SessionCreateRequestSchema>;

export const SessionCreateResponseSchema = z
  .object({
    sessionId: z.string(),
    extracted: TripRequestSchema,
    clarifyQuestions: z.array(ClarifyQuestionSchema),
    agentMessage: z.string(),
  })
  .strict();
export type SessionCreateResponse = z.infer<typeof SessionCreateResponseSchema>;

/* -------------------------------------------------------------------------- */
/* 2. POST /api/session/:id/answers                                           */
/* -------------------------------------------------------------------------- */

/**
 * The value type of an answer follows the question's `format` (API_CONTRACT.md §2):
 *  - chips/city/text → string
 *  - multiselect     → string[]
 *  - stepper         → { adults, children?, childAges? }
 *  - currency        → { amount, currency }
 */
export const AnswerValueSchema = z.union([
  z.string(),
  z.array(z.string()),
  PartySizeSchema,
  MoneySchema,
]);
export type AnswerValue = z.infer<typeof AnswerValueSchema>;

export const AnswersRequestSchema = z
  .object({
    /** map of ClarifyQuestion.id → value. */
    answers: z.record(z.string(), AnswerValueSchema),
    /** question ids the user skipped (server applies skipDefault). */
    skipped: z.array(z.string()),
  })
  .strict();
export type AnswersRequest = z.infer<typeof AnswersRequestSchema>;

/* -------------------------------------------------------------------------- */
/* 3. POST /api/session/:id/refine                                            */
/* -------------------------------------------------------------------------- */

export const RefineRequestSchema = z
  .object({ utterance: z.string().min(1) })
  .strict();
export type RefineRequest = z.infer<typeof RefineRequestSchema>;

/* -------------------------------------------------------------------------- */
/* 4. GET /api/session/:id                                                    */
/* -------------------------------------------------------------------------- */

/** Lightweight per-version entry in the GET response (not the full TripVersion). */
export const VersionSummarySchema = z
  .object({
    version: z.number().int().min(1),
    createdAt: z.string(),
    refinement: z
      .object({ utterance: z.string(), scope: RefinementScopeSchema })
      .strict()
      .optional(),
  })
  .strict();
export type VersionSummary = z.infer<typeof VersionSummarySchema>;

export const SessionStateResponseSchema = z
  .object({
    sessionId: z.string(),
    request: TripRequestSchema,
    currentVersion: z.number().int().min(1),
    trip: TripSchema,
    versions: z.array(VersionSummarySchema),
  })
  .strict();
export type SessionStateResponse = z.infer<typeof SessionStateResponseSchema>;
