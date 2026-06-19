import { http, HttpResponse, delay } from 'msw';
import type {
  SessionCreateResponse,
  RefinementRecord,
  Trip,
  User,
  AuthResponse,
  MeResponse,
  SignupRequest,
  LoginRequest,
} from '@/types';
import { applyMergePatch } from '@/lib/mergePatch';
import { buildSseStream, sseResponse, type MockFrame } from './sse';
import sessionCreate from './fixtures/session-create.response.json';
import tripComplete from './fixtures/trip-complete.json';
import refineComplete from './fixtures/refine-complete.json';

/**
 * MSW handlers that replay the four fixtures over the frozen wire (API_CONTRACT.md), so the
 * whole UX is buildable before the server exists. Enabled only when VITE_USE_MOCKS=1.
 * Pointing at the live `/api` is a config flip — no shape changes (everything here matches
 * the contract exactly).
 */

const BASE_TRIP = tripComplete.trip as unknown as Trip;
const REFINE = refineComplete.refinement as unknown as RefinementRecord;

/* ----------------------------------------------------- POST /api/session (synchronous) --- */

const createHandler = http.post('/api/session', async () => {
  await delay(450);
  return HttpResponse.json(sessionCreate as unknown as SessionCreateResponse);
});

/* --------------------------- POST /api/session/:id/answers — stream the initial plan --- */

const answersHandler = http.post('/api/session/:id/answers', ({ request }) => {
  // Replays docs/fixtures/sse-stream.example.txt, then `complete` carries the full Trip.
  const frames: MockFrame[] = [
    { kind: 'heartbeat' },
    { kind: 'delay', ms: 250 },
    {
      kind: 'event',
      event: 'status',
      data: {
        step: 'resolve',
        message: 'Picking the right Greek island for a quieter, relaxed beach trip…',
      },
    },
    { kind: 'delay', ms: 600 },
    {
      kind: 'event',
      event: 'status',
      data: { step: 'search_flights', message: 'Searching flights London→Greek islands…' },
    },
    { kind: 'delay', ms: 550 },
    {
      kind: 'event',
      event: 'partial',
      data: {
        patch: {
          itinerary: { flights: BASE_TRIP.itinerary.flights },
        },
      },
    },
    { kind: 'delay', ms: 500 },
    {
      kind: 'event',
      event: 'status',
      data: { step: 'search_stays', message: 'Comparing beachfront stays on Naxos…' },
    },
    { kind: 'delay', ms: 550 },
    {
      kind: 'event',
      event: 'partial',
      data: { patch: { itinerary: { stays: BASE_TRIP.itinerary.stays } } },
    },
    { kind: 'delay', ms: 500 },
    {
      kind: 'event',
      event: 'status',
      data: {
        step: 'search_activities',
        message: 'Finding beaches, a boat trip and a lively night…',
      },
    },
    { kind: 'delay', ms: 500 },
    {
      kind: 'event',
      event: 'assumption',
      data: {
        field: 'dates',
        assumed: 'Aug 23–31 (flexible window)',
        reason: 'you said late August, flexible',
      },
    },
    {
      kind: 'event',
      event: 'partial',
      data: { patch: { itinerary: { days: BASE_TRIP.itinerary.days } } },
    },
    { kind: 'delay', ms: 500 },
    {
      kind: 'event',
      event: 'status',
      data: { step: 'compute_budget', message: 'Costing it out…' },
    },
    { kind: 'delay', ms: 450 },
    {
      kind: 'event',
      event: 'partial',
      data: { patch: { budget: { currency: 'EUR', total: BASE_TRIP.budget.total, status: 'under' } } },
    },
    { kind: 'delay', ms: 450 },
    {
      kind: 'event',
      event: 'complete',
      data: { trip: BASE_TRIP, version: 1 },
    },
  ];

  return sseResponse(buildSseStream(frames, request.signal));
});

/* ----------------------------- POST /api/session/:id/refine — stream the delta --- */

/** Build the full v2 Trip the refine `complete` event must carry (contract: full Trip). */
function buildRefinedTrip(): Trip {
  // Base = current plan; apply the refine slice (budget/summary/id/status) as a merge patch…
  const refineSlice = refineComplete.trip as unknown as Partial<Trip>;
  const next = applyMergePatch<Trip>(structuredClone(BASE_TRIP), refineSlice);

  // …then reflect the diff in the itinerary so the rendered plan matches the new budget.
  // Stay swap (itinerary.stays[0] → Studio Thalassa, nearer the beach).
  const stay = next.itinerary.stays[0];
  if (stay) {
    stay.id = 'stay_2';
    stay.name = 'Studio Thalassa';
    stay.distanceToFocus = { label: 'to beach', meters: 120 };
    stay.listing = {
      ...stay.listing,
      id: 'lst_stay_2',
      title: 'Studio Thalassa — 8 nights',
      price: { amount: 1040, currency: 'EUR' },
    };
  }

  // Added day trip on Day 5 (the boat-trip day in the fixture).
  const day5 = next.itinerary.days.find((d) => d.index === 5);
  if (day5) {
    day5.items.unshift({
      id: 'it_d5_koufonisia',
      kind: 'transit',
      title: 'Day trip to Koufonisia (incl. ferry)',
      startTime: '09:00',
      endTime: '17:00',
      listing: {
        id: 'lst_koufonisia',
        kind: 'transit',
        title: 'Koufonisia day trip',
        price: { amount: 85, currency: 'EUR' },
        source: { provider: 'mock:curated', label: 'Estimated price' },
        fetchedAt: '2026-06-16T10:00:00Z',
        freshness: 'mock',
        confidence: 0.7,
      },
    });
  }

  return next;
}

