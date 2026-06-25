import type { Tracked, TripRequest } from "@wayfare/shared";

/**
 * Heuristic prompt parser — extracts every constraint it reasonably can from a single sentence
 * (US-1.2) so the user is never re-asked what they already said. This is the deterministic,
 * offline parser; when ANTHROPIC_API_KEY is set the server can swap in a structured Claude call
 * (see CONVERSATION_FLOW.md §2). Confidences mirror the worked example in the docs.
 */

const t = <T>(value: T, source: Tracked<T>["source"], confidence: number): Tracked<T> => ({
  value,
  source,
  confidence,
});

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const VIBE_KEYWORDS = ["relaxed", "beach", "lively", "party", "romantic", "culture", "nature", "city", "sunny", "fun", "family", "foodie", "adventure"];

function parseAmount(s: string): number {
  return Number(s.replace(/[, ]/g, ""));
}

function currencyOf(symbol: string): string {
  if (symbol.includes("€") || /eur|euro/i.test(symbol)) return "EUR";
  if (symbol.includes("£") || /gbp|pound/i.test(symbol)) return "GBP";
  if (symbol.includes("$") || /usd|dollar/i.test(symbol)) return "USD";
  return "EUR";
}

export interface ParseResult {
  request: TripRequest;
  agentMessage: string;
}

export function parsePrompt(prompt: string): ParseResult {
  const text = prompt.toLowerCase();
  const request: TripRequest = {};

  // duration
  const dayMatch = text.match(/(\d+)\s*-?\s*day/);
  const weekMatch = /\bweek\b/.test(text);
  const weekendMatch = /\bweekend\b/.test(text);
  if (dayMatch) request.durationDays = t(Number(dayMatch[1]), "prompt", 0.98);
  else if (weekendMatch) request.durationDays = t(3, "prompt", 0.7);
  else if (weekMatch) request.durationDays = t(7, "prompt", 0.8);

  // party size
  const justMe = /\b(just me|solo|by myself|on my own)\b/.test(text);
  const peopleMatch = text.match(/(?:for\s+)?(\d+|one|two|three|four|five|six|seven|eight)\s+(?:people|adults|of us|travelers)/);
  const coupleMatch = /\bcouple\b/.test(text);
  if (justMe) request.partySize = t({ adults: 1 }, "prompt", 0.95);
  else if (peopleMatch) {
    const n = NUM_WORDS[peopleMatch[1]!] ?? Number(peopleMatch[1]);
    request.partySize = t({ adults: n }, "prompt", 0.95);
  } else if (coupleMatch) request.partySize = t({ adults: 2 }, "prompt", 0.9);

  // budget
  const moneyMatch = text.match(/([€£$])\s*([\d,]+)|\b([\d,]+)\s*(eur|euros|gbp|pounds|usd|dollars)\b/);
  if (moneyMatch) {
    const symbol = moneyMatch[1] ?? moneyMatch[4] ?? "€";
    const amount = parseAmount(moneyMatch[2] ?? moneyMatch[3] ?? "0");
    const hard = /\b(max|all in|all-in|under|hard cap|no more than|tops|firm)\b/.test(text);
    const soft = /\b(around|about|roughly|~|approximately|ish)\b/.test(text);
    const type: "hard" | "soft" = hard ? "hard" : "soft";
    request.budget = t({ amount, currency: currencyOf(symbol), type }, "prompt", soft || hard ? 0.9 : 0.8);
  }

  // dates
  const monthIdx = MONTHS.findIndex((m) => text.includes(m));
  const part = /\blate\b/.test(text) ? "late" : /\bearly\b/.test(text) ? "early" : /\bmid\b/.test(text) ? "mid" : undefined;
  const flexible = /\bflexible\b|\bflexibility\b|\bany time\b/.test(text);
  const veryFlexible = /\bvery flexible\b|\bwhenever\b|\banytime\b/.test(text);
  const fixed = /\bfixed\b|\bexact\b|\bspecific dates\b/.test(text);
  const easter = /\beaster\b/.test(text);
  if (monthIdx >= 0 || easter) {
    const month = easter ? 4 : monthIdx + 1;
    const flexibility = fixed || easter ? "fixed" : veryFlexible ? "very_flexible" : flexible || part ? "window" : "window";
    request.dates = t(
      { month, ...(part ? { part } : easter ? {} : {}), flexibility },
      "prompt",
      0.9,
    );
  } else if (flexible || veryFlexible) {
    request.dates = t({ flexibility: veryFlexible ? "very_flexible" : "window" }, "prompt", 0.6);
  }

  // vibe (ordered)
  const vibe: string[] = [];
  for (const k of VIBE_KEYWORDS) {
    if (text.includes(k) && !vibe.includes(k)) vibe.push(k);
  }
  if (/\bkids?\b|\bchildren\b|\bfamily\b/.test(text) && !vibe.includes("family")) vibe.push("family");
  if (vibe.length) request.vibe = t(vibe, "prompt", 0.9);

  // pace (inferred from vibe)
  if (/\bpacked\b|\bbusy\b|\bsee everything\b/.test(text)) request.pace = t("packed", "inferred", 0.7);
  else if (vibe.includes("relaxed")) request.pace = t("relaxed", "inferred", 0.8);

  // must-haves
  const mustHaves: string[] = [];
  if (text.includes("beach")) mustHaves.push("beach");
  if (/\bkids?\b|\bkid-friendly\b|\bfor the kids\b/.test(text)) mustHaves.push("kid-friendly");
  if (/\bpool\b/.test(text)) mustHaves.push("pool");
  if (mustHaves.length) request.mustHaves = t(mustHaves, "prompt", 0.8);

  // destination
  request.destination = extractDestination(text, prompt);

  // origin: parsed from prompt only if explicitly stated ("from X")
  const fromMatch = prompt.match(/\bfrom\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\b/);
  if (fromMatch) request.origin = t(fromMatch[1]!, "prompt", 0.9);
  else request.origin = null;

  return { request, agentMessage: buildRecap(request) };
}

