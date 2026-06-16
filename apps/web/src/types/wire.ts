/**
 * Wire types — a verbatim mirror of `packages/shared` (DATA_MODEL.md + API_CONTRACT.md).
 *
 * The backend session OWNS these; the frontend only consumes them. We don't invent fields.
 * Until `packages/shared` is published we keep this local copy so we can build against the
 * fixtures; when it lands, `@/types` re-exports from `@wayfare/shared` and this file is
 * deleted — a near-no-op because the shapes are identical.
 *
 * Do NOT import this file directly anywhere in the app. Import from `@/types` instead.
 */

/* ------------------------------------------------------------------ money & source --- */

export interface Money {
  amount: number; // major units (e.g. 2410.0 EUR), formatted client-side
  currency: string; // ISO-4217
}

export interface PriceSource {
  provider: string; // 'mock:procedural' | 'mock:curated' | 'amadeus' | 'booking' | 'google_places'
  label: string; // human: "Estimated price" | "Amadeus · 2h ago"
  url?: string;
}

export type Freshness = 'live' | 'cached' | 'estimate' | 'mock';

/** The uniform priced unit. Every price in Wayfare is a Listing. */
export interface Listing {
  id: string;
  kind: 'flight' | 'stay' | 'activity' | 'transit';
  title: string;
  price: Money;
  source: PriceSource;
  fetchedAt: string; // ISO timestamp the price was obtained
  freshness: Freshness;
  confidence: number; // 0–1
  deepLink?: string;
}

/* --------------------------------------------------------------------- constraints --- */

export type FieldSource = 'prompt' | 'answer' | 'default' | 'inferred';

export interface Tracked<T> {
  value: T;
  source: FieldSource;
  confidence: number;
}

export interface DateConstraint {
  exact?: { start: string; end: string };
  month?: number;
  part?: 'early' | 'mid' | 'late';
  season?: string;
  flexibility: 'fixed' | 'window' | 'very_flexible';
}

export interface PartySize {
  adults: number;
  children?: number;
  childAges?: number[];
}

export interface BudgetConstraint {
  amount: number;
  currency: string;
  type: 'hard' | 'soft';
}

export interface TripRequest {
  destination?: Tracked<string>;
  origin?: Tracked<string>;
  durationDays?: Tracked<number>;
  dates?: Tracked<DateConstraint>;
  partySize?: Tracked<PartySize>;
  budget?: Tracked<BudgetConstraint>;
  vibe?: Tracked<string[]>;
  pace?: Tracked<'relaxed' | 'moderate' | 'packed'>;
  mustHaves?: Tracked<string[]>;
  avoid?: Tracked<string[]>;
}

/* ----------------------------------------------------------------------- itinerary --- */

export interface GeoPoint {
  lat: number;
  lng: number;
  name?: string;
}

export interface Flight {
  id: string;
  listing: Listing;
  direction: 'outbound' | 'return' | 'intra';
  from: string;
  to: string;
  departISO: string;
  arriveISO: string;
  stops: number;
  carrier?: string;
  bookingDeepLink?: string;
}

export interface Stay {
  id: string;
  listing: Listing;
  name: string;
  type: 'hotel' | 'hostel' | 'apartment' | 'aparthotel' | 'guesthouse';
  location: GeoPoint;
  checkIn: string;
  checkOut: string;
  nights: number;
  rating?: number; // 0–5
  amenities?: string[];
  distanceToFocus?: { label: string; meters: number };
}

export interface ItineraryItem {
  id: string;
  kind: 'activity' | 'transit' | 'meal' | 'free';
  startTime?: string;
  endTime?: string;
  listing?: Listing; // absent for 'free'
  title: string;
  location?: GeoPoint;
  walkingFromPrev?: { minutes: number; meters: number };
  kidSuitable?: boolean;
}

export interface Day {
  index: number; // 1-based
  date: string;
  title: string;
  items: ItineraryItem[];
  notes?: string;
}

export interface Itinerary {
  destinationResolved: string;
  startDate: string;
  endDate: string;
  flights: Flight[];
  stays: Stay[];
  days: Day[];
}

/* -------------------------------------------------------------------------- budget --- */

export type BudgetCategory =
  | 'flights'
  | 'stay'
  | 'activities'
  | 'transit'
  | 'food'
  | 'buffer';

export type RefinementScope =
  | 'budget_global'
  | 'lodging'
  | 'flights'
  | 'activity_day'
  | 'dates'
  | 'destination'
  | 'info';

export interface BudgetLine {
  category: BudgetCategory;
  amount: number;
  itemRefs: string[];
  freshness: Freshness; // worst-case freshness in this line
}

