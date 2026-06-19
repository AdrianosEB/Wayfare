# AUTH_CONTRACT.md — email + password auth (frozen)

Additive, optional auth for Wayfare. Guests keep **full** access to the planner
(`/api/session*`); auth never gates those routes. Types + Zod live in
`packages/shared/src/auth.ts`, exported from `@wayfare/shared`.

## Wire types (`@wayfare/shared`)

```ts
User          = { id: string; email: string; name?: string; createdAt: string }   // no secrets
SignupRequest = { email: string; password: string (≥8); name?: string }
LoginRequest  = { email: string; password: string }
AuthResponse  = { user: User }          // 201 signup / 200 login
MeResponse    = { user: User | null }   // guest → null, never 401
AuthErrorCode = "email_taken" | "invalid_credentials" | "unauthenticated"
```

## Error codes → HTTP status

| code                  | status | when                                              |
| --------------------- | ------ | ------------------------------------------------- |
| `invalid_request`     | 400    | body fails Zod validation                         |
| `email_taken`         | 409    | signup with an existing email                     |
| `invalid_credentials` | 401    | login: unknown email **or** wrong password (same) |
| `unauthenticated`     | 401    | auth required, no/invalid session                 |

Errors use the uniform shape: `{ error: { code, message, details? } }`.

## Endpoints (`/api/auth`)

| method | path               | body            | success                       |
| ------ | ------------------ | --------------- | ----------------------------- |
| POST   | `/api/auth/signup` | `SignupRequest` | `201 { user }` + Set-Cookie   |
| POST   | `/api/auth/login`  | `LoginRequest`  | `200 { user }` + Set-Cookie   |
| POST   | `/api/auth/logout` | —               | `204`, clears cookie (idempotent) |
| GET    | `/api/auth/me`     | —               | `200 { user: User \| null }`  |

Login returns an **identical** `401 invalid_credentials` for unknown email and
wrong password — no account enumeration.

## Session cookie

`wf_session=<opaque id>` — `HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`
(30d); `Secure` only when `NODE_ENV=production`. The id is a random
`crypto.randomUUID()` — never the user id, email, or a JWT. Server-side the id
maps to a userId via an in-memory session store (swap to a DB later).

## Security invariants

- `passwordHash` / plaintext is **never** returned, logged, or serialized. The
  wire `User` has no password field; the server maps to it explicitly.
- Passwords hashed with bcrypt (`bcryptjs`, cost ≥ 10).
- Every body validated with the shared Zod schemas; malformed → `400 invalid_request`.
