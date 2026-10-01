import { randomUUID } from "node:crypto";

/**
 * Auth session store: opaque sessionId → userId. In-memory behind an interface so it can move
 * to Redis or a DB. The sessionId is a random UUID, so the cookie carries no user data.
 */

export interface AuthSessionStore {
  /** Returns the new session id. */
  create(userId: string): string;
  /** The session's userId, or undefined if unknown. */
  get(sessionId: string): string | undefined;
  /** No-op if the session doesn't exist. */
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
