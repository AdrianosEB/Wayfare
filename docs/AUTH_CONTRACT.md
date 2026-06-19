# Auth Contract (frozen) — email + password, guest-optional

The wire contract for accounts. Types live in `@wayfare/shared` (`auth.ts`); both apps import
them via `@/types` (web) / `@wayfare/shared` (server). **Auth is additive and optional — the
planner works fully for guests. Nothing in the existing planner flow is gated.**

## Non-negotiables (security)

- **Passwords are hashed with bcrypt** (cost ≥ 10). Never store, log, or return a plaintext
  password or its hash. The `User` shape on the wire has **no** password field.
- **Session = httpOnly cookie.** On signup/login the server sets `wf_session=<opaque id>`:
  `HttpOnly; SameSite=Lax; Path=/; Max-Age=<~30d>; Secure` (Secure in production only). The
  cookie holds an opaque, cryptographically-random session id (`crypto.randomUUID()` /
  `randomBytes`) — never the user id, email, or a JWT the client can read.
- **No account enumeration.** Login failure returns `invalid_credentials` whether the email
  is unknown or the password is wrong — identical response, identical timing where practical.
- **Validation at the boundary** with the Zod schemas from `@wayfare/shared`.
- The client sends `credentials: 'include'` on every auth + planner request so the cookie
  rides along.

## Endpoints

| Method · Path | Request (`@wayfare/shared`) | Success | Errors (`ApiError` envelope) |
|---|---|---|---|
| `POST /api/auth/signup` | `SignupRequest` `{ email, password, name? }` | `201` `AuthResponse` `{ user }` + `Set-Cookie` | `400 invalid_request`, `409 email_taken` |
| `POST /api/auth/login` | `LoginRequest` `{ email, password }` | `200` `AuthResponse` `{ user }` + `Set-Cookie` | `400 invalid_request`, `401 invalid_credentials` |
| `POST /api/auth/logout` | — | `204` + cookie cleared (idempotent) | — |
| `GET /api/auth/me` | — | `200` `MeResponse` `{ user: User \| null }` | — |

- **`User`** = `{ id, email, name?, createdAt }` — never a password.
- **`GET /me` is the hydration call.** Guests get `{ user: null }` with `200` (NOT 401). The
  client calls it on load to learn who it is; null → stay in guest mode.
- Errors use the shared `ApiError` envelope: `{ error: { code, message, details? } }` with the
  codes above (added to the shared `ErrorCode` enum).

## Guest mode (the default)

- All planner endpoints (`/api/session*`) remain **open** — no auth check, no change.
- A guest is simply "no valid session cookie." `GET /me` → `{ user: null }`.
- Logging in associates a session with the browser but does **not** (this phase) gate or
  change any planner behavior. Saving trips to an account is a later phase.

## Backend shape (apps/server)

- `auth/` module: `userStore` (in-memory `Map<email, {id,email,name?,passwordHash,createdAt}>`,
  behind an interface so it swaps to a DB later — mirrors the existing session store),
  `sessionStore` (`Map<sessionId, userId>`), bcrypt hashing, cookie read/write.
- Cookie parsing: add `cookie-parser` (Express) or `@fastify/cookie` (Fastify) — whichever the
  server already uses. Add `bcryptjs` (pure-JS, no native build) or `bcrypt`.
- Routes mounted under `/api/auth/*`. A small `currentUser(req)` helper reads the cookie →
  session → user (returns null for guests); `/me` uses it. Do **not** add auth middleware to
  planner routes.
- Tests: signup→me→logout→me cycle, duplicate-email 409, wrong-password 401, guest `/me` null,
  password never present in any response body.

## Frontend shape (apps/web)

- **Auth store** (Zustand, e.g. `store/auth.ts`): `{ user, status, hydrate(), signup(), login(),
  logout() }`. Call `hydrate()` (GET `/me`) once on app mount.
- **UI (azure design system):** an accessible **AuthModal** opened from the TopBar.
  - Logged out → TopBar shows **"Log in"** (ghost) + **"Sign up"** (azure) ; modal toggles
    between login / signup, shows inline field errors, and a clear close / "Maybe later" so it
    **never blocks** using the app.
  - Logged in → TopBar shows an avatar/initial menu with name/email + **"Log out."**
  - `credentials: 'include'` on all fetches.
- **MSW mocks** for the 4 endpoints (so the web app works in mock mode): an in-memory fake user
  list + a fake session flag; conform to the schemas above.
- Guest is the default and fully functional; auth state just personalizes the TopBar.

## Conformance

- Server responses and request bodies validate against the `@wayfare/shared` Zod schemas.
- Neither app redefines auth shapes locally. Contract changes go here + `@wayfare/shared` first.
