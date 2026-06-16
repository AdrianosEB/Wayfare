import type { Response } from "express";
import type {
  StatusEventData,
  PartialEventData,
  AssumptionEventData,
  MessageEventData,
  CompleteEventData,
  ErrorEventData,
  TripPatch,
} from "@wayfare/shared";

/**
 * Server-Sent Events writer implementing the exact framing in API_CONTRACT.md:
 * `event:` line + single-line JSON `data:` line + blank line. `: ping` heartbeats keep the
 * connection alive; clients ignore comment lines.
 */
export class SseStream {
  private closed = false;
  constructor(private readonly res: Response) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    // Prime the stream so proxies flush headers immediately.
    res.write(": ping\n\n");
    res.flushHeaders?.();
  }

  private send(event: string, data: unknown): void {
    if (this.closed) return;
    this.res.write(`event: ${event}\n`);
    this.res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  ping(): void {
    if (!this.closed) this.res.write(": ping\n\n");
  }

  status(data: StatusEventData): void {
    this.send("status", data);
  }
  partial(patch: TripPatch): void {
    this.send("partial", { patch } satisfies PartialEventData);
  }
  assumption(data: AssumptionEventData): void {
    this.send("assumption", data);
  }
  message(text: string): void {
    this.send("message", { text } satisfies MessageEventData);
  }
  complete(data: CompleteEventData): void {
    this.send("complete", data);
  }
  error(data: ErrorEventData): void {
    this.send("error", data);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.res.end();
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
