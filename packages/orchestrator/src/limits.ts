import type { Money, PartySize } from "@wayfare/shared";
import type { SearchQuery } from "./types.js";

/**
 * Concurrency + dedupe primitives for the provider fan-out. Standard library only — the whole
 * point of these three is their behaviour under failure, so they are built here rather than
 * pulled from p-limit / async-sema / lru-cache.
 *
 * Composition and rationale live on `SearchLimits` at the bottom.
 */

// ---------------------------------------------------------------------------
// Limiter — bounded concurrency with a FIFO queue
// ---------------------------------------------------------------------------

/**
 * Caps how many `fn`s run at once. Extra callers park on a FIFO queue and are woken, one per
 * freed slot, when a running task settles.
 *
 * Two invariants the tests pin down:
 *  - the slot handover is *synchronous* (Trap 1): a freed slot is claimed inside `#release()` in
 *    the same turn, so a caller arriving in the gap can't double-book it and overshoot `max`;
 *  - the slot is freed in `finally` (Trap 2), so a rejected task returns its slot instead of
 *    bleeding capacity until throughput hits zero.
 */
export class Limiter {
  readonly max: number;
  #inFlight = 0;
  #maxObserved = 0;
  #queuedPeak = 0;
  readonly #queue: Array<() => void> = [];

  constructor(max: number) {
    this.max = max;
  }

  get inFlight(): number {
    return this.#inFlight;
  }
  get maxObserved(): number {
    return this.#maxObserved;
  }
  get queuedPeak(): number {
    return this.#queuedPeak;
  }
  get queueDepth(): number {
    return this.#queue.length;
  }

  run<T>(fn: () => Promise<T>): Promise<T> {
    // Infinity short-circuits the cap (the A/B escape hatch) but still counts concurrency.
    if (this.max === Infinity || this.#inFlight < this.max) {
      this.#take();
      return this.#invoke(fn);
    }
    return new Promise<T>((resolve, reject) => {
      // A queued waiter takes its slot *inside* this callback, invoked synchronously from
      // #release — never on promise-resolution timing, which would leak the slot (Trap 1).
      this.#queue.push(() => {
        this.#take();
        this.#invoke(fn).then(resolve, reject);
      });
      if (this.#queue.length > this.#queuedPeak) this.#queuedPeak = this.#queue.length;
    });
  }

  #take(): void {
    this.#inFlight++;
    if (this.#inFlight > this.#maxObserved) this.#maxObserved = this.#inFlight;
  }

  #invoke<T>(fn: () => Promise<T>): Promise<T> {
    let p: Promise<T>;
    try {
      p = fn();
    } catch (err) {
      p = Promise.reject(err);
    }
    // Release in finally so a failure returns its slot too (Trap 2).
    return p.finally(() => this.#release());
  }

  #release(): void {
    this.#inFlight--;
    const next = this.#queue.shift();
    if (next) next(); // synchronous handover, same turn
  }
}

// ---------------------------------------------------------------------------
// SingleFlight — coalesce identical in-flight calls
// ---------------------------------------------------------------------------

/**
 * De-duplicates concurrent calls sharing a key: the first starts the work, the rest await the
 * same promise. The key is dropped in `finally` (Trap 3) — a rejected promise left in the map
 * would be handed to every future caller of that key forever, turning one transient blip into a
 * permanent outage. `fn` is invoked inside try/catch (Trap 4) so a synchronous throw still
 * registers and cleans up rather than desyncing state.
 */
export class SingleFlight<T> {
  readonly #inflight = new Map<string, Promise<T>>();
  #coalesced = 0;
  #started = 0;

  get coalesced(): number {
    return this.#coalesced;
  }
  get started(): number {
    return this.#started;
  }
  get activeKeys(): number {
    return this.#inflight.size;
  }

  do(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.#inflight.get(key);
    if (existing) {
      this.#coalesced++;
      return existing;
    }
    this.#started++;
    let p: Promise<T>;
    try {
      p = fn();
    } catch (err) {
      p = Promise.reject(err);
    }
    const tracked = p.finally(() => {
      this.#inflight.delete(key);
    });
    this.#inflight.set(key, tracked);
    return tracked;
  }
}

// ---------------------------------------------------------------------------
// TTLCache — short-lived memo with lazy expiry + oldest-first eviction
// ---------------------------------------------------------------------------

interface Entry<T> {
  value: T;
  expires: number;
}

/**
 * A bounded, time-limited memo. Expiry is lazy (checked on read); over `maxEntries` the
 * oldest-inserted key is evicted — JS `Map` preserves insertion order, and `set` deletes before
 * re-inserting so insertion order tracks recency. `ttlMs <= 0` disables caching entirely.
 */
export class TTLCache<T> {
  readonly ttlMs: number;
  readonly maxEntries: number;
  readonly #map = new Map<string, Entry<T>>();
  #hits = 0;
  #misses = 0;
  #evictions = 0;

  constructor(ttlMs: number, maxEntries = 5000) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get hits(): number {
    return this.#hits;
  }
  get misses(): number {
    return this.#misses;
  }
  get evictions(): number {
    return this.#evictions;
  }
  get size(): number {
    return this.#map.size;
  }

  get(key: string): T | undefined {
    if (this.ttlMs <= 0) {
      this.#misses++;
      return undefined;
    }
    const entry = this.#map.get(key);
    if (!entry) {
      this.#misses++;
      return undefined;
    }
    if (entry.expires <= Date.now()) {
      this.#map.delete(key);
      this.#misses++;
      return undefined;
    }
    this.#hits++;
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.ttlMs <= 0) return;
    this.#map.delete(key); // delete-then-set: re-inserting moves the key to newest
    this.#map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.#map.size > this.maxEntries) {
      const oldest = this.#map.keys().next().value;
      if (oldest === undefined) break;
      this.#map.delete(oldest);
      this.#evictions++;
    }
  }
}

