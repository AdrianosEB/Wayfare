# Auth Contract (frozen)

Email + password accounts for Wayfare. **Guest mode is the default and is fully functional** —
the landing page and the whole planner (prompt → clarify → itinerary → refine) work with **no
account**. Auth only personalizes the TopBar. Nothing in the existing flow is gated behind login.

Types live in `@wayfare/shared` (auth) and are imported by the web client via the `@/types`
barrel: `User`, `SignupRequest`, `LoginRequest`, `AuthResponse`, `MeResponse`. Until the backend
session authors `packages/shared/src/auth.ts`, the web client carries a local mirror at
`apps/web/src/types/auth.ts` re-exported through `@/types`.

## Session

The session is a server-set **httpOnly cookie**. The client never reads or stores it — every
auth call uses `fetch(..., { credentials: 'include' })`. There is no token in any response body.

## Endpoints (all under `/api`)

### POST `/api/auth/signup`
- Body: `SignupRequest` `{ email, password, name }`
- 200 → `AuthResponse` `{ user }` and sets the session cookie.
- 409 → `ApiError` when the email is already registered (UI: "That email is already registered").
- 400 → `ApiError` for invalid email / weak password.

### POST `/api/auth/login`
- Body: `LoginRequest` `{ email, password }`
- 200 → `AuthResponse` `{ user }` and sets the session cookie.
- 401 → `ApiError` for bad credentials (UI: "Invalid email or password").

### POST `/api/auth/logout`
- Body: none. Clears the session cookie.
- 200 → `{ ok: true }`. Idempotent — safe to call as a guest.

### GET `/api/auth/me`
- 200 → `MeResponse` `{ user: User | null }`. **A guest is `user: null` at 200**, never an error.
- Called exactly once on app mount to hydrate the session.

## Errors

Auth errors use the same envelope as the rest of the wire (`ApiError` in `@wayfare/shared`):
`{ error: { code, message, details? } }`. The client surfaces `error.message` inline; for the two
common cases (409 signup conflict, 401 bad login) it shows the friendly copy above.

## Validation (client-side, before submit)

- Email: non-empty, matches a basic email shape.
- Password: ≥ 8 characters.
- Name (signup only): non-empty.

Server validation is authoritative; client validation only avoids obviously-bad round trips.
