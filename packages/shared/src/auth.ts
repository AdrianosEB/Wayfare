import { z } from "zod";

/**
 * Email + password auth wire contract (docs/AUTH_CONTRACT.md).
 *
 * The wire `User` deliberately has NO password / passwordHash field — the server maps its
 * internal record to this shape explicitly so secrets can never leak over the wire.
 */

/* -------------------------------------------------------------------------- */
/* User (wire shape — no secrets)                                             */
/* -------------------------------------------------------------------------- */

export const UserSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
    createdAt: z.string(),
  })
  .strict();
export type User = z.infer<typeof UserSchema>;

/* -------------------------------------------------------------------------- */
/* Requests                                                                   */
/* -------------------------------------------------------------------------- */

export const SignupRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(200),
    name: z.string().min(1).max(120).optional(),
  })
  .strict();
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1).max(200),
  })
  .strict();
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/* -------------------------------------------------------------------------- */
/* Responses                                                                  */
/* -------------------------------------------------------------------------- */

/** 201 (signup) / 200 (login). */
export const AuthResponseSchema = z.object({ user: UserSchema }).strict();
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/** GET /api/auth/me — guest → `{ user: null }`, never 401. */
export const MeResponseSchema = z
  .object({ user: UserSchema.nullable() })
  .strict();
export type MeResponse = z.infer<typeof MeResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Error codes                                                                */
/* -------------------------------------------------------------------------- */

export const AuthErrorCodeSchema = z.enum([
  "email_taken", // 409 — signup with an existing email
  "invalid_credentials", // 401 — unknown email OR wrong password (no enumeration)
  "unauthenticated", // 401 — auth required but no/invalid session
]);
export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>;