// ---------------------------------------------------------------------------
// queryKey — a stable, collision-free cache/coalesce key for a (provider, query)
// ---------------------------------------------------------------------------

// A separator that cannot occur inside any normalized part.
const SEP = "�";

/**
 * Build the key by hand in a fixed field order (Trap 5): `JSON.stringify(query)` would vary with
 * property-insertion order and with the order `hints` happens to arrive in, so two identical
 * queries could hash differently — the cache and coalescer would then silently never hit, with
 * no error anywhere.
 */
export function queryKey(providerId: string, query: SearchQuery): string {
  return [
    providerId,
    query.kind,
    text(query.where),
    text(query.checkIn),
    text(query.checkOut),
    partySizePart(query.partySize),
    maxPricePart(query.maxPrice),
    hintsPart(query.hints),
  ].join(SEP);
}

function text(v: string | undefined): string {
  return v == null ? "-" : v.trim().toLowerCase();
}

function partySizePart(p: PartySize | undefined): string {
  if (!p) return "-";
  const ages = (p.childAges ?? []).slice().sort((a, b) => a - b).join(",");
  return `${p.adults}a${p.children ?? 0}c${ages ? `:${ages}` : ""}`;
}

function maxPricePart(m: Money | undefined): string {
  if (!m) return "-";
  return `${Math.round(m.amount)}${m.currency.toUpperCase()}`;
}

function hintsPart(hints: string[]): string {
  // SearchQuery.hints is `.default([])`, so it is always an array.
  return hints.map((h) => h.trim().toLowerCase()).sort().join(",");
}

// ---------------------------------------------------------------------------
// SearchLimits — compose cache → coalesce → limiter around each upstream call
// ---------------------------------------------------------------------------

export interface SearchLimitsOptions {
  /** per-provider concurrency cap; `Infinity` disables the cap. */
  maxConcurrencyPerProvider?: number;
  /** cache TTL in ms; `0` disables caching. */
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  disableCoalescing?: boolean;
}

export interface SearchStats {
  /** real upstream `fn` invocations (cache hits and coalesced calls never reach here). */
  upstreamCalls: number;
  cacheHits: number;
  coalesced: number;
  /** peak concurrent upstream calls at the busiest single provider. */
  maxConcurrency: number;
  /** deepest a single provider's wait queue got — proof backpressure engaged. */
  queuedPeak: number;
}

function parseConcurrency(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  if (raw === "Infinity") return Infinity;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntEnv(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * The fan-out governor. `run` layers, in this order and for these reasons:
 *
 *   1. cache.get     — free; skip all work if we already have the answer.
 *   2. singleflight  — the cache can't help a call that hasn't returned yet; that window is
 *                      exactly where a herd forms, so coalesce identical in-flight calls next.
 *   3. limiter       — otherwise take a per-provider slot; cached and coalesced callers never
 *                      consume one, so only real upstream work counts against a provider.
 *   4. fn            — the real call.
 *   5. cache.set     — on success only; a failure is never cached.
 *
 * Limiters are per-provider (independent limits; a slow provider must not starve a fast one).
 */
export class SearchLimits<T = unknown> {
  readonly #maxPerProvider: number;
  readonly #coalescing: boolean;
  readonly #cache: TTLCache<T>;
  readonly #singleflight = new SingleFlight<T>();
  readonly #limiters = new Map<string, Limiter>();
  #upstreamCalls = 0;

  constructor(opts: SearchLimitsOptions = {}) {
    const env = process.env;
    this.#maxPerProvider =
      opts.maxConcurrencyPerProvider ??
      parseConcurrency(env.WAYFARE_MAX_CONCURRENCY_PER_PROVIDER) ??
      8;
    const ttlMs = opts.cacheTtlMs ?? parseIntEnv(env.WAYFARE_SEARCH_CACHE_TTL_MS) ?? 300_000;
    const maxEntries =
      opts.cacheMaxEntries ?? parseIntEnv(env.WAYFARE_SEARCH_CACHE_MAX_ENTRIES) ?? 5000;
    this.#coalescing =
      !(opts.disableCoalescing ?? env.WAYFARE_DISABLE_COALESCING === "true");
    this.#cache = new TTLCache<T>(ttlMs, maxEntries);
  }

  limiterFor(providerId: string): Limiter {
    let limiter = this.#limiters.get(providerId);
    if (!limiter) {
      limiter = new Limiter(this.#maxPerProvider);
      this.#limiters.set(providerId, limiter);
    }
    return limiter;
  }

  run(providerId: string, key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.#cache.get(key);
    if (cached !== undefined) return Promise.resolve(cached);

    const work = () =>
      this.limiterFor(providerId).run(() => {
        this.#upstreamCalls++;
        return Promise.resolve(fn()).then((value) => {
          this.#cache.set(key, value);
          return value;
        });
      });

    return this.#coalescing ? this.#singleflight.do(key, work) : work();
  }

  stats(): SearchStats {
    let maxConcurrency = 0;
    let queuedPeak = 0;
    for (const limiter of this.#limiters.values()) {
      if (limiter.maxObserved > maxConcurrency) maxConcurrency = limiter.maxObserved;
      if (limiter.queuedPeak > queuedPeak) queuedPeak = limiter.queuedPeak;
    }
    return {
      upstreamCalls: this.#upstreamCalls,
      cacheHits: this.#cache.hits,
      coalesced: this.#singleflight.coalesced,
      maxConcurrency,
      queuedPeak,
    };
  }
}
