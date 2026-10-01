import express, { type Application, type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, join } from "node:path";
import { ZodError } from "zod";
import { AppError } from "./errors.js";
import { createSessionRouter, type RouteDeps } from "./routes/session.js";
import { createOrchestrateRouter } from "./routes/orchestrate.js";
import { InMemoryOrchestrationJobStore } from "./orchestration/jobStore.js";
import { readConfig as readLlmConfig } from "@wayfare/orchestrator-llm";
import { createAuthRouter, createInMemoryAuthDeps, type AuthDeps } from "./auth/index.js";

/**
 * Build the Express app. A factory so tests can inject a fresh store and clock. All endpoints
 * live under `/api` (API_CONTRACT.md).
 */
export function createApp(deps: RouteDeps): Application {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    // `planner` is the /session path; `orchestrator` is /orchestrate, configured separately.
    // `model` is a name, never a key or URL.
    const llm = readLlmConfig();
    res.json({
      status: "ok",
      planner: deps.useAgent ? "agent" : "deterministic",
      orchestrator: {
        llm: llm.enabled,
        agents: llm.enabled ? [...llm.agents] : [],
        runtime: llm.localBaseUrl ? "local" : "anthropic",
        model: llm.localBaseUrl ? basename(llm.localModel) : llm.model,
      },
    });
  });

  // Auth is mounted alongside the planner and never gates it.
  const authDeps: AuthDeps = deps.auth ?? createInMemoryAuthDeps(deps.now);
  app.use("/api", createAuthRouter(authDeps));

  app.use("/api", createSessionRouter(deps));

  // Background agent orchestration (verify-and-book pipeline): jobs run async and stream their
  // trace over SSE.
  const orchestration = deps.orchestration ?? new InMemoryOrchestrationJobStore(deps.now);
  app.use("/api", createOrchestrateRouter({ store: orchestration, now: deps.now }));

  // Serve the built web client from this process when a build exists: one origin, so no CORS
  // and the SameSite=Lax auth cookie works. The relative path is the same from `src/` and `dist/`.
  const webDist = deps.webDist ?? fileURLToPath(new URL("../../web/dist", import.meta.url));
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    // SPA fallback so client-side routes survive a refresh. Unknown /api paths still 404.
    app.get(/^(?!\/api\/).*/, (req, res, next) => {
      if (req.method !== "GET") return next();
      res.sendFile(join(webDist, "index.html"));
    });
  }

  // uniform error shape (API_CONTRACT.md "Errors")
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof AppError) {
      return res.status(err.status).json(err.toBody());
    }
    if (err instanceof ZodError) {
      return res
        .status(400)
        .json({ error: { code: "invalid_request", message: "Request failed validation.", details: err.issues } });
    }
    // eslint-disable-next-line no-console
    console.error("unhandled error", err);
    return res.status(500).json({ error: { code: "internal", message: "Something went wrong." } });
  });

  return app;
}
