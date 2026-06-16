import type {
  ClarifyQuestion,
  RefinementRecord,
  Trip,
  TripRequest,
  TripVersion,
} from "@wayfare/shared";
import { makeId } from "../ids.js";

/**
 * Session store + trip versioning. A session holds the evolving constraints and an ordered list
 * of trip versions (every refinement = a new version → "what changed" + future undo). MVP is an
 * in-memory implementation behind a pluggable interface (swap to Redis/Postgres at [Later]).
 */

export interface SessionRecord {
  id: string;
  createdAt: string;
  request: TripRequest;
  clarifyQuestions: ClarifyQuestion[];
  versions: TripVersion[];
}

export interface SessionStore {
  create(request: TripRequest, clarifyQuestions: ClarifyQuestion[]): SessionRecord;
  get(id: string): SessionRecord | undefined;
  setRequest(id: string, request: TripRequest): void;
  addVersion(id: string, trip: Trip, refinement?: RefinementRecord): TripVersion;
  currentVersion(id: string): TripVersion | undefined;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();
  private seq = 0;

  constructor(private readonly now: () => string) {}

  create(request: TripRequest, clarifyQuestions: ClarifyQuestion[]): SessionRecord {
    const id = makeId("sess", "session", this.seq++);
    const record: SessionRecord = {
      id,
      createdAt: this.now(),
      request,
      clarifyQuestions,
      versions: [],
    };
    this.sessions.set(id, record);
    return record;
  }

  get(id: string): SessionRecord | undefined {
    return this.sessions.get(id);
  }

  setRequest(id: string, request: TripRequest): void {
    const s = this.sessions.get(id);
    if (s) s.request = request;
  }

  addVersion(id: string, trip: Trip, refinement?: RefinementRecord): TripVersion {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`session_not_found: ${id}`);
    const version: TripVersion = {
      version: s.versions.length + 1,
      trip,
      createdAt: this.now(),
      ...(refinement ? { refinement } : {}),
    };
    s.versions.push(version);
    return version;
  }

  currentVersion(id: string): TripVersion | undefined {
    const s = this.sessions.get(id);
    return s?.versions[s.versions.length - 1];
  }
}
