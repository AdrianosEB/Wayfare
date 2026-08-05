import { Orchestrator } from "./orchestrator.js";
import { mockProviderRegistry } from "./providers/mock.js";
import type { TravelerProfile } from "./types.js";

/**
 * Runnable walkthrough — `pnpm --filter @wayfare/orchestrator demo`. It plans a real trip end
 * to end against the procedural mock market and prints what each stage decided, including the
 * cross-check verdicts, the direct-vs-aggregator deals, and the staged (never executed)
 * bookings. Swap `mockProviderRegistry()` for real providers and nothing else changes.
 */

async function main() {
  const traveler: TravelerProfile = {
    id: "u_demo",
    displayName: "Demo traveler",
    homeCity: "London",
    signals: [
      "foodie on a budget",
      "hates 6am flights",
      "wants to be central and walk everywhere",
    ],
    budget: { amount: 1800, currency: "EUR", type: "soft" },
    partySize: { adults: 2 },
    mustHaves: ["food tour"],
    avoid: ["package tours"],
  };

  const orchestrator = new Orchestrator(mockProviderRegistry(), { maxPasses: 3 });
  const plan = await orchestrator.plan(
    "5 day foodie trip to Naxos in September, budget around €1800 for two",
    traveler,
  );

  line();
  console.log("PERSONA :", plan.persona.summary);
  console.log("WEIGHTS :", fmtWeights(plan.persona.weights));
  console.log("PASSES  :", plan.passes, plan.critic.passed ? "(critic passed)" : "(shipped best-effort)");

  line();
  const s = plan.supervisor;
  console.log(
    `SUPERVISOR: fanned out ${s.expanded} branch(es) over ${s.windows} date window(s), ` +
      `pruned ${s.prunedOnBudget} on budget before expanding, kept ${s.kept}.`,
  );
  if (plan.itinerary) {
    console.log(
      `CHOSEN ITINERARY (${plan.itinerary.window?.label ?? "your dates"}): ` +
        `${plan.itinerary.total} ${plan.itinerary.currency} — ${plan.itinerary.withinBudget ? "within budget" : "over budget"}`,
    );
  }
  if (plan.confirmation) {
    console.log(
      `REPRICE  : ${plan.confirmation.confirmed ? "CONFIRMED bookable" : "unconfirmed"} — ` +
        `re-checked ${plan.confirmation.lines.length} legs at source, drift ${plan.confirmation.drift} ${plan.confirmation.currency}`,
    );
  }

  line();
  for (const [kind, r] of Object.entries(plan.selection)) {
    const o = r.option;
    console.log(`${kind.toUpperCase().padEnd(9)} ${o.entity.name}`);
    console.log(
      `          ${o.best.price.amount} ${o.best.price.currency} · ${o.verdict} · ${o.sources.length} source(s) · conf ${o.confidence.toFixed(2)}`,
    );
    if (o.directDeal) {
      console.log(
        `          ↳ direct deal: ${o.directDeal.directPrice} via ${o.directDeal.directSource} vs ${o.directDeal.aggregatorPrice} via ${o.directDeal.aggregatorSource} (save ${o.directDeal.savings})`,
      );
    }
  }

  line();
  console.log(`BUDGET  : ${plan.budget.total} ${plan.budget.currency} — ${plan.budget.status}`);
  for (const l of plan.budget.lines) {
    console.log(`          ${l.category.padEnd(12)} ${l.amount} ${plan.budget.currency}`);
  }
  for (const s of plan.budget.savings) {
    console.log(`          saving: ${s.description} (${s.delta})`);
  }

  line();
  console.log("STAGED BOOKINGS (require human approval — nothing was booked or called):");
  for (const b of plan.bookingIntents) {
    console.log(`  • [${b.channel}] ${b.entity.name} — ${b.status}`);
    for (const step of b.callScript) console.log(`      · ${step}`);
  }

  if (plan.critic.issues.length) {
    line();
    console.log("CRITIC NOTES:");
    for (const i of plan.critic.issues) console.log(`  [${i.severity}] ${i.message}`);
  }
  line();
}

function line() {
  console.log("─".repeat(72));
}

function fmtWeights(w: Record<string, number>): string {
  return Object.entries(w)
    .map(([k, v]) => `${k} ${v.toFixed(2)}`)
    .join("  ");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
