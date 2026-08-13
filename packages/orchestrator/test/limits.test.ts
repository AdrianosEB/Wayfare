import { describe, it, expect } from "vitest";
import type { ListingKind } from "@wayfare/shared";
import {
  Limiter,
  SingleFlight,
  TTLCache,
  SearchLimits,
  queryKey,
  runSearch,
  Tracer,
} from "../src/index.js";
import type { Candidate, SearchQuery } from "../src/index.js";
import type { SearchProvider } from "../src/index.js";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// --- Limiter --------------------------------------------------------------

describe("Limiter", () => {
  it("(1) never exceeds max, and engages backpressure", async () => {
    const lim = new Limiter(5);
    await Promise.all(Array.from({ length: 20 }, () => lim.run(() => sleep(15))));
    expect(lim.maxObserved).toBeLessThanOrEqual(5);
    expect(lim.maxObserved).toBe(5);
    expect(lim.queuedPeak).toBeGreaterThan(0);
    expect(lim.inFlight).toBe(0);
  });

  it("(2) runs 100 tasks at max=5 to completion", async () => {
    const lim = new Limiter(5);
    let done = 0;
    await Promise.all(
      Array.from({ length: 100 }, () =>
        lim.run(async () => {
          await sleep(1);
          done++;
        }),
      ),
    );
    expect(done).toBe(100);
    expect(lim.inFlight).toBe(0);
  });

  it("(3) returns the slot on failure — half reject, the rest still run, pool survives", async () => {
    const lim = new Limiter(3);
    const settled = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        lim.run(async () => {
          await sleep(2);
          if (i % 2 === 0) throw new Error("boom");
          return i;
        }),
      ),
    );
    expect(settled.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect(settled.filter((r) => r.status === "rejected")).toHaveLength(5);
    expect(lim.inFlight).toBe(0);
    // the pool still works afterwards (no leaked capacity).
    await expect(lim.run(async () => "ok")).resolves.toBe("ok");
  });

  it("(4) Infinity disables the cap but still counts concurrency", async () => {
    const lim = new Limiter(Infinity);
    await Promise.all(Array.from({ length: 8 }, () => lim.run(() => sleep(10))));
    expect(lim.maxObserved).toBe(8);
    expect(lim.queuedPeak).toBe(0);
  });
});

// --- SingleFlight ---------------------------------------------------------

