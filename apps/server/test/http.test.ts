import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { InMemorySessionStore } from "../src/session/store.js";
import { readFixture, NOW, YEAR } from "./helpers.js";

const CANONICAL =
  "I want a relaxed 8-day beach trip in Greece in late August for two people, around €2,500 total";

function app() {
  const now = () => NOW;
  return createApp({
    store: new InMemorySessionStore(now),
    now,
    year: YEAR,
    useAgent: false,
    model: "test",
  });
}

interface SseEvent { event: string; data: unknown }
function parseSse(raw: string): SseEvent[] {
  const events: SseEvent[] = [];
  let event: string | null = null;
  let data: string | null = null;
  for (const line of raw.split("\n")) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data = line.slice(5).trim();
    else if (line.trim() === "" && event && data != null) {
      events.push({ event, data: JSON.parse(data) });
      event = null;
      data = null;
    }
  }
  return events;
}

describe("HTTP API (API_CONTRACT.md)", () => {
  it("POST /api/session returns the fixture extraction + clarify questions", async () => {
    const res = await request(app()).post("/api/session").send({ prompt: CANONICAL });
    expect(res.status).toBe(200);
    const fixture = readFixture("session-create.response.json");
    expect(res.body.extracted).toEqual(fixture.extracted);
    expect(res.body.clarifyQuestions).toEqual(fixture.clarifyQuestions);
    expect(res.body.sessionId).toMatch(/^sess_/);
  });

  it("POST /api/session validates the body (400 invalid_request)", async () => {
    const res = await request(app()).post("/api/session").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_request");
  });

  it("GET unknown session → 404 session_not_found", async () => {
    const res = await request(app()).get("/api/session/sess_nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("session_not_found");
  });

  it("full flow: create → answers (SSE plan) → get → refine (SSE delta)", async () => {
    const a = app();

    const created = await request(a).post("/api/session").send({ prompt: CANONICAL });
    const id = created.body.sessionId;

    const answered = await request(a)
      .post(`/api/session/${id}/answers`)
      .send({ answers: { origin: "London", vibe_dest: "quieter" }, skipped: [] });
    expect(answered.status).toBe(200);
    expect(answered.headers["content-type"]).toMatch(/text\/event-stream/);
    const planEvents = parseSse(answered.text);
    expect(planEvents.map((e) => e.event)).toContain("complete");
    const complete = planEvents.find((e) => e.event === "complete")!.data as { trip: any; version: number };
    expect(complete.version).toBe(1);
    expect(complete.trip.budget.total).toBe(2410);

    const got = await request(a).get(`/api/session/${id}`);
    expect(got.status).toBe(200);
    expect(got.body.currentVersion).toBe(1);
    expect(got.body.trip.budget.total).toBe(2410);
    expect(got.body.versions).toHaveLength(1);

    const refined = await request(a)
      .post(`/api/session/${id}/refine`)
      .send({ utterance: "swap the hotel for something nearer the beach, and add a day trip to a quieter island" });
    expect(refined.status).toBe(200);
    const refineEvents = parseSse(refined.text);
    const rc = refineEvents.find((e) => e.event === "complete")!.data as {
      trip: any;
      version: number;
      refinement: { scope: string; budgetDelta: number };
    };
    expect(rc.version).toBe(2);
    expect(rc.refinement.scope).toBe("lodging");
    expect(rc.refinement.budgetDelta).toBe(145);
    expect(rc.trip.budget.total).toBe(2555);
  });

  it("refine before planning → 409 not_ready", async () => {
    const a = app();
    const created = await request(a).post("/api/session").send({ prompt: CANONICAL });
    const res = await request(a)
      .post(`/api/session/${created.body.sessionId}/refine`)
      .send({ utterance: "make it cheaper" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("not_ready");
  });
});
