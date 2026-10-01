import type { User } from "@wayfare/shared";
import { makeId } from "../ids.js";

/**
 * User store. Records include `passwordHash`, which must never be sent to a client: use
 * `toWireUser` to get the public `User`. In-memory, behind an interface so it can move to a DB.
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
  /** Case-insensitive. */
  findByEmail(email: string): UserRecord | undefined;
  findById(id: string): UserRecord | undefined;
  /** Caller must check `findByEmail` first for email_taken. */
  create(user: NewUser): UserRecord;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** Public wire `User` for a record. Drops `passwordHash`. */
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
