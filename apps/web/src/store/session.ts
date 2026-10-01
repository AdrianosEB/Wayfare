/**
 * Planner state machine: prompt → plan → refine, driven by SSE.
 *
 *   1. submitPrompt(prompt)   POST /api/session. Returns the agent message, the extracted
 *                             request and clarifying questions.
 *                             Phase: idle → creating → clarifying (or straight to planning
 *                             when there are no questions, via an empty submitAnswers).
 *
 *   2. submitAnswers(body)    POST /api/session/:id/answers. Streams the initial plan.
 *                             Phase: clarifying → planning → ready.
 *
 *   3. refine(utterance)      POST /api/session/:id/refine. Streams the delta against the
 *                             current trip. Phase: ready → refining → ready. Ignored while
 *                             a stream is live.
 *
 * `consumeStream` reads the SSE body via `parseSseStream` (see lib/sse.ts for why not
 * EventSource) and maps each event onto the store:
 *   - `status`     → append a line to the run's collapsible statusGroup message.
 *   - `partial`    → merge-patch into `workingTrip` (see lib/mergePatch.ts). Components
 *                    render `trip ?? workingTrip` so the itinerary fills in live.
 *   - `assumption` → accumulate de-duped assumptions.
 *   - `message`    → append an agent text bubble.
 *   - `complete`   → the final `trip` replaces `workingTrip`, bumps `version`, and on refine
 *                    records the diff, budgetDelta and changedKeys.
 *   - `error`      → `degraded: true` becomes an agent message (the plan still completes
 *                    with labeled estimates); otherwise it sets `error`.
 *
 * One module-level AbortController (`runController`) backs cancel()/reset() and is passed to
 * fetch, so starting a new run tears the previous stream down.
 *
 * Itinerary and plan content must render visible by default, not behind an opacity-from-0
 * entrance animation. See lib/motion.ts.
 */
import { create } from 'zustand';
import type {
  Assumption,
  BudgetCategory,
  ClarifyQuestion,
  RefinementRecord,
  AgentStep,
  Trip,
  TripRequest,
  AnswersRequest,
} from '@/types';
import { createSession, postAnswers, postRefine } from '@/lib/api';
import { parseSseStream } from '@/lib/sse';
import { applyMergePatch } from '@/lib/mergePatch';

// Chat thread

export type ChatRole = 'user' | 'agent';

export interface StatusLine {
  step: AgentStep;
  message: string;
}

export type ChatMessage =
  | { id: string; role: ChatRole; type: 'text'; text: string }
  /** The batched clarifying questions, anchored in the thread. */
  | { id: string; role: 'agent'; type: 'questions' }
  /** One planning/refine run's streamed "thinking" lines; collapses when done. */
  | { id: string; role: 'agent'; type: 'statusGroup'; statuses: StatusLine[]; done: boolean }
  /** A "plan ready" / "what changed" marker tied to a trip version. */
  | { id: string; role: 'agent'; type: 'summary'; version: number; refinement?: RefinementRecord };

export type Phase =
  | 'idle'
  | 'creating' // POST /session in flight
  | 'clarifying' // showing the question cards
  | 'planning' // streaming the initial plan
  | 'ready' // a trip exists
  | 'refining'; // streaming a refinement

/** Identifiers a refinement touched. Components mark themselves changed if their
 *  name / title / listing id is in here, which holds up on sparse fixture arrays where
 *  positional diffing would not. */
export type ChangedKeys = Set<string>;

interface SessionState {
  phase: Phase;
  sessionId: string | null;
  prompt: string | null;

  messages: ChatMessage[];
  extracted: TripRequest | null;
  clarifyQuestions: ClarifyQuestion[];

  /** Progressive working copy during a stream; replaced by `trip` on complete. */
  workingTrip: Partial<Trip> | null;
  trip: Trip | null;
  version: number;

  assumptions: Assumption[];
  lastRefinement: RefinementRecord | null;
  budgetDelta: number | null;
  changedKeys: ChangedKeys;

  /** Budget category the user tapped to highlight its itinerary items (US: tap-to-trace). */
  focusedCategory: BudgetCategory | null;

  error: string | null;

