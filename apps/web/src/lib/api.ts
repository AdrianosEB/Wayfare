import type {
  AnswersRequest,
  ApiError,
  SessionCreateResponse,
  RefineRequest,
  SessionStateResponse,
} from '@/types';

/**
 * Thin client over the frozen wire (API_CONTRACT.md). Every call targets `/api` — in dev
 * that's either MSW (mocks) or the Vite proxy → :3000. The client never holds keys and
 * never talks to a provider directly.
 *
 * The two streaming endpoints return the raw `Response` so the caller can read the SSE body
 * with `parseSseStream` (fetch + ReadableStream); JSON endpoints return parsed bodies.
 */

const BASE = '/api';

export class WayfareApiError extends Error {
  code: ApiError['error']['code'] | 'network' | 'http';
  status: number;
  details?: unknown;

  constructor(
    message: string,
    code: WayfareApiError['code'],
    status: number,
    details?: unknown,
  ) {
    super(message);
    this.name = 'WayfareApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function asError(res: Response): Promise<WayfareApiError> {
  let body: ApiError | undefined;
  try {
    body = (await res.json()) as ApiError;
  } catch {
    /* non-JSON error body */
  }
  if (body?.error) {
    return new WayfareApiError(body.error.message, body.error.code, res.status, body.error.details);
  }
  return new WayfareApiError(`Request failed (${res.status})`, 'http', res.status);
}

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8' };

/** POST /api/session — submit prompt, get clarifying questions (cheap, synchronous). */
export async function createSession(
  prompt: string,
  signal?: AbortSignal,
): Promise<SessionCreateResponse> {
  const res = await fetch(`${BASE}/session`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ prompt }),
    signal,
  });
  if (!res.ok) throw await asError(res);
  return (await res.json()) as SessionCreateResponse;
}

/** POST /api/session/:id/answers — submit answers, returns the SSE stream Response. */
export async function postAnswers(
  sessionId: string,
  body: AnswersRequest,
  signal?: AbortSignal,
): Promise<Response> {
  const res = await fetch(`${BASE}/session/${encodeURIComponent(sessionId)}/answers`, {
    method: 'POST',
    headers: { ...jsonHeaders, accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await asError(res);
  return res;
}

/** POST /api/session/:id/refine — natural-language refinement, returns the SSE stream. */
export async function postRefine(
  sessionId: string,
  body: RefineRequest,
  signal?: AbortSignal,
): Promise<Response> {
  const res = await fetch(`${BASE}/session/${encodeURIComponent(sessionId)}/refine`, {
    method: 'POST',
    headers: { ...jsonHeaders, accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await asError(res);
  return res;
}

/** GET /api/session/:id — fetch current state (used for resume / refresh). */
export async function getSession(
  sessionId: string,
  signal?: AbortSignal,
): Promise<SessionStateResponse> {
  const res = await fetch(`${BASE}/session/${encodeURIComponent(sessionId)}`, { signal });
  if (!res.ok) throw await asError(res);
  return (await res.json()) as SessionStateResponse;
}
