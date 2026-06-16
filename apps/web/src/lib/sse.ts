import type { SseEvent } from '@/types';

/**
 * Parse a POST SSE response (`text/event-stream`) via fetch + ReadableStream.
 *
 * Per FRONTEND_BRIEF / API_CONTRACT we deliberately do NOT use `EventSource` (GET-only).
 * We read the body stream, split on blank-line frame boundaries, and yield each
 * `event:`/`data:` frame. Lines starting with `:` (heartbeats/comments) are ignored.
 *
 * Each frame is one `event:` line + one single-line-JSON `data:` line. We tolerate
 * multi-line `data:` (spec allows it — concatenated with newlines) for robustness.
 */
export async function* parseSseStream(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent, void, unknown> {
  if (!response.body) throw new Error('SSE response has no body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line; tolerate both \n\n and \r\n\r\n.
      for (
        let sep = nextFrameBoundary(buffer);
        sep !== -1;
        sep = nextFrameBoundary(buffer)
      ) {
        const rawFrame = buffer.slice(0, sep);
        buffer = buffer.slice(boundaryEnd(buffer, sep));
        const parsed = parseFrame(rawFrame);
        if (parsed) yield parsed;
      }
    }

    // Flush any trailing frame without a final blank line.
    const tail = parseFrame(buffer);
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

function nextFrameBoundary(buf: string): number {
  const lf = buf.indexOf('\n\n');
  const crlf = buf.indexOf('\r\n\r\n');
  if (lf === -1) return crlf;
  if (crlf === -1) return lf;
  return Math.min(lf, crlf);
}

function boundaryEnd(buf: string, idx: number): number {
  return buf.startsWith('\r\n\r\n', idx) ? idx + 4 : idx + 2;
}

/** Parse a single raw frame string into a typed SseEvent, or null to skip. */
function parseFrame(raw: string): SseEvent | null {
  const lines = raw.split(/\r?\n/);
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line === '' || line.startsWith(':')) continue; // blank or heartbeat/comment
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // SSE: a single leading space after the colon is stripped.
    let val = colon === -1 ? '' : line.slice(colon + 1);
    if (val.startsWith(' ')) val = val.slice(1);

    if (field === 'event') event = val;
    else if (field === 'data') dataLines.push(val);
    // ignore `id:` and `retry:` — not used by this contract
  }

  if (!event || dataLines.length === 0) return null;

  const dataStr = dataLines.join('\n');
  let data: unknown;
  try {
    data = JSON.parse(dataStr);
  } catch {
    // Malformed data frame — skip rather than crash the stream.
    return null;
  }

  return { event, data } as SseEvent;
}
