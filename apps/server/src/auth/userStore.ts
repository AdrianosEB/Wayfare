import type { User } from "@wayfare/shared";
import { makeId } from "../ids.js";

/**
 * User store. Holds the *internal* user record — including `passwordHash`, which never crosses
 * the wire. In-memory Map keyed by lowercased email, behind an interface so it can swap to a DB
 * later (mirrors InMemorySessionStore). Use `toWireUser` to map a record to the public `User`.
 */

export interface UserRecord {
  id: string;
  email: string; // normalized (lowercased, trimmed)
  name?: string;
  passwordHash: string;
  createdAt: string;
}

export interface NewUser {
  email: string;
  name?: string;
  passwordHash: string;
}

export interface UserStore {
  /** Lookup by email (case-insensitive). */
  findByEmail(email: string): UserRecord | undefined;
  /** Lookup by id — used to resolve a session's userId back to a record. */
  findById(id: string): UserRecord | undefined;
  /** Insert a new user. Caller must check `findByEmail` first for email_taken. */
  create(user: NewUser): UserRecord;
}

/** Normalize an email for use as the store key (case-insensitive, trimmed). */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Map an internal record to the public wire `User` — explicitly drops `passwordHash`. */
export function toWireUser(rec: UserRecord): User {
  return {
    id: rec.id,
    email: rec.email,
    createdAt: rec.createdAt,
    ...(rec.name === undefined ? {} : { name: rec.name }),
  };
}

export class InMemoryUserStore implements UserStore {
  private readonly byEmail = new Map<string, UserRecord>();
  private readonly byId = new Map<string, UserRecord>();
  private seq = 0;

  constructor(private readonly now: () => string) {}

  findByEmail(email: string): UserRecord | undefined {
    return this.byEmail.get(normalizeEmail(email));
  }

  findById(id: string): UserRecord | undefined {
    return this.byId.get(id);
  }

  create(user: NewUser): UserRecord {
    const email = normalizeEmail(user.email);
    const rec: UserRecord = {
      id: makeId("user", "user", this.seq++),
      email,
      passwordHash: user.passwordHash,
      createdAt: this.now(),
      ...(user.name === undefined ? {} : { name: user.name }),
    };
    this.byEmail.set(email, rec);
    this.byId.set(rec.id, rec);
    return rec;
  }
}
