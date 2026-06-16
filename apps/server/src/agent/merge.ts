import type { AnswerValue, PartySize, TripRequest, Money } from "@wayfare/shared";

/**
 * Merge clarifying answers into the TripRequest (source = 'answer'). Answering bumps a field's
 * source/confidence; skipped questions are left for the planner to default (and reveal as
 * assumptions, US-2.3). Value types follow the question format (API_CONTRACT.md §2).
 */

const isMoney = (v: AnswerValue): v is Money =>
  typeof v === "object" && v !== null && !Array.isArray(v) && "currency" in v;
const isParty = (v: AnswerValue): v is PartySize =>
  typeof v === "object" && v !== null && !Array.isArray(v) && "adults" in v;

export function mergeAnswers(
  base: TripRequest,
  answers: Record<string, AnswerValue>,
  _skipped: string[] = [],
): TripRequest {
  const r: TripRequest = structuredClone(base);

  for (const [id, value] of Object.entries(answers)) {
    switch (id) {
      case "origin":
        if (typeof value === "string") r.origin = { value, source: "answer", confidence: 1 };
        break;
      case "budget":
        if (isMoney(value)) {
          r.budget = {
            value: { amount: value.amount, currency: value.currency, type: r.budget?.value.type ?? "soft" },
            source: "answer",
            confidence: 0.95,
          };
        }
        break;
      case "budget_firmness":
        if (typeof value === "string" && r.budget) {
          r.budget = { ...r.budget, value: { ...r.budget.value, type: value === "hard" ? "hard" : "soft" }, source: "answer" };
        }
        break;
      case "dates_exact":
        if (typeof value === "string" && r.dates) {
          const flexibility = value === "fixed" ? "fixed" : value === "very_flexible" ? "very_flexible" : "window";
          r.dates = { ...r.dates, value: { ...r.dates.value, flexibility }, source: "answer" };
        }
        break;
      case "party":
        if (isParty(value)) {
          r.partySize = {
            value: { adults: value.adults, ...(value.children ? { children: value.children } : {}), ...(value.childAges ? { childAges: value.childAges } : {}) },
            source: "answer",
            confidence: 1,
          };
        }
        break;
      case "vibe_dest": {
        // drives island resolution; only non-default axes are written into vibe (keeps the
        // stored vibe stable when the user confirms the quieter default).
        const axis = String(value);
        const current = r.vibe?.value ?? [];
        const next = [...current];
        if (axis === "lively" && !next.includes("lively")) next.push("lively");
        if (axis === "mix" && !next.includes("mix")) next.push("mix");
        r.vibe = { value: next, source: "answer", confidence: 0.95 };
        break;
      }
      case "interests": {
        const list = Array.isArray(value) ? value : [String(value)];
        const current = new Set(r.mustHaves?.value ?? []);
        for (const i of list) current.add(i);
        r.mustHaves = { value: [...current], source: "answer", confidence: 0.9 };
        break;
      }
      case "avoid":
        if (typeof value === "string" && value.trim()) {
          r.avoid = { value: [value.trim()], source: "answer", confidence: 0.9 };
        }
        break;
      default:
        break;
    }
  }
  return r;
}
