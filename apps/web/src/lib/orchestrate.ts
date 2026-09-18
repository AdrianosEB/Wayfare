/**
 * Client for the background agent orchestration — the verify-and-book pipeline that already
 * exists in `apps/server` and `packages/orchestrator` but which nothing in the web app has
 * ever called.
 *
 * Three endpoints (apps/server/src/routes/orchestrate.ts):
 *   POST /api/orchestrate            → 202 { jobId, status }
 *   GET  /api/orchestrate/:id        → { jobId, status, result?, error? }
 *   GET  /api/orchestrate/:id/events → SSE: `trace` … then `complete` or `error`
 *
 * The types below are a deliberately narrow local mirror of the orchestrator's schemas,
 * covering only the fields this UI renders. `packages/orchestrator` is a server-side package
 * and is not on the client's dependency path; mirroring the handful of fields we display
 * keeps the boundary honest rather than pulling the whole graph in.
 *
 * `Listing` is the exception and is imported for real: it comes from `@wayfare/shared`, which
 * IS the shared contract (`@/types` re-exports it verbatim), so an intent's price keeps its
 * source/freshness/confidence and renders through the existing <Price> + <SourceChip>. Never
 * re-mirror a shape that already lives in @wayfare/shared.
 */

import type { Listing } from '@/types';

const BASE = '/api';

/** `{ at, agent, event, detail? }` from the Tracer, plus the humanized `message` the route adds. */
export interface TraceLine {
  at: string;
  agent: string;
  event: string;
  message?: string;
  detail?: Record<string, unknown>;
}

/** Mirrors EntityRefSchema. */
export interface EntityRef {
  key: string;
  name: string;
  kind: string;
  locality?: string;
}

/**
 * Mirrors BookingIntentSchema. Note `status` is the literal `"requires_approval"` — the
 * booking agent stages intents and never executes them, which is a hard line in that agent,
 * not a TODO. This UI must not imply anything has been booked.
 */
export interface BookingIntent {
  entity: EntityRef;
  channel: string;
  /**
   * The priced unit behind the intent, carrying its own provenance. Rendering the amount
   * without `source.label` next to it would present the backend's sample prices as live
   * quotes — ListingSchema requires the label precisely so the UI cannot do that.
   */
  listing: Listing;
  target?: string;
  callScript: string[];
  status: 'requires_approval';
  note: string;
}

/**
 * Per-agent accounting from the LLM orchestrator's budget. `llm: false` means that agent ran
 * its deterministic implementation — either because it is not in `WAYFARE_LLM_AGENTS`, or
 * because the model's answer failed schema validation and `decide()` degraded. Both are normal
 * and worth showing rather than hiding.
 */
export interface AgentUsage {
  agent: string;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  ms: number;
  llm: boolean;
}

export interface UsageSummary {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  ms: number;
  capped: boolean;
  perAgent: AgentUsage[];
}

/** Only the slice of PlanResult this page shows. */
export interface PlanResultView {
  bookingIntents?: BookingIntent[];
  /** present only on the LLM path; the deterministic orchestrator emits no usage. */
  usage?: UsageSummary;
  [key: string]: unknown;
}

/** `GET /api/health` — tells the page which runtime is actually serving the agents. */
export interface OrchestratorHealth {
  llm: boolean;
  agents: string[];
  runtime: 'local' | 'anthropic';
  model: string;
}

export async function fetchOrchestratorHealth(
  signal?: AbortSignal,
): Promise<OrchestratorHealth | null> {
  try {
    const res = await fetch(`${BASE}/health`, { signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { orchestrator?: OrchestratorHealth };
    return body.orchestrator ?? null;
  } catch {
    // The banner is informational; never let it break the page.
    return null;
  }
}

export interface JobHandle {
  jobId: string;
  status: string;
}

export async function startOrchestration(
  prompt: string,
  signal?: AbortSignal,
): Promise<JobHandle> {
  const res = await fetch(`${BASE}/orchestrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal,
  });
  if (!res.ok) throw new Error(`orchestrate failed: ${res.status}`);
  return (await res.json()) as JobHandle;
}

export type OrchestrateEvent =
  | { event: 'trace'; data: TraceLine }
  | { event: 'complete'; data: PlanResultView }
  | { event: 'error'; data: { code?: string; message: string } };

/**
 * Reads the orchestration stream.
 *
 * Deliberately separate from `lib/sse.ts`: that parser is typed to the *planner's* event
 * vocabulary (`status` | `partial` | `assumption` | `message` | `complete`) via the shared
 * `SseEvent` union, and this stream speaks a different one (`trace` | `complete` | `error`).
 * Widening the shared parser would loosen the types the working planner relies on, so the
 * framing rules are repeated here instead — about twenty lines, and the planner stays sound.
 */
export async function* streamOrchestration(
  jobId: string,
  signal?: AbortSignal,
): AsyncGenerator<OrchestrateEvent, void, unknown> {
  const res = await fetch(`${BASE}/orchestrate/${encodeURIComponent(jobId)}/events`, {
    headers: { Accept: 'text/event-stream' },
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`event stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line; \r\n tolerated for proxies that rewrite it.
      let split: number;
      while ((split = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split).replace(/^\r?\n\r?\n/, '');

        let name = '';
        const dataLines: string[] = [];
        for (const raw of frame.split(/\r?\n/)) {
          if (raw.startsWith(':')) continue; // heartbeat
          if (raw.startsWith('event:')) name = raw.slice(6).trim();
          else if (raw.startsWith('data:')) dataLines.push(raw.slice(5).trim());
        }
        if (!name || dataLines.length === 0) continue;

        try {
          const data = JSON.parse(dataLines.join('\n'));
          yield { event: name, data } as OrchestrateEvent;
        } catch {
          // A truncated frame is not worth tearing the stream down for.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
