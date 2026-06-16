import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  SessionCreateResponseSchema,
  TripSchema,
  BudgetSchema,
  RefinementRecordSchema,
  StatusEventDataSchema,
  PartialEventDataSchema,
  AssumptionEventDataSchema,
} from "../src/index.js";

/**
 * Golden conformance tests. The fixtures in ./fixtures mirror docs/fixtures/ verbatim and
 * are kept in lockstep with API_CONTRACT.md. If a schema drifts from the wire contract,
 * these fail.
 *
 * Note: refine-complete.json and the `complete` event inside sse-stream.example.txt are
 * deliberately ABBREVIATED in the source docs (their own notes say only the changed slice
 * is shown; the real payload carries the full Trip). So we validate the full-shape fixtures
 * (trip-complete, session-create) strictly, and the abbreviated ones at the granularity the
 * docs actually pin down.
 */

const dir = dirname(fileURLToPath(import.meta.url));
const readFixture = (name: string) =>
  readFileSync(join(dir, "fixtures", name), "utf8");
const readJson = (name: string) => JSON.parse(readFixture(name));

describe("session-create.response.json", () => {
  it("matches SessionCreateResponseSchema exactly (strict)", () => {
    const data = readJson("session-create.response.json");
    expect(() => SessionCreateResponseSchema.parse(data)).not.toThrow();
  });

  it("carries origin: null as a known-missing required field", () => {
    const parsed = SessionCreateResponseSchema.parse(
      readJson("session-create.response.json"),
    );
    expect(parsed.extracted.origin).toBeNull();
    expect(parsed.clarifyQuestions[0]?.id).toBe("origin");
  });
});

describe("trip-complete.json", () => {
  it("the full trip matches TripSchema exactly (strict)", () => {
    const { trip, version } = readJson("trip-complete.json");
    expect(() => TripSchema.parse(trip)).not.toThrow();
    expect(version).toBe(1);
  });

  it("budget total equals the sum of its lines (derived, honest)", () => {
    const { trip } = readJson("trip-complete.json");
    const parsed = TripSchema.parse(trip);
    const sum = parsed.budget.lines.reduce((a, l) => a + l.amount, 0);
    expect(sum).toBe(parsed.budget.total);
  });

  it("every listing carries source + freshness (price transparency)", () => {
    const { trip } = readJson("trip-complete.json");
    const parsed = TripSchema.parse(trip);
    const listings = [
      ...parsed.itinerary.flights.map((f) => f.listing),
      ...parsed.itinerary.stays.map((s) => s.listing),
      ...parsed.itinerary.days.flatMap((d) =>
        d.items.map((i) => i.listing).filter((l) => l != null),
      ),
    ];
    expect(listings.length).toBeGreaterThan(0);
    for (const l of listings) {
      expect(l!.source.provider).toBeTruthy();
      expect(l!.freshness).toBe("mock");
    }
  });
});

describe("refine-complete.json (abbreviated by design)", () => {
  it("refinement record matches RefinementRecordSchema (strict)", () => {
    const data = readJson("refine-complete.json");
    expect(() => RefinementRecordSchema.parse(data.refinement)).not.toThrow();
    expect(data.version).toBe(2);
  });

  it("the changed-slice budget matches BudgetSchema (strict)", () => {
    const data = readJson("refine-complete.json");
    const budget = BudgetSchema.parse(data.trip.budget);
    expect(budget.status).toBe("over");
    expect(budget.overageNote).toBeTruthy();
  });
});

describe("sse-stream.example.txt", () => {
  type RawEvent = { event: string; data: unknown };

  const parseSse = (raw: string): RawEvent[] => {
    const events: RawEvent[] = [];
    let event: string | null = null;
    let data: string | null = null;
    const flush = () => {
      if (event && data != null) events.push({ event, data: JSON.parse(data) });
      event = null;
      data = null;
    };
    for (const line of raw.split("\n")) {
      if (line.startsWith(":")) continue; // heartbeat/comment
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data = line.slice(5).trim();
      else if (line.trim() === "") flush();
    }
    flush();
    return events;
  };

  const events = parseSse(readFixture("sse-stream.example.txt"));

  it("parses the documented event sequence", () => {
    const names = events.map((e) => e.event);
    expect(names).toEqual([
      "status",
      "status",
      "partial",
      "status",
      "partial",
      "status",
      "assumption",
      "status",
      "partial",
      "complete",
    ]);
  });

  it("status / partial / assumption events match their schemas (strict)", () => {
    for (const e of events) {
      if (e.event === "status")
        expect(() => StatusEventDataSchema.parse(e.data)).not.toThrow();
      if (e.event === "partial")
        expect(() => PartialEventDataSchema.parse(e.data)).not.toThrow();
      if (e.event === "assumption")
        expect(() => AssumptionEventDataSchema.parse(e.data)).not.toThrow();
    }
  });

  it("the terminal complete event carries a trip + version", () => {
    const complete = events.at(-1)!;
    expect(complete.event).toBe("complete");
    const d = complete.data as { trip: unknown; version: number };
    expect(d.trip).toBeTruthy();
    expect(d.version).toBe(1);
  });
});