const refineHandler = http.post('/api/session/:id/refine', async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { utterance?: string };
  const utterance = body.utterance ?? REFINE.utterance;

  const refinedTrip = buildRefinedTrip();

  const frames: MockFrame[] = [
    { kind: 'heartbeat' },
    { kind: 'delay', ms: 250 },
    {
      kind: 'event',
      event: 'status',
      data: { step: 'resolve', message: 'Got it — re-planning the stay and adding a day trip…' },
    },
    { kind: 'delay', ms: 550 },
    {
      kind: 'event',
      event: 'status',
      data: { step: 'search_stays', message: 'Finding a studio nearer Agios Prokopios beach…' },
    },
    { kind: 'delay', ms: 600 },
    {
      kind: 'event',
      event: 'status',
      data: { step: 'search_activities', message: 'Pricing a Koufonisia ferry day trip…' },
    },
    { kind: 'delay', ms: 600 },
    {
      kind: 'event',
      event: 'status',
      data: { step: 'compute_budget', message: 'Re-costing it out…' },
    },
    { kind: 'delay', ms: 450 },
    {
      kind: 'event',
      event: 'complete',
      data: {
        trip: refinedTrip,
        version: 2,
        refinement: { ...REFINE, utterance },
      },
    },
  ];

  return sseResponse(buildSseStream(frames, request.signal));
});

/* ------------------------------------------- GET /api/session/:id — current state --- */

const getHandler = http.get('/api/session/:id', ({ params }) => {
  return HttpResponse.json({
    sessionId: String(params.id),
    request: BASE_TRIP.request,
    currentVersion: 1,
    trip: BASE_TRIP,
    versions: [{ version: 1, createdAt: '2026-06-16T10:00:00Z' }],
  });
});

/* =================================================================== auth (AUTH_CONTRACT) ===
 * A tiny in-memory backend for email + password: a fake users store + a single "current
 * session" flag (the mock stand-in for the httpOnly cookie). Conforms to AUTH_CONTRACT.md so
 * the whole app works in mock mode (the dev default). Guest mode is the default — /me returns
 * `{ user: null }` at 200 until someone signs up or logs in.
 */

interface StoredUser extends User {
  password: string;
}

// Seed one demo account so "log in" works out of the box: demo@wayfare.app / password123.
const users: StoredUser[] = [
  {
    id: 'usr_demo',
    email: 'demo@wayfare.app',
    name: 'Demo Traveler',
    createdAt: '2026-01-01T00:00:00Z',
    password: 'password123',
  },
];

// The "cookie": which user id (if any) the current browser session is authenticated as.
let sessionUserId: string | null = null;

const publicUser = (u: StoredUser): User => ({
  id: u.id,
  email: u.email,
  name: u.name,
  createdAt: u.createdAt,
});

const authError = (code: string, message: string, status: number) =>
  HttpResponse.json({ error: { code, message } }, { status });

const signupHandler = http.post('/api/auth/signup', async ({ request }) => {
  await delay(350);
  const body = (await request.json().catch(() => ({}))) as Partial<SignupRequest>;
  const email = (body.email ?? '').trim().toLowerCase();
  const name = (body.name ?? '').trim();
  const password = body.password ?? '';

  if (!email || !password) {
    return authError('invalid_request', 'Email and password are required.', 400);
  }
  if (password.length < 8) {
    return authError('weak_password', 'Use at least 8 characters.', 400);
  }
  if (users.some((u) => u.email.toLowerCase() === email)) {
    return authError('email_taken', 'That email is already registered.', 409);
  }

  const user: StoredUser = {
    id: `usr_${Math.random().toString(36).slice(2, 10)}`,
    email,
    name,
    createdAt: new Date().toISOString(),
    password,
  };
  users.push(user);
  sessionUserId = user.id;
  return HttpResponse.json<AuthResponse>({ user: publicUser(user) });
});

const loginHandler = http.post('/api/auth/login', async ({ request }) => {
  await delay(350);
  const body = (await request.json().catch(() => ({}))) as Partial<LoginRequest>;
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  const user = users.find((u) => u.email.toLowerCase() === email && u.password === password);
  if (!user) {
    return authError('invalid_credentials', 'Invalid email or password.', 401);
  }
  sessionUserId = user.id;
  return HttpResponse.json<AuthResponse>({ user: publicUser(user) });
});

const logoutHandler = http.post('/api/auth/logout', async () => {
  await delay(120);
  sessionUserId = null;
  return HttpResponse.json({ ok: true });
});

const meHandler = http.get('/api/auth/me', async () => {
  await delay(120);
  const user = sessionUserId ? users.find((u) => u.id === sessionUserId) : undefined;
  return HttpResponse.json<MeResponse>({ user: user ? publicUser(user) : null });
});

export const handlers = [
  createHandler,
  answersHandler,
  refineHandler,
  getHandler,
  signupHandler,
  loginHandler,
  logoutHandler,
  meHandler,
];