describe("SingleFlight", () => {
  it("(5) coalesces 50 concurrent calls on one key into a single invocation", async () => {
    const sf = new SingleFlight<number>();
    let calls = 0;
    const vals = await Promise.all(
      Array.from({ length: 50 }, () =>
        sf.do("k", async () => {
          calls++;
          await sleep(5);
          return 1;
        }),
      ),
    );
    expect(calls).toBe(1);
    expect(sf.started).toBe(1);
    expect(sf.coalesced).toBe(49);
    expect(vals.every((v) => v === 1)).toBe(true);
  });

  it("(6) keeps distinct keys independent", async () => {
    const sf = new SingleFlight<string>();
    let a = 0;
    let b = 0;
    await Promise.all([
      sf.do("a", async () => { a++; return "a"; }),
      sf.do("b", async () => { b++; return "b"; }),
    ]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(sf.started).toBe(2);
  });

  it("(7) releases a rejected key so a retry re-invokes rather than inheriting the rejection", async () => {
    const sf = new SingleFlight<string>();
    let calls = 0;
    await expect(
      sf.do("k", async () => {
        calls++;
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");
    const v = await sf.do("k", async () => {
      calls++;
      return "ok";
    });
    expect(v).toBe("ok");
    expect(calls).toBe(2);
  });
});

// --- TTLCache -------------------------------------------------------------

describe("TTLCache", () => {
  it("(8) serves before expiry, misses after", async () => {
    const c = new TTLCache<number>(20);
    c.set("k", 7);
    expect(c.get("k")).toBe(7);
    await sleep(30);
    expect(c.get("k")).toBeUndefined();
    expect(c.hits).toBe(1);
    expect(c.misses).toBe(1);
  });

  it("(9) evicts the oldest entry past maxEntries", () => {
    const c = new TTLCache<number>(1000, 3);
    c.set("a", 1);
    c.set("b", 2);
    c.set("c", 3);
    c.set("d", 4);
    expect(c.size).toBe(3);
    expect(c.get("a")).toBeUndefined();
    expect(c.get("d")).toBe(4);
    expect(c.evictions).toBe(1);
  });

  it("(10) ttlMs: 0 disables caching entirely", () => {
    const c = new TTLCache<number>(0);
    c.set("k", 1);
    expect(c.get("k")).toBeUndefined();
    expect(c.size).toBe(0);
  });
});

// --- queryKey -------------------------------------------------------------

describe("queryKey", () => {
  it("(11) is stable across property insertion order", () => {
    const q1: SearchQuery = {
      kind: "stay",
      where: "Naxos",
      partySize: { adults: 2 },
      maxPrice: { amount: 100, currency: "EUR" },
      hints: ["a", "b"],
    };
    const q2: SearchQuery = {
      hints: ["a", "b"],
      maxPrice: { amount: 100, currency: "EUR" },
      partySize: { adults: 2 },
      where: "Naxos",
      kind: "stay",
    };
    expect(queryKey("p", q1)).toBe(queryKey("p", q2));
  });

  it("(12) is stable across hint ordering and where casing/whitespace", () => {
    const q1: SearchQuery = { kind: "stay", where: "Naxos", hints: ["beach", "food"] };
    const q2: SearchQuery = { kind: "stay", where: "  naxos ", hints: ["food", "beach"] };
    expect(queryKey("p", q1)).toBe(queryKey("p", q2));
  });

  it("(13) separates provider, kind, and price ceiling", () => {
    const base: SearchQuery = { kind: "stay", where: "Naxos", hints: [] };
    expect(queryKey("p1", base)).not.toBe(queryKey("p2", base));
    expect(queryKey("p", { ...base, kind: "flight" })).not.toBe(queryKey("p", base));
    expect(queryKey("p", { ...base, maxPrice: { amount: 100, currency: "EUR" } })).not.toBe(
      queryKey("p", { ...base, maxPrice: { amount: 200, currency: "EUR" } }),
    );
  });
});

// --- runSearch integration ------------------------------------------------

function candidate(kind: ListingKind, provider: string, where: string): Candidate {
  return {
    listing: {
      id: `${provider}:${where}`,
      kind,
      title: where,
      price: { amount: 100, currency: "EUR" },
      source: { provider, label: provider },
      fetchedAt: "2026-06-16T10:00:00Z",
      freshness: "mock",
      confidence: 0.8,
    },
    entity: { key: `${kind}:${where}`, name: where, kind },
    tags: [],
  };
}

function stayProvider(id: string, onCall: () => void, latency = 12): SearchProvider {
  return {
    id,
    displayName: id,
    kinds: ["stay"],
    aggregator: true,
    async search(q) {
      onCall();
      await sleep(latency);
      return [candidate("stay", id, q.where)];
    },
  };
}

describe("runSearch through SearchLimits", () => {
  it("(14) makes one upstream call per distinct (provider, query), not per job", async () => {
    const limits = new SearchLimits<Candidate[]>({ maxConcurrencyPerProvider: 16 });
    let callsP1 = 0;
    let callsP2 = 0;
    const p1 = stayProvider("p1", () => callsP1++);
    const p2 = stayProvider("p2", () => callsP2++);
    const qA: SearchQuery = { kind: "stay", where: "naxos", hints: [] };
    const qB: SearchQuery = { kind: "stay", where: "lisbon", hints: [] };
    // 8 queries, only 2 distinct, × 2 providers = 16 jobs but 4 distinct (provider,query) pairs.
    const queries = [qA, qA, qB, qB, qA, qB, qA, qB];

    const out = await runSearch([p1, p2], queries, new Tracer(), limits);

    expect(limits.stats().upstreamCalls).toBe(4);
    expect(callsP1).toBe(2);
    expect(callsP2).toBe(2);
    expect(out.length).toBeGreaterThan(0);
  });

  it("(15) holds per-provider concurrency at the cap with coalescing + cache off", async () => {
    const limits = new SearchLimits<Candidate[]>({
      maxConcurrencyPerProvider: 3,
      cacheTtlMs: 0,
      disableCoalescing: true,
    });
    const p1 = stayProvider("p1", () => {}, 15);
    const queries: SearchQuery[] = Array.from({ length: 40 }, (_, i) => ({
      kind: "stay",
      where: `city${i}`,
      hints: [],
    }));

    await runSearch([p1], queries, new Tracer(), limits);

    expect(limits.stats().maxConcurrency).toBe(3);
  });

  it("(16) degrades gracefully when a provider throws, never rejecting the fan-out", async () => {
    const limits = new SearchLimits<Candidate[]>();
    const bad: SearchProvider = {
      id: "bad",
      displayName: "bad",
      kinds: ["stay"],
      aggregator: true,
      async search() {
        throw new Error("429");
      },
    };
    const good = stayProvider("good", () => {});
    const q: SearchQuery = { kind: "stay", where: "naxos", hints: [] };

    const out = await runSearch([bad, good], [q], new Tracer(), limits);

    expect(Array.isArray(out)).toBe(true);
    expect(out.some((c) => c.listing.source.provider === "good")).toBe(true);
  });
});