  // actions
  submitPrompt: (prompt: string) => Promise<void>;
  submitAnswers: (body: AnswersRequest) => Promise<void>;
  refine: (utterance: string) => Promise<void>;
  setFocusedCategory: (category: BudgetCategory | null) => void;
  cancel: () => void;
  reset: () => void;
}

let idSeq = 0;
const nextId = (p: string) => `${p}_${++idSeq}`;

let runController: AbortController | null = null;

/** Derive the set of changed identifiers from a refinement diff. */
function deriveChangedKeys(refinement: RefinementRecord): ChangedKeys {
  const keys = new Set<string>();
  const collect = (v: unknown) => {
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.name === 'string') keys.add(o.name);
      if (typeof o.title === 'string') keys.add(o.title);
      if (typeof o.id === 'string') keys.add(o.id);
      const listing = o.listing as Record<string, unknown> | undefined;
      if (listing && typeof listing.id === 'string') keys.add(listing.id);
    }
  };
  for (const d of refinement.diff) {
    collect(d.after);
    collect(d.before);
  }
  return keys;
}

export const useSession = create<SessionState>((set, get) => ({
  phase: 'idle',
  sessionId: null,
  prompt: null,
  messages: [],
  extracted: null,
  clarifyQuestions: [],
  workingTrip: null,
  trip: null,
  version: 0,
  assumptions: [],
  lastRefinement: null,
  budgetDelta: null,
  changedKeys: new Set(),
  focusedCategory: null,
  error: null,

  /* 1. Prompt → clarifying questions (POST /api/session). */
  async submitPrompt(prompt) {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    set({
      phase: 'creating',
      prompt: trimmed,
      error: null,
      messages: [{ id: nextId('m'), role: 'user', type: 'text', text: trimmed }],
    });
    try {
      const res = await createSession(trimmed);
      const msgs: ChatMessage[] = [
        ...get().messages,
        { id: nextId('m'), role: 'agent', type: 'text', text: res.agentMessage },
      ];
      if (res.clarifyQuestions.length > 0) {
        msgs.push({ id: nextId('m'), role: 'agent', type: 'questions' });
      }
      set({
        sessionId: res.sessionId,
        extracted: res.extracted,
        clarifyQuestions: res.clarifyQuestions,
        messages: msgs,
        phase: res.clarifyQuestions.length > 0 ? 'clarifying' : 'ready',
      });
      // No questions → proceed straight to planning with an empty body (per contract).
      if (res.clarifyQuestions.length === 0) {
        await get().submitAnswers({ answers: {}, skipped: [] });
      }
    } catch (err) {
      set({ phase: 'idle', error: errMessage(err) });
    }
  },

  /* 2. Answers → stream the initial plan (POST /api/session/:id/answers). */
  async submitAnswers(body) {
    const { sessionId } = get();
    if (!sessionId) return;

    const groupId = nextId('s');
    set((s) => ({
      phase: 'planning',
      error: null,
      // Drop the interactive question card once submitted.
      messages: [
        ...s.messages.filter((m) => m.type !== 'questions'),
        { id: groupId, role: 'agent', type: 'statusGroup', statuses: [], done: false },
      ],
      workingTrip: {},
      assumptions: [],
    }));

    runController = new AbortController();
    try {
      const res = await postAnswers(sessionId, body, runController.signal);
      await consumeStream(res, runController.signal, { set, get }, groupId, false);
    } catch (err) {
      if (!runController?.signal.aborted) set({ error: errMessage(err) });
      finishGroup(set, groupId);
      set((s) => ({ phase: s.trip ? 'ready' : 'clarifying' }));
    }
  },

  /* 3. Refine → stream the delta (POST /api/session/:id/refine). */
  async refine(utterance) {
    const { sessionId, phase } = get();
    const text = utterance.trim();
    if (!sessionId || !text || phase === 'planning' || phase === 'refining') return;

    const groupId = nextId('s');
    set((s) => ({
      phase: 'refining',
      error: null,
      changedKeys: new Set(),
      budgetDelta: null,
      lastRefinement: null,
      messages: [
        ...s.messages,
        { id: nextId('m'), role: 'user', type: 'text', text },
        { id: groupId, role: 'agent', type: 'statusGroup', statuses: [], done: false },
      ],
    }));

    runController = new AbortController();
    try {
      const res = await postRefine(sessionId, { utterance: text }, runController.signal);
      await consumeStream(res, runController.signal, { set, get }, groupId, true);
    } catch (err) {
      if (!runController?.signal.aborted) set({ error: errMessage(err) });
      finishGroup(set, groupId);
      set({ phase: 'ready' });
    }
  },

  setFocusedCategory(category) {
    set((s) => ({
      focusedCategory: s.focusedCategory === category ? null : category,
    }));
  },

  cancel() {
    runController?.abort();
    runController = null;
  },

  reset() {
    runController?.abort();
    runController = null;
    set({
      phase: 'idle',
      sessionId: null,
      prompt: null,
      messages: [],
      extracted: null,
      clarifyQuestions: [],
      workingTrip: null,
      trip: null,
      version: 0,
      assumptions: [],
      lastRefinement: null,
      budgetDelta: null,
      changedKeys: new Set(),
      focusedCategory: null,
      error: null,
    });
  },
}));

