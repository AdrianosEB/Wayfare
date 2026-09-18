/**
 * eval-local-model — measure how often the locally served student's answer actually satisfies
 * the strict PersonaSchema, exercising the REAL runtime path (LocalStructuredModel, the wire
 * schema, and repairPersonaShape) rather than a reimplementation of it.
 *
 * Usage: WAYFARE_LOCAL_MODEL_URL=http://localhost:8080 tsx scripts/eval-local-model.ts [n]
 */
import { readFileSync } from "node:fs";
import { PersonaSchema } from "@wayfare/orchestrator";
import { readConfig } from "../src/config.js";
import { LocalStructuredModel } from "../src/model.js";
import { PersonaWireSchema, repairPersonaShape } from "../src/nodes.js";

const n = Number(process.argv[2] ?? 25);
const baseUrl = process.env.WAYFARE_LOCAL_MODEL_URL;
if (!baseUrl) throw new Error("set WAYFARE_LOCAL_MODEL_URL");

const config = { ...readConfig(), localBaseUrl: baseUrl };
const model = new LocalStructuredModel(config, baseUrl);

const rows = readFileSync("../../training/data/test.jsonl", "utf8")
  .trim()
  .split("\n")
  .slice(0, n)
  .map((l) => JSON.parse(l) as { messages: { role: string; content: string }[] });

let ok = 0;
const failures: string[] = [];

for (const [i, row] of rows.entries()) {
  const system = row.messages.find((m) => m.role === "system")!.content;
  const user = row.messages.find((m) => m.role === "user")!.content;
  try {
    const out = await model.invoke({
      agent: "persona",
      system,
      user,
      schema: PersonaSchema,
      wireSchema: PersonaWireSchema,
      repair: repairPersonaShape,
    });
    ok++;
    process.stdout.write(`${i + 1}:ok(${out.outputTokens}t) `);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Keep just the first failing path so the tally is readable.
    const first = msg.replace(/\s+/g, " ").slice(0, 150);
    failures.push(first);
    process.stdout.write(`${i + 1}:FAIL `);
  }
}

console.log(`\n\nvalid: ${ok}/${rows.length} (${((ok / rows.length) * 100).toFixed(0)}%)`);
if (failures.length) {
  console.log("\nfailure samples:");
  for (const f of failures.slice(0, 5)) console.log("  -", f);
}
