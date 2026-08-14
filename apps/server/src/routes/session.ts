import { Router, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  AnswersRequestSchema,
  RefineRequestSchema,
  SessionCreateRequestSchema,
  type SessionCreateResponse,
  type SessionStateResponse,
  type VersionSummary,
} from "@wayfare/shared";
import { AppError, invalid, notFound, notReady } from "../errors.js";
import { SseStream } from "../sse.js";
import type { SessionStore } from "../session/store.js";
import type { AuthDeps } from "../auth/index.js";
import { parsePrompt } from "../agent/parse.js";
import { selectClarifyQuestions } from "../agent/clarify.js";
import { mergeAnswers } from "../agent/merge.js";
import { runPlan, type RunDeps } from "../agent/run.js";
import { refine } from "../agent/refine.js";
import type { PlanEmitter } from "../agent/planner.js";
import type { OrchestrationJobStore } from "../orchestration/jobStore.js";

export interface RouteDeps {
  store: SessionStore;
  now: () => string;
  year: number;
  useAgent: boolean;
  anthropic?: Anthropic;
  model: string;
  /** Optional auth wiring. When omitted, createApp builds a fresh in-memory instance. */
  auth?: AuthDeps;
  /** Optional background-orchestration job store. When omitted, createApp builds a fresh one. */
  orchestration?: OrchestrationJobStore;
  /**
   * Optional path to the built web client. When omitted, createApp looks for apps/web/dist and
   * serves it if present, so one process serves both the SPA and /api.
   */
  webDist?: string;
}

function emitterFor(sse: SseStream): PlanEmitter {
  return {
    status: (step, message) => sse.status({ step, message }),
    partial: (patch) => sse.partial(patch),
    assumption: (a) => sse.assumption(a),
    message: (text) => sse.message(text),
  };
}

function planDeps(deps: RouteDeps): RunDeps {
  return {
    // ctx.currency here is only a placeholder — the planner rebinds the provider to the
    // currency it infers from origin/budget (see buildPlanContext → MockProvider), so every
    // listing ends up in the resolved trip currency regardless of this "EUR".
    ctx: { now: deps.now(), currency: "EUR" },
    year: deps.year,
    useAgent: deps.useAgent,
    model: deps.model,
    ...(deps.anthropic ? { anthropic: deps.anthropic } : {}),
  };
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw invalid("Request body failed validation.", r.error.issues);
  return r.data;
}

/** Forward async handler rejections to the error middleware (Express 4 doesn't do this). */
const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function createSessionRouter(deps: RouteDeps): Router {
  const router = Router();

  // 1. POST /api/session — parse prompt, return clarifying questions (cheap, synchronous)
  router.post("/session", (req, res) => {
    const { prompt } = parseBody(SessionCreateRequestSchema, req.body);
    const { request, agentMessage } = parsePrompt(prompt);
    const clarifyQuestions = selectClarifyQuestions(request);
    const session = deps.store.create(request, clarifyQuestions);
    const response: SessionCreateResponse = {
      sessionId: session.id,
      extracted: request,
      clarifyQuestions,
      agentMessage,
    };
    res.json(response);
  });

  // 2. POST /api/session/:id/answers — merge answers, stream the initial plan
  router.post("/session/:id/answers", wrap(async (req, res) => {
    const session = deps.store.get(req.params.id ?? "");
    if (!session) throw notFound();
    const { answers, skipped } = parseBody(AnswersRequestSchema, req.body);
    const request = mergeAnswers(session.request, answers, skipped);
    deps.store.setRequest(session.id, request);

    const sse = new SseStream(res);
    try {
      const trip = await runPlan(request, planDeps(deps), emitterFor(sse));
      const version = deps.store.addVersion(session.id, trip);
      sse.complete({ trip, version: version.version });
    } catch (err) {
      sse.error({ code: "internal", message: "Planning failed; please try again." });
      // eslint-disable-next-line no-console
      console.error("plan error", err);
    } finally {
      sse.close();
    }
  }));

  // 3. POST /api/session/:id/refine — classify, partial re-plan, stream the delta
  router.post("/session/:id/refine", wrap(async (req, res) => {
    const session = deps.store.get(req.params.id ?? "");
    if (!session) throw notFound();
    const current = deps.store.currentVersion(session.id);
    if (!current) throw notReady("No plan yet — submit answers first.");
    const { utterance } = parseBody(RefineRequestSchema, req.body);

    const sse = new SseStream(res);
    try {
      const result = await refine(current.trip, session.request, utterance, planDeps(deps), emitterFor(sse));
      if (result.scope === "info") {
        // info-scope changes nothing: complete with the unchanged trip, no new version, no diff
        sse.complete({ trip: result.trip, version: current.version });
      } else {
        const refinement = {
          utterance,
          scope: result.scope,
          diff: result.diff,
          budgetDelta: result.budgetDelta,
        };
        const version = deps.store.addVersion(session.id, result.trip, refinement);
        sse.complete({ trip: result.trip, version: version.version, refinement });
      }
    } catch (err) {
      sse.error({ code: "internal", message: "Refinement failed; please try again." });
      // eslint-disable-next-line no-console
      console.error("refine error", err);
    } finally {
      sse.close();
    }
  }));

  // 4. GET /api/session/:id — fetch current state
  router.get("/session/:id", (req, res) => {
    const session = deps.store.get(req.params.id ?? "");
    if (!session) throw notFound();
    const current = deps.store.currentVersion(session.id);
    if (!current) throw notReady("No plan yet for this session.");
    const versions: VersionSummary[] = session.versions.map((v) => ({
      version: v.version,
      createdAt: v.createdAt,
      ...(v.refinement ? { refinement: { utterance: v.refinement.utterance, scope: v.refinement.scope } } : {}),
    }));
    const response: SessionStateResponse = {
      sessionId: session.id,
      request: session.request,
      currentVersion: current.version,
      trip: current.trip,
      versions,
    };
    res.json(response);
  });

  return router;
}

export { AppError };
