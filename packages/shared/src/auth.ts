import { z } from "zod";

/**
 * Auth contract (email + password) — see docs/AUTH_CONTRACT.md.
 *
 * Auth is ADDITIVE and OPTIONAL: the planner works fully for guests. These shapes cover
 * signup / login / logout / me. Passwords NEVER appear in any response — the `User` shape is
 * the only user representation that crosses the wire, and it has no password/hash field.
 */

/* -------------------------------------------------------------------------- */
/* User (the only user representation on the wire — never includes a password) */
/* -------------------------------------------------------------------------- */

export const UserSchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    /** optional display name. */
    name: z.string().min(1).max(80).optional(),
    /** ISO-8601 UTC. */
    createdAt: z.string(),
  })
  .strict();
export type User = z.infer<typeof UserSchema>;

/* -------------------------------------------------------------------------- */
/* Requests                                                                   */
/* -------------------------------------------------------------------------- */

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
    // min(1) only — never reveal the real policy on login, just "invalid credentials".
    password: z.string().min(1).max(200),
  })
  .strict();
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/* -------------------------------------------------------------------------- */
/* Responses                                                                  */
/* -------------------------------------------------------------------------- */

/** signup (201) and login (200) both return the authenticated user + set the session cookie. */
export const AuthResponseSchema = z.object({ user: UserSchema }).strict();
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * GET /api/auth/me — current identity. `user: null` means guest (NOT an error: 200 OK).
 * The client calls this on load to hydrate auth state; guests get null and keep using the app.
 */
export const MeResponseSchema = z
  .object({ user: UserSchema.nullable() })
  .strict();
export type MeResponse = z.infer<typeof MeResponseSchema>;

/* -------------------------------------------------------------------------- */
/* Auth error codes (carried in the shared ApiError envelope, see ./api)      */
/* -------------------------------------------------------------------------- */

/**
 * These extend the planner's ErrorCode (./api). Auth endpoints return the SAME
 * `{ error: { code, message } }` envelope. `invalid_credentials` is deliberately used for
 * BOTH "unknown email" and "wrong password" to avoid account enumeration.
 */
export const AUTH_ERROR_CODES = [
  "email_taken", // 409 — signup with an email that already exists
  "invalid_credentials", // 401 — login failed (email unknown OR password wrong — never distinguish)
  "unauthenticated", // 401 — a protected route hit without a valid session (NOT planner routes)
] as const;
export const AuthErrorCodeSchema = z.enum(AUTH_ERROR_CODES);
export type AuthErrorCode = z.infer<typeof AuthErrorCodeSchema>;
