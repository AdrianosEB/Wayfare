import { randomUUID } from "node:crypto";

/**
 * Auth session store: opaque sessionId → userId. In-memory Map behind an interface (swap to
 * Redis/DB later). The sessionId is a random UUID — never the user id/email/JWT — so the cookie
 * value carries no information and can't be forged from user data.
 */

export interface AuthSessionStore {
  /** Create a session for a user, returning the opaque session id. */
  create(userId: string): string;
  /** Resolve a session id to its userId, or undefined if unknown. */
  get(sessionId: string): string | undefined;
  /** Remove a session. Idempotent — no-op if it doesn't exist. */
  destroy(sessionId: string): void;
}

export class InMemoryAuthSessionStore implements AuthSessionStore {
  private readonly byId = new Map<string, string>();

  create(userId: string): string {
    const sessionId = randomUUID();
    this.byId.set(sessionId, userId);
    return sessionId;
  }

  get(sessionId: string): string | undefined {
    return this.byId.get(sessionId);
  }

  destroy(sessionId: string): void {
    this.byId.delete(sessionId);
  }
}
