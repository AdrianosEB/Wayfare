import { Router, type Response } from "express";
import { z } from "zod";
import { TravelerProfileSchema, type TravelerProfile, type TraceEvent } from "@wayfare/orchestrator";
import { invalid, notFound } from "../errors.js";
import { makeId } from "../ids.js";
import type { OrchestrationJobStore } from "../orchestration/jobStore.js";

/**
 * Background orchestration endpoints. Unlike the planner, which streams inline from
 * POST /answers, kickoff and progress are separate requests:
 *
 *   POST /api/orchestrate            → start a job, return { jobId } immediately (202)
 *   GET  /api/orchestrate/:id        → poll status + result
 *   GET  /api/orchestrate/:id/events → SSE: replay + live trace, then the final plan
 *
 * SSE framing matches the rest of the app. Payloads differ: `trace` carries each agent's step
 * and `complete` carries the full PlanResult (verified options + booking intents), not a Trip.
 */

export interface OrchestrateDeps {
  store: OrchestrationJobStore;
  now: () => string;
}

const OrchestrateRequestSchema = z
  .object({
    prompt: z.string().min(1),
    /** optional traveler profile; a minimal one is synthesized from the prompt if omitted. */
    profile: TravelerProfileSchema.partial().optional(),
  })
  .strict();

function resolveProfile(
  prompt: string,
  partial: z.infer<typeof OrchestrateRequestSchema>["profile"],
): TravelerProfile {
  // the schema fills defaults; make sure there's an id
  return TravelerProfileSchema.parse({
    id: partial?.id ?? makeId("trav", prompt),
    ...partial,
  });
}

/** User-facing progress label for a trace event. */
function labelFor(event: TraceEvent): string {
  switch (event.agent) {
    case "intake": return "Reading your request…";
    case "persona": return "Learning your travel style…";
    case "search": return "Searching sources in parallel…";
    case "verify": return "Cross-checking listings for real prices…";
    case "supervisor": return "Composing whole-trip combinations…";
    case "reprice": return "Re-checking prices before staging…";
    case "match": return "Matching to your budget…";
    case "critic": return "Double-checking the plan…";
    case "booking": return "Staging bookings for your approval…";
    // The LangGraph path brackets its run as `llm` rather than `orchestrator`. Its
    // `agent_usage` events are telemetry, not steps.
    case "llm":
    case "orchestrator":
      if (event.event === "retry") return "Refining and trying again…";
      if (event.event === "start") return "Starting the pipeline…";
      if (event.event === "done") return "Finished. Everything below needs your approval.";
      return "Working…";
    default: return "Working…";
  }
}

function sseInit(res: Response): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": ping\n\n");
  res.flushHeaders?.();
}

function sseSend(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function createOrchestrateRouter(deps: OrchestrateDeps): Router {
  const router = Router();

  // start a background job
  router.post("/orchestrate", (req, res) => {
    const parsed = OrchestrateRequestSchema.safeParse(req.body);
    if (!parsed.success) throw invalid("Request body failed validation.", parsed.error.issues);
    const profile = resolveProfile(parsed.data.prompt, parsed.data.profile);
    const job = deps.store.start(parsed.data.prompt, profile);
    res.status(202).json({ jobId: job.id, status: job.status });
  });

  // poll status + result
  router.get("/orchestrate/:id", (req, res) => {
    const job = deps.store.get(req.params.id ?? "");
    if (!job) throw notFound();
    res.json({
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      ...(job.result ? { result: job.result } : {}),
      ...(job.error ? { error: job.error } : {}),
    });
  });

  // stream trace + final plan over SSE
  router.get("/orchestrate/:id/events", (req, res) => {
    const id = req.params.id ?? "";
    if (!deps.store.get(id)) throw notFound();

    sseInit(res);
    // subscribe() can deliver a terminal update synchronously for a finished job, so `cleanup`
    // has to be callable before subscribe returns the real unsubscribe fn.
    let unsubscribe: () => void = () => {};
    const cleanup = () => unsubscribe();
    req.on("close", cleanup);

    unsubscribe = deps.store.subscribe(id, (update) => {
      if (update.type === "event") {
        sseSend(res, "trace", { ...update.event, message: labelFor(update.event) });
      } else if (update.type === "done") {
        sseSend(res, "complete", update.result);
        cleanup();
        res.end();
      } else {
        sseSend(res, "error", { code: "internal", message: update.message });
        cleanup();
        res.end();
      }
    });
  });

  return router;
}