// Stream glue

type StoreApi = {
  set: (partial: Partial<SessionState> | ((s: SessionState) => Partial<SessionState>)) => void;
  get: () => SessionState;
};

async function consumeStream(
  res: Response,
  signal: AbortSignal,
  { set }: StoreApi,
  groupId: string,
  isRefine: boolean,
): Promise<void> {
  for await (const ev of parseSseStream(res, signal)) {
    switch (ev.event) {
      case 'status':
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === groupId && m.type === 'statusGroup'
              ? { ...m, statuses: [...m.statuses, ev.data] }
              : m,
          ),
        }));
        break;

      case 'partial':
        set((s) => ({ workingTrip: applyMergePatch(s.workingTrip ?? {}, ev.data.patch) }));
        break;

      case 'assumption':
        set((s) => ({
          assumptions: dedupeAssumptions([
            ...s.assumptions,
            { field: ev.data.field, assumed: ev.data.assumed, reason: ev.data.reason },
          ]),
        }));
        break;

      case 'message':
        set((s) => ({
          messages: [
            ...s.messages,
            { id: nextId('m'), role: 'agent', type: 'text', text: ev.data.text },
          ],
        }));
        break;

      case 'complete': {
        const { trip, version, refinement } = ev.data;
        set((s) => ({
          trip,
          version,
          workingTrip: null,
          phase: 'ready',
          assumptions: dedupeAssumptions([...s.assumptions, ...(trip.assumptions ?? [])]),
          lastRefinement: refinement ?? null,
          budgetDelta: refinement?.budgetDelta ?? null,
          changedKeys: refinement ? deriveChangedKeys(refinement) : new Set(),
          messages: markGroupDone(s.messages, groupId).concat({
            id: nextId('m'),
            role: 'agent',
            type: 'summary',
            version,
            refinement,
          }),
        }));
        break;
      }

      case 'error':
        if (ev.data.degraded) {
          // Degraded: the plan still completes with labeled estimates, so show it as a message.
          set((s) => ({
            messages: [
              ...s.messages,
              {
                id: nextId('m'),
                role: 'agent',
                type: 'text',
                text: ev.data.message,
              },
            ],
          }));
        } else {
          set({ error: ev.data.message });
        }
        break;
    }
  }
  // Safety: ensure the status group is collapsed even if `complete` was absent.
  finishGroup(set, groupId);
  void isRefine;
}

function markGroupDone(messages: ChatMessage[], groupId: string): ChatMessage[] {
  return messages.map((m) =>
    m.id === groupId && m.type === 'statusGroup' ? { ...m, done: true } : m,
  );
}

function finishGroup(set: StoreApi['set'], groupId: string): void {
  set((s) => ({ messages: markGroupDone(s.messages, groupId) }));
}

function dedupeAssumptions(list: Assumption[]): Assumption[] {
  const seen = new Set<string>();
  const out: Assumption[] = [];
  for (const a of list) {
    const k = `${a.field}::${a.assumed}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

function errMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Something went wrong. Please try again.';
}
