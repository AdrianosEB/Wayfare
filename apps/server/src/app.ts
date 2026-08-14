import express, { type Application, type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ZodError } from "zod";
import { AppError } from "./errors.js";
import { createSessionRouter, type RouteDeps } from "./routes/session.js";
import { createOrchestrateRouter } from "./routes/orchestrate.js";
import { InMemoryOrchestrationJobStore } from "./orchestration/jobStore.js";
import { createAuthRouter, createInMemoryAuthDeps, type AuthDeps } from "./auth/index.js";

/**
 * Build the Express application. Factory form so tests can inject a fresh store/clock and drive
 * it with supertest. All endpoints live under `/api` (API_CONTRACT.md global conventions).
 */
export function createApp(deps: RouteDeps): Application {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", planner: deps.useAgent ? "agent" : "deterministic" });
  });

  // Auth is additive: mounted alongside the planner, never gating it. If the caller didn't
  // inject auth deps, fall back to a fresh in-memory wiring (mirrors how tests build the app).
  const authDeps: AuthDeps = deps.auth ?? createInMemoryAuthDeps(deps.now);
  app.use("/api", createAuthRouter(authDeps));

  app.use("/api", createSessionRouter(deps));

  // Background agent orchestration (verify-and-book pipeline). Additive alongside the planner:
  // kicks jobs off async and streams their trace over SSE. Falls back to a fresh in-memory job
  // store when the caller didn't inject one (mirrors the auth wiring above).
  const orchestration = deps.orchestration ?? new InMemoryOrchestrationJobStore(deps.now);
  app.use("/api", createOrchestrateRouter({ store: orchestration, now: deps.now }));

  // Serve the built web client from this same process, so one server answers both the SPA and
  // /api — no CORS, and the SameSite=Lax auth cookie works because everything is one origin.
  // Mounted only when a build exists, so API-only dev (`pnpm dev:server`) and the tests are
  // unaffected. Resolved relative to this module: `src/` and `dist/` are both one level under
  // apps/server, so the same relative path works in dev (tsx) and after `pnpm build`.
  const webDist = deps.webDist ?? fileURLToPath(new URL("../../web/dist", import.meta.url));
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    // SPA fallback: any non-/api GET that didn't match a file serves index.html so client-side
    // routes (/pricing, /explore, …) survive a refresh. Guarded so an unknown /api path still
    // 404s as JSON instead of silently returning the HTML shell.
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
