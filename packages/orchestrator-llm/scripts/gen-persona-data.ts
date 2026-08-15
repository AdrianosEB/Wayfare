/**
 * gen-persona-data — build the MLX chat-format dataset that distils the persona agent into a
 * local small model.
 *
 * The shape of the thing:
 *
 *   1. Synthesize a TravelerProfile + prompt sentence from the committed signal pool (cheap,
 *      deterministic, no API).
 *   2. Run the *real* deterministic `intake()` to get a real TripRequest — same call the graph
 *      makes when intake isn't LLM-routed.
 *   3. Run `personaNode` ALONE (never the graph) against a recording model that wraps
 *      AnthropicStructuredModel. One model call per example.
 *   4. Write {system, user, assistant} exactly as the node sent/received it.
 *
 * Why a recording *wrapper* rather than rebuilding the prompt here: `personaNode` owns the user
 * string, and duplicating that construction would let the two drift. The wrapper captures what
 * was actually sent, so the student always learns the prompt the production node uses.
 *
 * It also closes a real trap. `decide()` in nodes.ts swallows non-schema errors (network,
 * timeout) and silently falls back to the deterministic `derivePersona`. Without detection those
 * heuristic labels would land in the dataset wearing the teacher's clothes. The wrapper records
 * only when the model actually answered, so a fallback shows up as "no record" → discarded.
 *
 * Safety rails, all on by default: --limit 25, --max-cost-usd 5, and --dry-run to see prompts
 * without spending anything. Progress is checkpointed to a sidecar so a crash costs nothing.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Tracer,
  intake,
  mockProviderRegistry,
  SearchLimits,
  PersonaSchema,
  type Candidate,
  type Persona,
  type TravelerProfile,
} from "@wayfare/orchestrator";

import type { AgentName, LlmConfig } from "../src/config.js";
import { LlmBudget } from "../src/budget.js";
import {
  AnthropicStructuredModel,
  DryRunSkip,
  type StructuredCall,
  type StructuredModel,
  type StructuredResult,
} from "../src/model.js";
import { personaNode } from "../src/nodes.js";
import { ToolLedger, type ToolContext } from "../src/tools.js";
import type { PlanStateType } from "../src/state.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(PKG_ROOT, "..", "..");

/* -------------------------------------------------------------------------- */
/* Plan: 3,000 examples. Test draws from a disjoint signal pool.               */
/* -------------------------------------------------------------------------- */

type Split = "train" | "valid" | "test" | "test-adversarial";

const SPLIT_SIZES: Record<Split, number> = { train: 2400, valid: 300, test: 300, "test-adversarial": 150 };
/** Distinct seed offsets so no two splits ever draw the same profile. */
const SPLIT_SEED_OFFSET: Record<Split, number> = {
  train: 0,
  valid: 1_000_000,
  test: 2_000_000,
  "test-adversarial": 3_000_000,
};

type Dimension = "price" | "quality" | "location" | "vibe" | "flexibility";
const DIMENSIONS: readonly Dimension[] = ["price", "quality", "location", "vibe", "flexibility"];

/**
 * A tagged signal from the authored pools. `p` is a direction WITHIN the dimension (see the
 * fixture description), so a (+1, -1) pair on one dimension is a genuine contradiction. The
 * adversarial pool is untagged (`d`/`p` absent) — no deliberate conflicts are constructed
 * there; its whole point is messy, adversarially-phrased free text.
 */
interface Signal {
  s: string;
  d?: Dimension;
  p?: 1 | -1;
}

/** Fraction of authored-pool profiles that get a deliberately contradictory pair. */
const CONFLICT_RATE = 0.3;

/** Claude API list price, USD per million tokens. Override with --price-in / --price-out. */
const DEFAULT_PRICE_IN_PER_MTOK = 5;
const DEFAULT_PRICE_OUT_PER_MTOK = 25;

/* -------------------------------------------------------------------------- */
/* CLI                                                                         */
/* -------------------------------------------------------------------------- */

