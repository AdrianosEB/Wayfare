/**
 * Email + password auth wire types — the frozen AUTH_CONTRACT (see docs/AUTH_CONTRACT.md).
 *
 * These mirror what `@wayfare/shared` will export once the backend session authors
 * `packages/shared/src/auth.ts`. They are surfaced through the `@/types` barrel so every
 * component imports auth shapes from `@/types` — never from a local mirror. When shared
 * ships the canonical versions, this file collapses to a re-export and nothing else changes.
 *
 * Guest mode is the default: a `null` user is a fully-functional, unauthenticated visitor.
 * Auth only personalizes the TopBar; it never gates the planner.
 */

/** A registered Wayfare account. */
export interface User {
  id: string;
  email: string;
  /** Display name chosen at signup; may be empty. */
  name: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** POST /api/auth/signup body. */
export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

/** POST /api/auth/login body. */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Response from POST /api/auth/signup and POST /api/auth/login.
 * The session itself is carried by an httpOnly cookie (credentials: 'include'); the body
 * returns the authenticated user.
 */
export interface AuthResponse {
  user: User;
}

/**
 * Response from GET /api/auth/me.
 * `user` is `null` for a guest (no/invalid session) — a 200, not an error.
 */
export interface MeResponse {
  user: User | null;
}
