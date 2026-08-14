import { Orchestrator, mockProviderRegistry } from "../src/index.js";
import type { SearchProvider } from "../src/index.js";
import type { SearchLimitsOptions } from "../src/index.js";
import type { TravelerProfile } from "../src/index.js";

/**
 * Fan-out benchmark. Wraps the mock providers in a decorator that adds ~60ms latency and, past
 * 6 concurrent calls *per provider*, throws a 429 — the failure mode of a real rate-limited API.
 * Then runs 40 concurrent plans across a destination list with heavy repeats, twice:
 *
 *   A. escape hatches on  → unbounded fan-out (the old behavior)
 *   B. bounded            → per-provider cap + coalescing + TTL cache
 *
 * The finding is not "did the plans complete" — both return 40/40 because runSearch degrades
 * rather than throwing (Trap 7). It is what *survived*: itineraries composed, budgets held, and
 * itineraries actually re-price-confirmed. Concurrency is metered per provider, never globally
 * (Trap 6), or the two runs would read the same.
 *
 *   pnpm --filter @wayfare/orchestrator bench
 */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface ThrottleStats {
  errors: number;
  peak: number;
}

/** Rate-limited API stand-in: ~60ms latency; throws 429 past `cap` concurrent calls. */
function throttle(inner: SearchProvider, cap = 6, latency = 60): { provider: SearchProvider; stats: ThrottleStats } {
  const stats: ThrottleStats = { errors: 0, peak: 0 };
  let live = 0; // this provider's own concurrency — a closure, so metering is per-provider.
  const provider: SearchProvider = {
    id: inner.id,
    displayName: inner.displayName,
    kinds: inner.kinds,
    aggregator: inner.aggregator,
    async search(query) {
      live++;
      if (live > stats.peak) stats.peak = live;
      if (live > cap) {
        stats.errors++;
        live--;
        throw new Error("429 Too Many Requests");
      }
      try {
        await sleep(latency);
        return await inner.search(query);
      } finally {
        live--;
      }
    },
  };
  return { provider, stats };
}

const PROFILE: TravelerProfile = {
  id: "bench",
  homeCity: "London",
  signals: ["foodie on a budget", "wants to be central"],
  budget: { amount: 1800, currency: "EUR", type: "soft" },
  partySize: { adults: 2 },
  mustHaves: [],
  avoid: [],
};

const DESTS = ["Naxos", "Lisbon", "Porto", "Santorini", "Split"];
const PROMPTS = Array.from(
  { length: 40 },
  (_, i) => `5 day foodie trip to ${DESTS[i % DESTS.length]} in September, budget around €1800 for two`,
);

interface Result {
  label: string;
  plans: number;
  errors: number;
  peakPerProvider: number;
  confirmed: number;
  withinBudget: number;
  options: number;
  ms: number;
}

async function runScenario(label: string, limits: SearchLimitsOptions): Promise<Result> {
  const wrapped = mockProviderRegistry().map((p) => throttle(p));
  const providers = wrapped.map((w) => w.provider);
  const orchestrator = new Orchestrator(providers, { limits, maxPasses: 3 });

  const started = Date.now();
  const plans = await Promise.all(PROMPTS.map((prompt) => orchestrator.plan(prompt, PROFILE)));
  const ms = Date.now() - started;

  const errors = wrapped.reduce((a, w) => a + w.stats.errors, 0);
  const peakPerProvider = Math.max(...wrapped.map((w) => w.stats.peak));
  const confirmed = plans.filter((p) => p.confirmation?.confirmed).length;
  const withinBudget = plans.filter((p) => p.itinerary?.withinBudget).length;
  const options = plans.reduce(
    (a, p) => a + Object.values(p.options).reduce((s, arr) => s + arr.length, 0),
    0,
  );

  return { label, plans: plans.length, errors, peakPerProvider, confirmed, withinBudget, options, ms };
}

function row(r: Result): string {
  return (
    `${r.label.padEnd(10)} ` +
    `plans ${String(r.plans).padStart(2)}/40  ` +
    `429s ${String(r.errors).padStart(4)}  ` +
    `peak/provider ${r.peakPerProvider}  ` +
    `confirmed ${String(r.confirmed).padStart(2)}/40  ` +
    `withinBudget ${String(r.withinBudget).padStart(2)}/40  ` +
    `options ${String(r.options).padStart(4)}  ` +
    `wall ${r.ms}ms`
  );
}

async function main() {
  console.log("40 concurrent plans · providers throttled to 6 concurrent, ~60ms latency\n");

  const before = await runScenario("A. before", {
    maxConcurrencyPerProvider: Infinity,
    cacheTtlMs: 0,
    disableCoalescing: true,
  });
  console.log(row(before));

  const after = await runScenario("B. after", {
    maxConcurrencyPerProvider: 4,
    cacheTtlMs: 300_000,
  });
  console.log(row(after));

  console.log(
    "\nNote: run A is 'fast' because failing fast is fast — a 429 returns instantly. Run B waits\n" +
      "for real data, so its p50 latency is higher and that is the correct, healthier trade.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
