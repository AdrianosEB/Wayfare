/**
 * Email + password auth module (docs/AUTH_CONTRACT.md). Additive to the planner — never gates
 * the guest `/api/session*` routes.
 */
export {
  createAuthRouter,
  createInMemoryAuthDeps,
  currentUser,
  type AuthDeps,
} from "./routes.js";
export {
  InMemoryUserStore,
  toWireUser,
  normalizeEmail,
  type UserStore,
  type UserRecord,
  type NewUser,
} from "./userStore.js";
export {
  InMemoryAuthSessionStore,
  type AuthSessionStore,
} from "./sessionStore.js";
export { hashPassword, verifyPassword } from "./password.js";
export {
  SESSION_COOKIE,
  readSessionCookie,
  setSessionCookie,
  clearSessionCookie,
} from "./cookies.js";
