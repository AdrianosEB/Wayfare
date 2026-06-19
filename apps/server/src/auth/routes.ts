import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";
import { z } from "zod";
import {
  LoginRequestSchema,
  SignupRequestSchema,
  type AuthResponse,
  type MeResponse,
  type User,
} from "@wayfare/shared";
import { emailTaken, invalid, invalidCredentials } from "../errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  InMemoryUserStore,
  normalizeEmail,
  toWireUser,
  type UserStore,
} from "./userStore.js";
import {
  InMemoryAuthSessionStore,
  type AuthSessionStore,
} from "./sessionStore.js";
import {
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from "./cookies.js";

/**
 * Email + password auth (docs/AUTH_CONTRACT.md). Factory form, mirroring createSessionRouter,
 * so tests inject fresh stores. Additive only — never gates the planner routes.
 */

export interface AuthDeps {
  users: UserStore;
  sessions: AuthSessionStore;
  now: () => string;
}

/** Convenience builder for the default in-memory wiring. */
export function createInMemoryAuthDeps(now: () => string): AuthDeps {
  return {
    users: new InMemoryUserStore(now),
    sessions: new InMemoryAuthSessionStore(),
    now,
  };
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw invalid("Request body failed validation.", r.error.issues);
  return r.data;
}

const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/**
 * Resolve the authenticated user from the request cookie, or null for a guest.
 * Never throws — guests are a first-class, valid state.
 */
export function currentUser(req: Request, deps: AuthDeps): User | null {
  const sessionId = readSessionCookie(req);
  if (!sessionId) return null;
  const userId = deps.sessions.get(sessionId);
  if (!userId) return null;
  const rec = deps.users.findById(userId);
  return rec ? toWireUser(rec) : null;
}

export function createAuthRouter(deps: AuthDeps): Router {
  const router = Router();

  // POST /api/auth/signup
  router.post(
    "/auth/signup",
    wrap(async (req, res) => {
      const body = parseBody(SignupRequestSchema, req.body);
      const email = normalizeEmail(body.email);
      if (deps.users.findByEmail(email)) throw emailTaken();

      const passwordHash = await hashPassword(body.password);
      const rec = deps.users.create({
        email,
        passwordHash,
        ...(body.name === undefined ? {} : { name: body.name }),
      });

      const sessionId = deps.sessions.create(rec.id);
      setSessionCookie(res, sessionId);
      const response: AuthResponse = { user: toWireUser(rec) };
      res.status(201).json(response);
    }),
  );

  // POST /api/auth/login
  router.post(
    "/auth/login",
    wrap(async (req, res) => {
      const body = parseBody(LoginRequestSchema, req.body);
      const rec = deps.users.findByEmail(body.email);

      // No account enumeration: unknown email and wrong password are indistinguishable. We still
      // run a bcrypt compare on a dummy hash when the user is missing to keep timing similar.
      const hash = rec?.passwordHash ?? DUMMY_HASH;
      const ok = await verifyPassword(body.password, hash);
      if (!rec || !ok) throw invalidCredentials();

      const sessionId = deps.sessions.create(rec.id);
      setSessionCookie(res, sessionId);
      const response: AuthResponse = { user: toWireUser(rec) };
      res.status(200).json(response);
    }),
  );

  // POST /api/auth/logout — idempotent
  router.post("/auth/logout", (req, res) => {
    const sessionId = readSessionCookie(req);
    if (sessionId) deps.sessions.destroy(sessionId);
    clearSessionCookie(res);
    res.status(204).end();
  });

  // GET /api/auth/me — guest → { user: null }, never 401
  router.get("/auth/me", (req, res) => {
    const response: MeResponse = { user: currentUser(req, deps) };
    res.status(200).json(response);
  });

  return router;
}

/**
 * A fixed bcrypt hash of a random string, compared against on unknown-email logins so the
 * response timing of "unknown email" matches "wrong password". Value is non-secret.
 */
const DUMMY_HASH = "$2a$12$zaOmePSkE3hbCcOuuJ7DVe0wbsOQ3KSZAj5LMgi4KAdgU/jZRk0cK";