interface Options {
  splits: Split[];
  /** true when --split named splits explicitly (vs the implicit "all"). */
  splitsExplicit: boolean;
  limit: number;
  dryRun: boolean;
  maxCostUsd: number;
  outDir: string;
  seed: number;
  priceIn: number;
  priceOut: number;
  fresh: boolean;
}

function parseArgs(argv: string[]): Options {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    if (i === -1) return undefined;
    const v = argv[i + 1];
    if (v == null || v.startsWith("--")) die(`${flag} needs a value`);
    return v;
  };
  const num = (flag: string, fallback: number): number => {
    const raw = get(flag);
    if (raw == null) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) die(`${flag} must be a non-negative number, got "${raw}"`);
    return n;
  };

  const splitRaw = get("--split") ?? "all";
  const splits: Split[] =
    splitRaw === "all"
      ? ["train", "valid", "test", "test-adversarial"]
      : splitRaw.split(",").map((s) => {
          const t = s.trim();
          if (t !== "train" && t !== "valid" && t !== "test" && t !== "test-adversarial") {
            die(`unknown split "${t}"`);
          }
          return t;
        });

  return {
    splits,
    splitsExplicit: splitRaw !== "all",
    // Default 25, not "everything": nothing in this script runs unbounded without being asked.
    limit: num("--limit", 25),
    dryRun: argv.includes("--dry-run"),
    maxCostUsd: num("--max-cost-usd", 5),
    outDir: resolve(get("--out") ?? join(REPO_ROOT, "training", "data")),
    seed: num("--seed", 20260814),
    priceIn: num("--price-in", DEFAULT_PRICE_IN_PER_MTOK),
    priceOut: num("--price-out", DEFAULT_PRICE_OUT_PER_MTOK),
    fresh: argv.includes("--fresh"),
  };
}

function die(msg: string): never {
  console.error(`gen-persona-data: ${msg}`);
  process.exit(1);
}

/* -------------------------------------------------------------------------- */
/* Deterministic sampling — same seed, same dataset, so resume is consistent.  */
/* -------------------------------------------------------------------------- */

/** mulberry32: small, fast, good enough, and reproducible across runs and machines. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const pickInt = (r: () => number, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));

/** Sample n distinct items. */
function sampleN<T>(r: () => number, xs: readonly T[], n: number): T[] {
  const idx = new Set<number>();
  const want = Math.min(n, xs.length);
  while (idx.size < want) idx.add(Math.floor(r() * xs.length));
  return [...idx].map((i) => xs[i]!);
}

/* -------------------------------------------------------------------------- */
/* Input synthesis                                                             */
/* -------------------------------------------------------------------------- */

const HOME_CITIES = [
  "London", "Manchester", "Dublin", "Edinburgh", "Berlin", "Munich", "Paris", "Lyon",
  "Amsterdam", "Copenhagen", "Stockholm", "Madrid", "Barcelona", "Lisbon", "Milan", "Rome",
  "Vienna", "Zurich", "Warsaw", "Prague", "New York", "Boston", "Chicago", "Toronto",
] as const;

const DESTINATIONS = [
  "Naxos", "Crete", "Lisbon", "Porto", "Seville", "San Sebastian", "Palermo", "Puglia",
  "Split", "Ljubljana", "Kraków", "Budapest", "Tallinn", "Bergen", "the Azores", "Madeira",
  "Marrakesh", "Istanbul", "Kyoto", "Lisbon's coast", "the Dolomites", "Mallorca", "Corfu",
  "Reykjavik", "Copenhagen", "Valencia", "Bologna", "Antwerp", "Gdansk", "Cascais",
] as const;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const CURRENCIES = ["EUR", "GBP", "USD"] as const;

/**
 * Trip-style words the deterministic intake recognises (VIBE_KEYWORDS in agents/intake.ts).
 * Sprinkling them into the sentence varies `request.vibe` in the persona's user prompt —
 * without them every example reads `Trip vibe: ["budget"]` and the student never sees the field
 * carry information.
 */
