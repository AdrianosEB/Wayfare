import type { Budget, TripRequest } from "@wayfare/shared";
import type { CriticIssue, CriticReport, RankedOption, TravelerProfile } from "../types.js";
import type { Tracer } from "../trace.js";

/**
 * CriticAgent — the self-check. After a pass produces a plan, the critic re-reads it against
 * the invariants that make the answer trustworthy and returns issues, each with a `remedy` the
 * orchestrator knows how to act on. Blockers force another pass (broaden the search, relax a
 * weight); warnings are surfaced but don't fail the plan.
 *
 * This is what "self-check and verify" means at the plan level: the orchestration doesn't just
 * emit its first guess, it grades it and tries again when it falls short.
 */

export interface CriticInput {
  selection: Record<string, RankedOption>;
  budget: Budget;
  request: TripRequest;
  profile: TravelerProfile;
  /** kinds we tried to shop for, so a missing category is caught. */
  expectedKinds: string[];
}

export function review(input: CriticInput, tracer: Tracer): CriticReport {
  const issues: CriticIssue[] = [];
  const { selection, budget, profile, expectedKinds } = input;

  // 1. every expected category actually got filled.
  for (const kind of expectedKinds) {
    if (!selection[kind]) {
      issues.push({
        severity: "blocker",
        code: "missing_category",
        message: `No option selected for "${kind}".`,
        remedy: "broaden_search",
      });
    }
  }

  // 2. nothing we lead with is suspect or unverified.
  for (const [kind, r] of Object.entries(selection)) {
    if (r.option.verdict === "suspect") {
      issues.push({
        severity: "blocker",
        code: "suspect_selection",
        message: `Leading "${kind}" pick "${r.option.entity.name}" is suspect (${r.option.flags.join(", ")}).`,
        remedy: "broaden_search",
      });
    } else if (r.option.verdict === "unconfirmed") {
      issues.push({
        severity: "warning",
        code: "unconfirmed_selection",
        message: `"${r.option.entity.name}" is only listed by one source — price not corroborated.`,
        remedy: "broaden_search",
      });
    }
  }

  // 3. budget respected — a hard cap is a blocker, a soft overage is a warning.
  if (budget.status === "over") {
    const hard = budget.target?.type === "hard";
    issues.push({
      severity: hard ? "blocker" : "warning",
      code: "over_budget",
      message: budget.overageNote ?? `Plan total ${budget.total} ${budget.currency} exceeds target.`,
      remedy: "relax_quality",
    });
  }

  // 4. explicit must-haves are represented somewhere in the selection.
  const haystack = Object.values(selection)
    .flatMap((r) => [r.option.entity.name, ...r.option.tags])
    .join(" ")
    .toLowerCase();
  for (const must of profile.mustHaves) {
    const token = must.toLowerCase().split(/\s+/)[0] ?? must.toLowerCase();
    if (token && !haystack.includes(token)) {
      issues.push({
        severity: "warning",
        code: "musthave_unmet",
        message: `Must-have "${must}" isn't clearly reflected in the picks.`,
        remedy: "broaden_search",
      });
    }
  }

  const passed = !issues.some((i) => i.severity === "blocker");
  tracer.emit("critic", "reviewed", {
    passed,
    blockers: issues.filter((i) => i.severity === "blocker").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
  });
  return { passed, issues };
}
