import { Router, type Response } from "express";
import { z } from "zod";
import { TravelerProfileSchema, type TravelerProfile, type TraceEvent } from "@wayfare/orchestrator";
import { invalid, notFound } from "../errors.js";
import { makeId } from "../ids.js";
import type { OrchestrationJobStore } from "../orchestration/jobStore.js";

/**
 * Background orchestration endpoints. Unlike the synchronous planner (POST /answers streams
 * inline and blocks the request), these decouple kickoff from progress:
 *
 *   POST /api/orchestrate            → start a job, return { jobId } immediately (202)
 *   GET  /api/orchestrate/:id        → poll status + result
 *   GET  /api/orchestrate/:id/events → SSE: replay + live trace, then the final plan
 *
 * The SSE framing matches the rest of the app (named `event:` + single-line JSON `data:`); the
 * payloads are orchestration-native (`trace` events carry each agent's step, `complete` carries
 * the full PlanResult). We don't reuse the Trip-shaped `status`/`complete` schema because the
 * orchestrator emits verified *options* + booking intents, not a single assembled Trip.
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
  // fill defaults (signals/mustHaves/avoid default to []) and guarantee an id.
  return TravelerProfileSchema.parse({
    id: partial?.id ?? makeId("trav", prompt),
    ...partial,
  });
}

/** Humanized label per agent, so a UI can show progress without knowing the trace vocabulary. */
function labelFor(event: TraceEvent): string {
  switch (event.agent) {
    case "intake": return "Reading your request…";
    case "persona": return "Learning your travel style…";
    case "search": return "Searching sources in parallel…";
    case "verify": return "Cross-checking listings for real prices…";
    case "match": return "Matching to your budget…";
    case "critic": return "Double-checking the plan…";
    case "booking": return "Staging bookings for your approval…";
    case "orchestrator": return event.event === "retry" ? "Refining and trying again…" : "Working…";
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

  // 1. start a background orchestration job.
  router.post("/orchestrate", (req, res) => {
    const parsed = OrchestrateRequestSchema.safeParse(req.body);
    if (!parsed.success) throw invalid("Request body failed validation.", parsed.error.issues);
    const profile = resolveProfile(parsed.data.prompt, parsed.data.profile);
    const job = deps.store.start(parsed.data.prompt, profile);
    res.status(202).json({ jobId: job.id, status: job.status });
  });

  // 2. poll status + result.
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

  // 3. stream trace + final plan over SSE.
  router.get("/orchestrate/:id/events", (req, res) => {
    const id = req.params.id ?? "";
    if (!deps.store.get(id)) throw notFound();

    sseInit(res);
    // Mutable holder: subscribe() may deliver a terminal update *synchronously* (a job that has
    // already finished replays then emits done), so `cleanup` must be callable before subscribe
    // returns its real unsubscribe fn.
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