const TRIP_STYLES = [
  "foodie", "beach", "culture", "relaxed", "adventure", "romantic",
  "nightlife", "luxury", "hiking", "art", "island", "surf",
] as const;

/**
 * Budget phrasings, chosen against BOTH intake regexes at once: the amount only parses after
 * `under|around|about|~|budget of|<|up to`, and hardness is a separate `/under|max|no more
 * than|hard/` test on the whole sentence. Every phrase below parses an amount; the hard ones
 * additionally trip the hardness test.
 */
const SOFT_BUDGET_PHRASES = ["budget around", "budget of about", "around", "budget of ~"] as const;
const HARD_BUDGET_PHRASES = ["under", "max budget of", "up to (max)"] as const;

const MUST_HAVES = [
  "wifi", "kitchen", "air conditioning", "step-free access", "parking", "washing machine",
  "breakfast included", "pool", "balcony", "pet friendly", "late check-in", "gym",
] as const;

const AVOIDS = [
  "hostels", "shared bathrooms", "long transfers", "early flights", "resorts", "car hire",
  "smoking rooms", "ground floor", "budget airlines", "guided tours",
] as const;

/** Per-example metadata, written alongside `messages` so the eval can slice on it. */
interface ExampleMeta {
  /** true only for deliberately-constructed contradictions, not incidental ones. */
  conflict: boolean;
  /** the dimension the contradictory pair sits on, when conflict is true. */
  dimension?: Dimension;
}

interface SynthInput {
  prompt: string;
  profile: TravelerProfile;
  meta: ExampleMeta;
}

/**
 * Draw this profile's signals. In CONFLICT_RATE of tagged-pool profiles, deliberately pair one
 * +1 with one -1 on the SAME dimension — reconciling "counts every euro" against "money is
 * genuinely not the constraint here" is the hard judgment the student has to learn, and left to
 * uniform sampling that tension appears too rarely to train or measure. The pair's position is
 * shuffled so the contradiction isn't always the first two signals.
 */
function drawSignals(r: () => number, pool: readonly Signal[]): { signals: string[]; meta: ExampleMeta } {
  const tagged = pool.every((x) => x.d != null && x.p != null);

  if (tagged && r() < CONFLICT_RATE) {
    // Only dimensions where the pool actually holds both directions can host a contradiction.
    const eligible = DIMENSIONS.filter(
      (dim) => pool.some((x) => x.d === dim && x.p === 1) && pool.some((x) => x.d === dim && x.p === -1),
    );
    if (eligible.length > 0) {
      const dim = pick(r, eligible);
      const plus = pick(r, pool.filter((x) => x.d === dim && x.p === 1));
      const minus = pick(r, pool.filter((x) => x.d === dim && x.p === -1));
      const rest = pool.filter((x) => x.s !== plus.s && x.s !== minus.s);
      const extras = sampleN(r, rest, pickInt(r, 0, 3));
      const all = [plus, minus, ...extras].map((x) => x.s);
      // Fisher–Yates on the assembled list so ordering carries no signal.
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [all[i], all[j]] = [all[j]!, all[i]!];
      }
      return { signals: all, meta: { conflict: true, dimension: dim } };
    }
  }

  return {
    signals: sampleN(r, pool, pickInt(r, 1, 5)).map((x) => x.s),
    meta: { conflict: false },
  };
}

/**
 * Build one profile + sentence. Every axis varies independently; signals come from the split's
 * own pool via drawSignals, which owns the deliberate-conflict construction.
 */