const KNOWN_DESTS = [
  "greece", "spain", "italy", "portugal", "france", "germany", "netherlands", "austria",
  "croatia", "thailand", "japan", "mexico", "morocco", "turkey", "naxos", "mykonos",
  "santorini", "barcelona", "valencia", "lisbon", "rome", "amsterdam", "paris", "berlin",
];

function extractDestination(text: string, original: string): Tracked<string> | null {
  for (const d of KNOWN_DESTS) {
    if (text.includes(d)) {
      return t(d.charAt(0).toUpperCase() + d.slice(1), "prompt", 0.95);
    }
  }
  // vague: "somewhere <vibe>", "in Europe", "sunny".
  // "in <Capitalized>" is a weak destination signal — but guard against month names so
  // "travelling in March" isn't misread as a place called "March".
  const inMatch = original.match(/\bin\s+([A-Z][a-zA-Z]+)\b/);
  if (inMatch && !/march|april|august|june|july|may/i.test(inMatch[1]!)) {
    return t(inMatch[1]!, "prompt", 0.7);
  }
  const vagueMatch = text.match(/somewhere(?:\s+\w+){0,3}|in europe|sunny|warm/);
  if (vagueMatch) return t(vagueMatch[0].trim(), "prompt", 0.5);
  return null;
}

function buildRecap(r: TripRequest): string {
  const bits: string[] = [];
  if (r.vibe?.value.length) bits.push(r.vibe.value.join(", "));
  if (r.durationDays) bits.push(`${r.durationDays.value} days`);
  if (r.destination) bits.push(`in ${r.destination.value}`);
  if (r.dates?.value.month) {
    const m = MONTHS[r.dates.value.month - 1]!;
    bits.push(`${r.dates.value.part ? r.dates.value.part + " " : ""}${m.charAt(0).toUpperCase() + m.slice(1)}`);
  }
  if (r.partySize) {
    const p = r.partySize.value.adults + (r.partySize.value.children ?? 0);
    bits.push(p === 1 ? "solo" : `for ${p}`);
  }
  if (r.budget) bits.push(`~${r.budget.value.currency} ${r.budget.value.amount}`);
  const recap = bits.length ? bits.join(", ") : "your trip";
  return `Nice — ${recap}. A couple of quick things:`;
}
