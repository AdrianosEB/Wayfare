/**
 * Run `derivePersona` (the deterministic fallback production uses when the LLM path is off)
 * over a dataset split and write its output in the same MLX chat format as the teacher pass,
 * so the heuristic can be scored as an eval arm and checked with `diagnose_labels.py`.
 *
 *   pnpm tsx training/heuristic_labels.mts training/data/test.jsonl /tmp/heur
 *
 * `derivePersona` reads only `profile.signals`, `request.vibe.value` and
 * `request.budget.value.type`, all recoverable from the row the generator wrote. Other fields
 * are left out.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Imported from the built output by relative path: this file lives outside any workspace
// package, so `@wayfare/orchestrator` does not resolve from here. Run `pnpm -r build` first.
import { derivePersona, Tracer } from "../packages/orchestrator/dist/index.js";
import type { TravelerProfile, TripRequest } from "../packages/orchestrator/dist/index.js";

const [, , inPath, outDir] = process.argv;
if (!inPath || !outDir) {
  console.error("usage: heuristic_labels.mts <split.jsonl> <out-dir>");
  process.exit(1);
}

/** The generator serialises the user turn as three labelled lines; read them back. */
function parseUser(text: string): { signals: string[]; vibe: string[]; budget?: { amount: number; currency: string; type: string } } {
  const grab = (label: string): string | undefined =>
    text.split("\n").find((l) => l.startsWith(`${label}:`))?.slice(label.length + 1).trim();
  const signals = JSON.parse(grab("Signals") ?? "[]") as string[];
  const vibe = JSON.parse(grab("Trip vibe") ?? "[]") as string[];
  const budgetRaw = grab("Budget");
  const budget = budgetRaw && budgetRaw !== "null" ? JSON.parse(budgetRaw) : undefined;
  return { signals, vibe, budget };
}

const rows = readFileSync(inPath, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const tracer = new Tracer();
const out: string[] = [];

for (const row of rows) {
  const { signals, vibe, budget } = parseUser(row.messages[1].content);
  const profile = { signals } as TravelerProfile;
  const request = {
    ...(vibe.length ? { vibe: { value: vibe, source: "prompt" } } : {}),
    ...(budget ? { budget: { value: budget, source: "prompt" } } : {}),
  } as unknown as TripRequest;

  const persona = derivePersona(profile, request, tracer);
  out.push(
    JSON.stringify({
      messages: [
        row.messages[0],
        row.messages[1],
        { role: "assistant", content: JSON.stringify(persona) },
      ],
      meta: row.meta,
    }),
  );
}

const split = inPath.split("/").pop()!.replace(/\.jsonl$/, "");
mkdirSync(outDir, { recursive: true });
const dest = join(outDir, `${split}.jsonl`);
writeFileSync(dest, `${out.join("\n")}\n`);
console.log(`heuristic_labels: ${out.length} rows -> ${dest}`);
