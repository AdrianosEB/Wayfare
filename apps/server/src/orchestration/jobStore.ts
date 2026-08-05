import {
  Orchestrator,
  mockProviderRegistry,
  type PlanResult,
  type TraceEvent,
  type TravelerProfile,
  type SearchProvider,
} from "@wayfare/orchestrator";
import { makeId } from "../ids.js";

/**
 * Background orchestration jobs. `POST /api/orchestrate` kicks a plan off here and returns a
 * jobId immediately — the orchestration runs *in the background* while the client watches its
 * progress over SSE (or polls). The orchestrator's own Tracer.onEvent hook feeds each agent's
 * step into the job's event buffer as it happens, so a late subscriber can replay everything
 * from the start and then follow live.
 *
 * In-memory MVP behind an interface, mirroring InMemorySessionStore — swap for Redis/a queue
 * when jobs need to outlive the process.
 */

export type JobStatus = "running" | "done" | "error";

export interface OrchestrationJob {
  id: string;
  status: JobStatus;
  createdAt: string;
  prompt: string;
  /** every trace event emitted so far, in order. */
  events: TraceEvent[];
  result?: PlanResult;
  error?: string;
}

/** What a subscriber receives: a live trace event, the final result, or a failure. */
export type JobUpdate =
  | { type: "event"; event: TraceEvent }
  | { type: "done"; result: PlanResult }
  | { type: "error"; message: string };

export type JobListener = (update: JobUpdate) => void;

export interface OrchestrationJobStore {
  start(prompt: string, profile: TravelerProfile): OrchestrationJob;
  get(id: string): OrchestrationJob | undefined;
  /**
   * Replays the job's buffered events to `listener` synchronously, then streams future ones.
   * Returns an unsubscribe fn. Safe against races: emission only happens in async
   * continuations, so nothing fires between the synchronous replay and registration.
   */
  subscribe(id: string, listener: JobListener): () => void;
}

export class InMemoryOrchestrationJobStore implements OrchestrationJobStore {
  private readonly jobs = new Map<string, OrchestrationJob>();
  private readonly listeners = new Map<string, Set<JobListener>>();
  private seq = 0;

  constructor(
    private readonly now: () => string,
    private readonly providers: SearchProvider[] = mockProviderRegistry(),
  ) {}

  start(prompt: string, profile: TravelerProfile): OrchestrationJob {
    const id = makeId("job", prompt, this.seq++);
    const job: OrchestrationJob = {
      id,
      status: "running",
      createdAt: this.now(),
      prompt,
      events: [],
    };
    this.jobs.set(id, job);
    this.listeners.set(id, new Set());

    const orchestrator = new Orchestrator(this.providers, {
      onEvent: (event) => {
        job.events.push(event);
        this.emit(id, { type: "event", event });
      },
    });

    // Fire-and-forget: the HTTP handler has already returned the jobId by the time this settles.
    void orchestrator
      .plan(prompt, profile)
      .then((result) => {
        job.status = "done";
        job.result = result;
        this.emit(id, { type: "done", result });
      })
      .catch((err: unknown) => {
        job.status = "error";
        job.error = err instanceof Error ? err.message : String(err);
        this.emit(id, { type: "error", message: job.error });
      });

    return job;
  }

  get(id: string): OrchestrationJob | undefined {
    return this.jobs.get(id);
  }

  subscribe(id: string, listener: JobListener): () => void {
    const job = this.jobs.get(id);
    if (!job) return () => {};

    // 1. replay everything that already happened.
    for (const event of job.events) listener({ type: "event", event });

    // 2. if the job already terminated, deliver the terminal update and don't register.
    if (job.status === "done" && job.result) {
      listener({ type: "done", result: job.result });
      return () => {};
    }
    if (job.status === "error") {
      listener({ type: "error", message: job.error ?? "orchestration failed" });
      return () => {};
    }

    // 3. otherwise follow live.
    const set = this.listeners.get(id)!;
    set.add(listener);
    return () => set.delete(listener);
  }

  private emit(id: string, update: JobUpdate): void {
    const set = this.listeners.get(id);
    if (!set) return;
    for (const listener of set) listener(update);
  }
}
