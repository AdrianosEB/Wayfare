import type { TraceEvent } from "./types.js";

/**
 * Tracer — the shared audit trail. Every agent records what it did here, so a finished plan
 * carries its own explanation and the self-check loop is inspectable. An optional `onEvent`
 * sink lets a host stream progress (e.g. over SSE) without the agents knowing about it.
 */
export class Tracer {
  private readonly events: TraceEvent[] = [];

  constructor(private readonly onEvent?: (e: TraceEvent) => void) {}

  emit(agent: string, event: string, detail?: Record<string, unknown>): void {
    const e: TraceEvent = { at: new Date().toISOString(), agent, event, detail };
    this.events.push(e);
    this.onEvent?.(e);
  }

  drain(): TraceEvent[] {
    return [...this.events];
  }
}
