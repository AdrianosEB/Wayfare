/**
 * SSE encoding + a paced ReadableStream, used only by the MSW mock to replay the fixture
 * frame sequences (see docs/fixtures/sse-stream.example.txt). This is dev-only scaffolding;
 * the real server produces the identical wire format.
 */

export type MockFrame =
  | { kind: 'heartbeat' }
  | { kind: 'event'; event: string; data: unknown }
  | { kind: 'delay'; ms: number };

const encoder = new TextEncoder();

export function encodeEvent(event: string, data: unknown): Uint8Array {
  // Single-line JSON `data:` + blank-line terminator, exactly as the contract frames it.
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function encodeHeartbeat(): Uint8Array {
  return encoder.encode(`: ping\n\n`);
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Build a streaming Response body from a script of frames, pacing them so the client shows
 * progressive fill rather than a blank spinner. `delay` frames insert think-time.
 */
export function buildSseStream(frames: MockFrame[], signal?: AbortSignal): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const frame of frames) {
          if (signal?.aborted) break;
          if (frame.kind === 'delay') {
            await sleep(frame.ms);
          } else if (frame.kind === 'heartbeat') {
            controller.enqueue(encodeHeartbeat());
          } else {
            controller.enqueue(encodeEvent(frame.event, frame.data));
          }
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed (aborted) */
        }
      }
    },
  });
}

export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
