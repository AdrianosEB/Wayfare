import { z } from "zod";

/**
 * Auth contract (email + password). See docs/AUTH_CONTRACT.md.
 *
 * Auth is optional: the planner works fully for guests. These shapes cover signup, login,
 * logout and me. `User` is the only user representation on the wire and has no password or
 * hash field.
 */

export const UserSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().min(1).max(80).optional(),
    /** ISO-8601 UTC. */
    createdAt: z.string(),
  })
  .strict();
export type User = z.infer<typeof UserSchema>;

// Requests

/** POST /api/auth/signup */
export const SignupRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(200),
    name: z.string().min(1).max(80).optional(),
  })
  .strict();
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

/** POST /api/auth/login */
export const LoginRequestSchema = z
  .object({
    email: z.string().email(),
    // min(1) only: login must not reveal the password policy.
    password: z.string().min(1).max(200),
  })
  .strict();
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// Responses

/** signup (201) and login (200) both return the authenticated user + set the session cookie. */
export const AuthResponseSchema = z.object({ user: UserSchema }).strict();
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * GET /api/auth/me. `user: null` means guest and is still a 200, not an error. The client
 * calls this on load to hydrate auth state.
 */
export const MeResponseSchema = z
  .object({ user: UserSchema.nullable() })
  .strict();
export type MeResponse = z.infer<typeof MeResponseSchema>;

// Auth error codes

/**
 * These extend the planner's ErrorCode (./api) and use the same `{ error: { code, message } }`
 * envelope. `invalid_credentials` covers both "unknown email" and "wrong password" to avoid
 * account enumeration.
 */
export const AUTH_ERROR_CODES = [
  "email_taken", // 409: signup with an email that already exists
  "invalid_credentials", // 401: login failed (unknown email or wrong password; never distinguish)
  "unauthenticated", // 401: a protected route hit without a valid session (not planner routes)
] as const;
export const AuthErrorCodeSchema = z.enum(AUTH_ERROR_CODES);
export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>;
