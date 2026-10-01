/**
 * Client for the background agent orchestration (the verify-and-book pipeline in
 * `apps/server` and `packages/orchestrator`).
 *
 * Endpoints (apps/server/src/routes/orchestrate.ts):
 *   POST /api/orchestrate            → 202 { jobId, status }
 *   GET  /api/orchestrate/:id        → { jobId, status, result?, error? }
 *   GET  /api/orchestrate/:id/events → SSE: `trace` … then `complete` or `error`
 *
 * The types below mirror only the orchestrator schema fields this UI renders, because
 * `packages/orchestrator` is server-side and not a client dependency.
 *
 * `Listing` is imported from `@wayfare/shared` (via `@/types`), so an intent's price keeps
 * its source/freshness/confidence and renders through <Price> + <SourceChip>. Do not
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
 * Mirrors BookingIntentSchema. `status` is always `"requires_approval"`: the booking agent
 * stages intents and never executes them, so this UI must not imply anything has been booked.
 */
export interface BookingIntent {
  entity: EntityRef;
  channel: string;
  /**
   * The priced unit behind the intent. Always render `source.label` next to the amount,
   * otherwise the backend's sample prices read as live quotes.
   */
  listing: Listing;
  target?: string;
  callScript: string[];
  status: 'requires_approval';
  note: string;
}

/**
 * Per-agent accounting from the LLM orchestrator's budget. `llm: false` means the agent ran
 * its deterministic implementation, either because it is not in `WAYFARE_LLM_AGENTS` or
 * because the model's answer failed schema validation and `decide()` degraded.
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

/** `GET /api/health`: which runtime is serving the agents. */
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
 * Reads the orchestration stream. Separate from `lib/sse.ts` because that parser is typed to
 * the planner's `SseEvent` union and this stream uses different events
 * (`trace` | `complete` | `error`).
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
