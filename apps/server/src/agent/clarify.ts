import type { ClarifyQuestion, TripRequest } from "@wayfare/shared";
import { findCuratedPack } from "../integrations/curated/index.js";

/**
 * The clarifying-question selector (CONVERSATION_FLOW.md §3). Never asks what's already known;
 * leverage-ranks the few high-impact missing things; caps at 4; every question is skippable
 * with a stated default. One batch, no drip-feed interrogation.
 */

const Q = {
  origin: (): ClarifyQuestion => ({
    id: "origin",
    question: "Where are you flying from?",
    format: "city",
    skippable: true,
    skipDefault: "Assume flexible origin; start from major hubs near you.",
    placeholder: "e.g. London",
  }),
  budget: (): ClarifyQuestion => ({
    id: "budget",
    question: "Roughly what's your total budget?",
    format: "currency",
    skippable: true,
    skipDefault: "Plan a mid-range trip and show the total prominently.",
    placeholder: "e.g. €2,000",
  }),
  budget_firmness: (): ClarifyQuestion => ({
    id: "budget_firmness",
    question: "Is that a hard cap or a target?",
    format: "chips",
    options: [
      { value: "hard", label: "Hard cap" },
      { value: "soft", label: "Flexible target" },
    ],
    skippable: true,
    skipDefault: "Treat it as a soft target.",
  }),
  dates_exact: (): ClarifyQuestion => ({
    id: "dates_exact",
    question: "Fixed dates, or flexible within that window?",
    format: "chips",
    options: [
      { value: "fixed", label: "Fixed" },
      { value: "window", label: "Flexible ±3 days" },
      { value: "very_flexible", label: "Very flexible" },
    ],
    skippable: true,
    skipDefault: "Assume flexible — it usually finds better prices.",
  }),
  party: (): ClarifyQuestion => ({
    id: "party",
    question: "Just you, or who's coming?",
    format: "stepper",
    skippable: true,
    skipDefault: "Assume 1 adult.",
  }),
  vibe_dest_greece: (): ClarifyQuestion => ({
    id: "vibe_dest",
    question: "More lively or quieter?",
    format: "chips",
    options: [
      { value: "lively", label: "Lively (Mykonos)" },
      { value: "quieter", label: "Quieter (Naxos / Milos)" },
      { value: "mix", label: "A mix" },
    ],
    skippable: true,
    skipDefault: "Pick a balanced island for the region.",
  }),
  interests: (): ClarifyQuestion => ({
    id: "interests",
    question: "Anything you really want to do?",
    format: "multiselect",
    options: [
      { value: "beach", label: "Beach" },
      { value: "food", label: "Food" },
      { value: "history", label: "History & culture" },
      { value: "nightlife", label: "Nightlife" },
      { value: "nature", label: "Nature & outdoors" },
      { value: "kids", label: "Kid-friendly" },
    ],
    skippable: true,
    skipDefault: "Plan a balanced mix.",
  }),
  avoid: (): ClarifyQuestion => ({
    id: "avoid",
    question: "Anywhere or anything you'd rather skip?",
    format: "text",
    skippable: true,
    skipDefault: "Nothing to avoid.",
    placeholder: "e.g. been to Barcelona already",
  }),
} as const;

const has = (field: unknown): boolean => field != null;

/** Does the destination have a strong internal vibe axis the user hasn't resolved yet? */
function needsDestVibe(request: TripRequest): ClarifyQuestion | undefined {
  const dest = request.destination?.value;
  if (!dest) return undefined;
  const pack = findCuratedPack(dest);
  if (pack?.id !== "greece") return undefined;
  const blob = `${(request.vibe?.value ?? []).join(" ")} ${(request.mustHaves?.value ?? []).join(" ")}`.toLowerCase();
  if (/livel|quiet|mykonos|naxos|milos|paros/.test(blob)) return undefined;
  return Q.vibe_dest_greece();
}

export function selectClarifyQuestions(request: TripRequest): ClarifyQuestion[] {
  const out: ClarifyQuestion[] = [];

  // 1. origin — near-always top when missing
  if (!has(request.origin)) out.push(Q.origin());

  // 2. budget — governs everything
  if (!has(request.budget)) out.push(Q.budget());
  else if (request.budget && request.budget.confidence < 0.85 && request.budget.value.type == null) {
    out.push(Q.budget_firmness());
  }

  // 3. destination vibe axis (e.g. which Greek island)
  const destVibe = needsDestVibe(request);
  if (destVibe) out.push(destVibe);

  // 4. dates exactness — only if a month/season was given without flexibility expressed
  const d = request.dates?.value;
  if (d && !d.exact && d.flexibility == null) out.push(Q.dates_exact());

  // 5. party — when missing
  if (!has(request.partySize)) out.push(Q.party());

  // 6. interests — only when vibe is empty and there are no must-haves
  if (!(request.vibe?.value.length) && !(request.mustHaves?.value.length)) out.push(Q.interests());

  // 7. avoid — value-seeking (hard budget) travelers, if a slot remains
  if (request.budget?.value.type === "hard" && out.length < 4) out.push(Q.avoid());

  return out.slice(0, 4);
}