function synthesize(r: () => number, pool: readonly Signal[], index: number): SynthInput {
  const homeCity = pick(r, HOME_CITIES);
  const destination = pick(r, DESTINATIONS);
  const month = pick(r, MONTHS);
  const nights = pickInt(r, 2, 14);

  // Party shape: solo / couple / family / group, each with its own realistic spread.
  const shape = pick(r, ["solo", "couple", "family", "group"] as const);
  const adults = shape === "solo" ? 1 : shape === "couple" ? 2 : shape === "family" ? 2 : pickInt(r, 3, 8);
  const children = shape === "family" ? pickInt(r, 1, 3) : 0;
  const childAges = Array.from({ length: children }, () => pickInt(r, 1, 16));
  const travellers = adults + children;

  const currency = pick(r, CURRENCIES);
  // Scale the budget to party size and length so "tight" and "generous" both stay plausible.
  const perPersonPerNight = pickInt(r, 45, 400);
  const amount = Math.round((perPersonPerNight * travellers * nights) / 50) * 50;
  const type = r() < 0.4 ? ("hard" as const) : ("soft" as const);

  const { signals, meta } = drawSignals(r, pool);
  const mustHaves = r() < 0.55 ? sampleN(r, MUST_HAVES, pickInt(r, 1, 3)) : [];
  const avoid = r() < 0.45 ? sampleN(r, AVOIDS, pickInt(r, 1, 2)) : [];

  const partyPhrase =
    shape === "solo"
      ? "solo"
      : shape === "couple"
        ? "for two"
        : shape === "family"
          ? `for ${adults} adults and ${children} ${children === 1 ? "child" : "children"}`
          : `for a group of ${adults}`;

  const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
  const money = `${symbol}${amount.toLocaleString("en-GB")}`;

  // Phrase the budget so intake actually derives the type we rolled — otherwise every example
  // would read type:"soft" and the student would never see hard constraints.
  const budgetPhrase =
    type === "hard"
      ? (() => {
          const p = pick(r, HARD_BUDGET_PHRASES);
          return p === "up to (max)" ? `up to ${money} max` : `${p} ${money}`;
        })()
      : `${pick(r, SOFT_BUDGET_PHRASES)} ${money}`;

  // ~60% of prompts carry a trip-style word intake recognises, so `Trip vibe` in the persona's
  // user prompt varies instead of always echoing ["budget"].
  const style = r() < 0.6 ? `${pick(r, TRIP_STYLES)} ` : "";

  const prompt =
    `${nights} day ${style}trip to ${destination} in ${month}, ${partyPhrase}, ${budgetPhrase}`;

  const profile: TravelerProfile = {
    id: `synth_${index}`,
    homeCity,
    signals,
    budget: { amount, currency, type },
    partySize: children > 0 ? { adults, children, childAges } : { adults },
    mustHaves,
    avoid,
  };

  return { prompt, profile, meta };
}

/* -------------------------------------------------------------------------- */
/* The recording model                                                         */
/* -------------------------------------------------------------------------- */

interface Recorded {
  system: string;
  user: string;
  value: Persona;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Wraps the real model and remembers the last call. `last` is cleared before every example, so
 * a null `last` afterwards is an unambiguous signal that `decide()` fell back to the heuristic
 * and the example must be discarded rather than written as teacher output.
 *
 * With `inner: null` it records the prompt and throws DryRunSkip — the --dry-run path, which
 * exercises the identical prompt-building code without spending anything.
 */
class RecordingModel implements StructuredModel {
  last: Recorded | undefined;

  constructor(private readonly inner: StructuredModel | null) {}

  async invoke<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
    if (!this.inner) {
      this.last = {
        system: call.system,
        user: call.user,
        value: undefined as unknown as Persona,
        inputTokens: 0,
        outputTokens: 0,
      };
      throw new DryRunSkip(call.agent);
    }
    const out = await this.inner.invoke(call);
    this.last = {
      system: call.system,
      user: call.user,
      value: out.value as unknown as Persona,
      inputTokens: out.inputTokens,
      outputTokens: out.outputTokens,
    };
    return out;
  }
}

/* -------------------------------------------------------------------------- */
/* Resume state — the jsonl format is fixed by the spec, so progress lives in  */
/* a sidecar rather than an extra field on each line.                          */
/* -------------------------------------------------------------------------- */

interface ResumeState {
  version: 1;
  seed: number;
  nextIndex: number;
  written: number;
  discarded: number;
  inputTokens: number;
  outputTokens: number;
}

const statePath = (outDir: string, split: Split) => join(outDir, `.${split}.progress.json`);

