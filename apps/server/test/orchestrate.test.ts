import { describe, it, expect } from "vitest";
import request from "supertest";
import { PlanResultSchema } from "@wayfare/orchestrator";
import { createApp } from "../src/app.js";
import { InMemorySessionStore } from "../src/session/store.js";
import { NOW, YEAR } from "./helpers.js";

/**
 * Background orchestration endpoints. A job is kicked off async and its progress + final plan
 * are observable by polling and over SSE. These assert the full round-trip against the mock
 * market wired into the default in-memory job store.
 */

const PROMPT = "5 day foodie trip to Naxos in September, budget around €1800 for two";

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

describe("Background orchestration API", () => {
  it("POST /api/orchestrate starts a job and returns 202 + jobId", async () => {
    const res = await request(app()).post("/api/orchestrate").send({ prompt: PROMPT });
    expect(res.status).toBe(202);
    expect(res.body.jobId).toMatch(/^job_/);
    expect(res.body.status).toBe("running");
  });

  it("rejects a body with no prompt", async () => {
    const res = await request(app()).post("/api/orchestrate").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_request");
  });

  it("404s an unknown job", async () => {
    const res = await request(app()).get("/api/orchestrate/job_nope");
    expect(res.status).toBe(404);
  });

  it("runs the job in the background and exposes a schema-valid plan by poll", async () => {
    const server = app();
    const started = await request(server).post("/api/orchestrate").send({ prompt: PROMPT });
    const { jobId } = started.body;

    let body: Record<string, unknown> = {};
    for (let i = 0; i < 50; i++) {
      const res = await request(server).get(`/api/orchestrate/${jobId}`);
      body = res.body;
      if (body.status === "done" || body.status === "error") break;
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(body.status).toBe("done");
    expect(() => PlanResultSchema.parse(body.result)).not.toThrow();
  });

  it("streams trace events then a final plan over SSE", async () => {
    const server = app();
    const started = await request(server).post("/api/orchestrate").send({ prompt: PROMPT });
    const { jobId } = started.body;

    const res = await request(server).get(`/api/orchestrate/${jobId}/events`);
    const events = parseSse(res.text);

    const kinds = events.map((e) => e.event);
    expect(kinds).toContain("trace");
    expect(kinds).toContain("complete");

    // the trace carries humanized progress from the real agents.
    const agents = events
      .filter((e) => e.event === "trace")
      .map((e) => (e.data as { agent: string }).agent);
    expect(agents).toContain("verify");

    const complete = events.find((e) => e.event === "complete");
    expect(() => PlanResultSchema.parse(complete?.data)).not.toThrow();
  });

  it("accepts an optional traveler profile that shapes the persona", async () => {
    const server = app();
    const started = await request(server)
      .post("/api/orchestrate")
      .send({
        prompt: PROMPT,
        profile: { signals: ["luxury traveler, will splurge"], budget: { amount: 6000, currency: "EUR", type: "soft" } },
      });
    const { jobId } = started.body;

    let result: { persona?: { weights: Record<string, number> } } | undefined;
    for (let i = 0; i < 50; i++) {
      const res = await request(server).get(`/api/orchestrate/${jobId}`);
      if (res.body.status === "done") { result = res.body.result; break; }
      await new Promise((r) => setTimeout(r, 5));
    }
    // "luxury / will splurge" should NOT leave price as the dominant axis.
    const weights = result?.persona?.weights ?? {};
    const top = Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0];
    expect(top).not.toBe("price");
  });
});