export interface SavingHint {
  description: string;
  delta: number; // signed; negative saves money
  appliesTo: RefinementScope;
}

export interface Budget {
  currency: string;
  target?: { amount: number; type: 'hard' | 'soft' };
  total: number;
  lines: BudgetLine[];
  status: 'under' | 'on_target' | 'over';
  overageNote?: string;
  savings: SavingHint[];
}

/* ----------------------------------------------------------------- trip & versions --- */

export interface Traveler {
  id: string;
  type: 'adult' | 'child';
  age?: number;
}

export interface Preferences {
  pace: 'relaxed' | 'moderate' | 'packed';
  interests: string[];
  lodgingStyle?: string[];
  flightPrefs?: { maxStops?: number; preferredTimes?: string[] };
  dietary?: string[];
}

export interface Assumption {
  field: string;
  assumed: string;
  reason: string;
}

export interface Trip {
  id: string;
  request: TripRequest;
  travelers: Traveler[];
  preferences: Preferences;
  itinerary: Itinerary;
  budget: Budget;
  summary: string;
  assumptions: Assumption[];
  status: 'planning' | 'complete' | 'degraded';
}

export interface ItemDiff {
  op: 'add' | 'remove' | 'replace';
  path: string; // e.g. "itinerary.stays[0]", "days[4].items[2]"
  before?: unknown;
  after?: unknown;
  priceDelta?: number;
}

export interface Refinement {
  utterance: string;
  scope: RefinementScope;
  diff: ItemDiff[];
  budgetDelta: number; // signed, in trip currency
}

/* -------------------------------------------------------- clarifying questions / API --- */

export type QuestionFormat =
  | 'chips'
  | 'multiselect'
  | 'stepper'
  | 'city'
  | 'text'
  | 'currency';

export interface ClarifyQuestion {
  id: string;
  question: string;
  format: QuestionFormat;
  options?: { value: string; label: string }[];
  skippable: boolean;
  skipDefault?: string;
  placeholder?: string;
}

/** Answer value types, keyed by ClarifyQuestion.format (API_CONTRACT §2). */
export type StepperAnswer = { adults: number; children?: number; childAges?: number[] };
export type CurrencyAnswer = { amount: number; currency: string };
export type AnswerValue = string | string[] | StepperAnswer | CurrencyAnswer;

/* --- request/response bodies --- */

export interface CreateSessionRequest {
  prompt: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  extracted: TripRequest;
  clarifyQuestions: ClarifyQuestion[];
  agentMessage: string;
}

export interface AnswersRequest {
  answers: Record<string, AnswerValue>;
  skipped: string[];
}

export interface RefineRequest {
  utterance: string;
}

export interface SessionStateResponse {
  sessionId: string;
  request: TripRequest;
  currentVersion: number;
  trip: Trip;
  versions: {
    version: number;
    createdAt: string;
    refinement?: { utterance: string; scope: RefinementScope };
  }[];
}

export interface ApiError {
  error: {
    code:
      | 'invalid_request'
      | 'session_not_found'
      | 'not_ready'
      | 'unplannable'
      | 'rate_limited'
      | 'internal';
    message: string;
    details?: unknown;
  };
}

/* ------------------------------------------------------------------- SSE protocol --- */

export type StatusStep =
  | 'search_flights'
  | 'search_stays'
  | 'search_activities'
  | 'compute_budget'
  | 'assemble'
  | 'resolve';

/** A shallow JSON-merge-patch (RFC-7386) against the working Trip. Arrays replace. */
export type TripPatch = {
  itinerary?: Partial<Itinerary> & Record<string, unknown>;
  budget?: Partial<Budget> & Record<string, unknown>;
} & Record<string, unknown>;

export interface SseStatus {
  step: StatusStep;
  message: string;
}
export interface SsePartial {
  patch: TripPatch;
}
export interface SseAssumption {
  field: string;
  assumed: string;
  reason: string;
}
export interface SseMessage {
  text: string;
}
export interface SseComplete {
  trip: Trip;
  version: number;
  refinement?: Refinement;
}
export interface SseErrorData {
  code: string;
  message: string;
  degraded?: boolean;
}

/** Discriminated union of parsed SSE frames. */
export type SseEvent =
  | { event: 'status'; data: SseStatus }
  | { event: 'partial'; data: SsePartial }
  | { event: 'assumption'; data: SseAssumption }
  | { event: 'message'; data: SseMessage }
  | { event: 'complete'; data: SseComplete }
  | { event: 'error'; data: SseErrorData };