function loadState(outDir: string, split: Split, seed: number, fresh: boolean): ResumeState {
  const empty: ResumeState = {
    version: 1, seed, nextIndex: 0, written: 0, discarded: 0, inputTokens: 0, outputTokens: 0,
  };
  const p = statePath(outDir, split);
  if (fresh || !existsSync(p)) return empty;
  try {
    const s = JSON.parse(readFileSync(p, "utf8")) as ResumeState;
    if (s.version !== 1 || s.seed !== seed) {
      die(
        `${p} was written with seed ${s.seed}; this run uses ${seed}. ` +
          `Re-run with the original seed, or pass --fresh to start over.`,
      );
    }
    return s;
  } catch (err) {
    die(`could not read ${p}: ${(err as Error).message}`);
  }
}

const saveState = (outDir: string, split: Split, s: ResumeState): void =>
  writeFileSync(statePath(outDir, split), `${JSON.stringify(s, null, 2)}\n`);

/* -------------------------------------------------------------------------- */
/* Main                                                                        */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  const poolPath = join(PKG_ROOT, "fixtures", "persona-signals.json");
  if (!existsSync(poolPath)) die(`signal pool fixture missing at ${poolPath}`);
  const pools = JSON.parse(readFileSync(poolPath, "utf8")) as {
    version: number;
    train: Signal[];
    test: Signal[];
  };
  if (pools.version !== 2) die(`expected persona-signals.json version 2, found ${pools.version}`);
  if (!pools.train?.length || !pools.test?.length) die("signal pool fixture is empty or malformed");

  for (const [name, pool] of [["train", pools.train], ["test", pools.test]] as const) {
    for (const sig of pool) {
      if (!sig.s || !DIMENSIONS.includes(sig.d as Dimension) || (sig.p !== 1 && sig.p !== -1)) {
        die(`malformed ${name} signal (needs s, d, p=±1): ${JSON.stringify(sig)}`);
      }
    }
  }

  // The disjointness the eval depends on is an invariant, not a comment — check it.
  const trainTexts = new Set(pools.train.map((x) => x.s));
  const overlap = pools.test.filter((x) => trainTexts.has(x.s));
  if (overlap.length) {
    die(`signal pools overlap on ${overlap.length} entries (test must be disjoint): ${overlap[0]!.s}`);
  }

  // Adversarial pool: model-authored, deliberately messy phrasing, untagged, feeds ONLY
  // test-adversarial. It measures distribution shift, not a human baseline.
  const adversarialPath = join(PKG_ROOT, "fixtures", "persona-signals-adversarial.json");
  const adversarialRaw = existsSync(adversarialPath)
    ? (JSON.parse(readFileSync(adversarialPath, "utf8")) as { signals: string[] })
    : { signals: [] };
  const adversarialPool: Signal[] = (adversarialRaw.signals ?? []).map((s) => ({ s }));
  const authoredTexts = new Set([...pools.train, ...pools.test].map((x) => x.s));
  const adversarialOverlap = adversarialPool.filter((x) => authoredTexts.has(x.s));
  if (adversarialOverlap.length) {
    die(
      `persona-signals-adversarial.json duplicates ${adversarialOverlap.length} authored signal(s) — the ` +
        `adversarial pool must be disjoint from the authored pools: "${adversarialOverlap[0]!.s}"`,
    );
  }


  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!opts.dryRun && !apiKey) {
    die("ANTHROPIC_API_KEY is not set. Set it, or pass --dry-run to inspect prompts for free.");
  }

  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
  mkdirSync(opts.outDir, { recursive: true });

  console.log(
    `gen-persona-data — ${opts.dryRun ? "DRY RUN (no API calls)" : `teacher: ${model}`}\n` +
      `  splits      ${opts.splits.join(", ")}\n` +
      `  limit       ${opts.limit} example(s) per split\n` +
      `  max cost    $${opts.maxCostUsd.toFixed(2)} (in $${opts.priceIn}/MTok, out $${opts.priceOut}/MTok)\n` +
      `  out         ${opts.outDir}\n` +
      `  seed        ${opts.seed}\n` +
      `  pool        ${pools.train.length} train signals, ${pools.test.length} held-back test signals, ` +
      `${adversarialPool.length} adversarial (test-adversarial)\n` +
      `  conflicts   ~${Math.round(CONFLICT_RATE * 100)}% of authored-pool profiles get a deliberate ±pair\n`,
  );

  let costSoFar = 0;
  let aborted = false;

  for (const split of opts.splits) {
    if (aborted) break;

    // train+valid draw the authored `train` pool; test draws the held-back authored pool;
    // test-adversarial draws only the adversarially-phrased pool.
    let pool: readonly Signal[];
    if (split === "test-adversarial") {
      if (adversarialPool.length < 40) {
        const msg =
          `test-adversarial needs at least 40 signals in fixtures/persona-signals-adversarial.json ` +
          `(found ${adversarialPool.length}). The pool is adversarially-phrased, model-authored ` +
          `input — messy, typo-ridden, contradictory free text — used to measure how the student ` +
          `holds up under distribution shift from the clean authored pools.`;
        if (opts.splitsExplicit) die(msg);
        console.warn(`[test-adversarial] skipped: ${msg}`);
        continue;
      }
      pool = adversarialPool;
    } else {
      pool = split === "test" ? pools.test : pools.train;
    }

    // A dry run must never touch progress: advancing nextIndex here would make the next real run
    // skip the examples it only ever printed, silently shrinking the dataset.
    const state = opts.dryRun
      ? loadState(opts.outDir, split, opts.seed, true)
      : loadState(opts.outDir, split, opts.seed, opts.fresh);
    const target = SPLIT_SIZES[split];
    const outFile = join(opts.outDir, `${split}.jsonl`);

    if (opts.fresh && existsSync(outFile)) writeFileSync(outFile, "");

    if (state.nextIndex >= target) {
      console.log(`[${split}] already complete (${state.written} written). Skipping.`);
      continue;
    }
    if (state.nextIndex > 0) {
      console.log(`[${split}] resuming at index ${state.nextIndex} (${state.written} already written)`);
    }

    const budgetCfg: LlmConfig = {
      enabled: true,
      agents: new Set<AgentName>(["persona"]),
      // The real ceiling for this script is --max-cost-usd; keep the per-plan caps out of the way.
      maxCalls: Number.MAX_SAFE_INTEGER,
      maxTokens: Number.MAX_SAFE_INTEGER,
      dryRun: false,
      maxPasses: 1,
      model,
    };

    const inner = opts.dryRun ? null : new AnthropicStructuredModel(budgetCfg, apiKey!);
    const recorder = new RecordingModel(inner);

    const doneThisRun = { count: 0 };
    const endIndex = Math.min(target, state.nextIndex + opts.limit);

    for (let index = state.nextIndex; index < endIndex; index++) {
      if (!opts.dryRun && costSoFar >= opts.maxCostUsd) {
        console.log(
          `\n[${split}] cost ceiling reached ($${costSoFar.toFixed(4)} >= $${opts.maxCostUsd.toFixed(2)}). ` +
            `Stopping cleanly at index ${index}.`,
        );
        aborted = true;
        break;
      }

      const r = rng(opts.seed + SPLIT_SEED_OFFSET[split] + index);
      const { prompt, profile, meta } = synthesize(r, pool, index);

      const tracer = new Tracer();
      const { request, destination } = intake(prompt, profile, tracer);

      recorder.last = undefined;

      const deps = {
        model: recorder,
        budget: new LlmBudget(budgetCfg, tracer),
        ctx: toolContext(tracer),
        tracer,
      };

      // personaNode reads only `profile` and `request`; the rest of PlanState is irrelevant here.
      // Building the full Annotation-derived state would be noise, so assert the slice it uses.
      const state0 = { prompt, profile, request, destination } as unknown as PlanStateType;

      try {
        await personaNode(deps)(state0);
      } catch (err) {
        console.warn(`[${split}] index ${index}: ${(err as Error).message}`);
      }

      // Cast, not annotation: TS narrows `recorder.last` to undefined from the reset above and
      // can't see the mutation inside invoke(); an annotation alone doesn't defeat that.
      const rec = recorder.last as Recorded | undefined;

      if (opts.dryRun) {
        console.log(`\n─── [${split}] index ${index} ${"─".repeat(40)}`);
        console.log(`PROMPT   ${prompt}`);
        console.log(`SIGNALS  ${JSON.stringify(profile.signals)}`);
        if (meta.conflict) console.log(`CONFLICT deliberate, on "${meta.dimension}"`);
        console.log(`SYSTEM   ${rec ? `${rec.system.slice(0, 200)}…` : "(node did not call the model)"}`);
        console.log(`USER     ${rec?.user ?? "(none)"}`);
        state.nextIndex = index + 1;
        doneThisRun.count++;
        continue;
      }

      state.nextIndex = index + 1;
      doneThisRun.count++;

      // No record means decide() swallowed an error and used derivePersona. That output is the
      // heuristic, not the teacher — discard it rather than poison the training set.
      if (!rec) {
        state.discarded++;
        console.warn(`[${split}] index ${index}: no model output (fell back to heuristic) — discarded`);
        saveState(opts.outDir, split, state);
        continue;
      }

      state.inputTokens += rec.inputTokens;
      state.outputTokens += rec.outputTokens;
      costSoFar += (rec.inputTokens / 1e6) * opts.priceIn + (rec.outputTokens / 1e6) * opts.priceOut;

      // Belt and braces: AnthropicStructuredModel already validates, but a dataset is forever.
      const parsed = PersonaSchema.safeParse(rec.value);
      if (!parsed.success) {
        state.discarded++;
        console.warn(`[${split}] index ${index}: output failed PersonaSchema — discarded`);
        saveState(opts.outDir, split, state);
        continue;
      }

      // `meta` rides alongside `messages` so the Phase 3 eval can slice conflict vs clean
      // profiles (and recover the raw inputs) without re-deriving them. mlx_lm's chat loader
      // reads only the `messages` key and ignores unknown siblings.
      const line = JSON.stringify({
        messages: [
          { role: "system", content: rec.system },
          { role: "user", content: rec.user },
          { role: "assistant", content: JSON.stringify(parsed.data) },
        ],
        meta: {
          split,
          index,
          conflict: meta.conflict,
          ...(meta.dimension ? { dimension: meta.dimension } : {}),
          signals: profile.signals,
        },
      });
      appendFileSync(outFile, `${line}\n`);
      state.written++;
      saveState(opts.outDir, split, state);

      if (state.written % 50 === 0) {
        console.log(
          `[${split}] ${state.written} written / ${state.discarded} discarded — ` +
            `${state.inputTokens.toLocaleString()} in + ${state.outputTokens.toLocaleString()} out tokens, ` +
            `$${costSoFar.toFixed(4)} spent`,
        );
      }
    }

    if (!opts.dryRun) saveState(opts.outDir, split, state);
    console.log(
      `\n[${split}] ${doneThisRun.count} processed this run — ` +
        `${state.written}/${target} written, ${state.discarded} discarded, ` +
        `at index ${state.nextIndex}/${target}.`,
    );
  }

  if (!opts.dryRun) {
    console.log(`\nTotal spend this run: $${costSoFar.toFixed(4)} of $${opts.maxCostUsd.toFixed(2)} allowed.`);
  }
  console.log("Re-run the same command to continue; completed examples are skipped.");
}

/** personaNode never touches the toolbox, but NodeDeps requires one. Keep it real and cheap. */
function toolContext(tracer: Tracer): ToolContext {
  const providers = mockProviderRegistry();
  return {
    providers,
    aggregatorIds: new Set(providers.filter((p) => p.aggregator).map((p) => p.id)),
    limits: new SearchLimits<Candidate[]>(),
    tracer,
    ledger: new ToolLedger(),
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
