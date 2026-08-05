import type { Preferences, TripRequest, Pace } from "@wayfare/shared";
import type { Persona, PersonaWeights, TravelerProfile } from "../types.js";
import type { Tracer } from "../trace.js";

/**
 * PersonaAgent — reads the traveler's personality. It fuses free-text `signals` ("hates 6am
 * flights", "will pay for location", "foodie on a budget") with the trip's vibe into two
 * things the ranker needs: normalized Preferences, and PersonaWeights that say how much each
 * axis (price, quality, location, vibe, flexibility) actually matters to *this* person.
 *
 * Same story as intake: transparent keyword heuristics now, swappable for an LLM later behind
 * the identical signature.
 */

interface SignalRule {
  match: RegExp;
  /** additive nudges to the weight axes. */
  nudge: Partial<PersonaWeights>;
  interests?: string[];
  lodging?: string[];
  pace?: Pace;
}

const RULES: SignalRule[] = [
  { match: /budget|cheap|frugal|shoestring|save|affordable/, nudge: { price: 0.4 } },
  { match: /luxury|luxe|splurge|high-end|5-star|treat/, nudge: { quality: 0.4, price: -0.2 } },
  { match: /location|central|walk everywhere|near|central|old town/, nudge: { location: 0.3 }, lodging: ["central"] },
  { match: /foodie|food|culinary|eat|restaurant/, nudge: { vibe: 0.2 }, interests: ["food"] },
  { match: /quiet|calm|relax|chill|unwind|slow/, nudge: { quality: 0.1 }, interests: ["relaxed"], pace: "relaxed" },
  { match: /adventure|hike|hiking|outdoors|surf|dive|active/, nudge: { vibe: 0.2 }, interests: ["adventure"], pace: "packed" },
  { match: /flexible|whenever|any time|open dates/, nudge: { flexibility: 0.3 } },
  { match: /hate.*(early|6am|morning)|no early|not a morning person/, nudge: { flexibility: 0.15 } },
  { match: /boutique|design|characterful|unique/, nudge: { quality: 0.15 }, lodging: ["boutique", "design"] },
  { match: /family|kids|children/, nudge: { quality: 0.15 }, interests: ["family"] },
  { match: /romantic|honeymoon|couple/, nudge: { vibe: 0.15 }, interests: ["romantic"] },
];

const BASE: PersonaWeights = { price: 0.34, quality: 0.22, location: 0.18, vibe: 0.16, flexibility: 0.1 };

export function derivePersona(
  profile: TravelerProfile,
  request: TripRequest,
  tracer: Tracer,
): Persona {
  const weights: PersonaWeights = { ...BASE };
  const interests = new Set<string>(request.vibe?.value ?? []);
  const lodging = new Set<string>();
  let pace: Pace = "moderate";

  const haystack = [...profile.signals, ...(request.vibe?.value ?? [])].join(" ").toLowerCase();
  const matched: string[] = [];
  for (const rule of RULES) {
    if (!rule.match.test(haystack)) continue;
    matched.push(rule.match.source);
    for (const [k, v] of Object.entries(rule.nudge)) {
      weights[k as keyof PersonaWeights] += v as number;
    }
    rule.interests?.forEach((i) => interests.add(i));
    rule.lodging?.forEach((l) => lodging.add(l));
    if (rule.pace) pace = rule.pace;
  }

  // a hard budget is itself a strong price signal.
  if (request.budget?.value?.type === "hard") weights.price += 0.2;

  const normalized = normalize(weights);
  const preferences: Preferences = {
    pace,
    interests: [...interests],
    lodgingStyle: lodging.size ? [...lodging] : undefined,
  };

  const persona: Persona = {
    weights: normalized,
    preferences,
    summary: describe(normalized, preferences),
  };
  tracer.emit("persona", "derived", { matched, weights: normalized, summary: persona.summary });
  return persona;
}

function normalize(w: PersonaWeights): PersonaWeights {
  const clamped = Object.fromEntries(
    Object.entries(w).map(([k, v]) => [k, Math.max(0, v)]),
  ) as PersonaWeights;
  const sum = Object.values(clamped).reduce((a, b) => a + b, 0) || 1;
  return {
    price: clamped.price / sum,
    quality: clamped.quality / sum,
    location: clamped.location / sum,
    vibe: clamped.vibe / sum,
    flexibility: clamped.flexibility / sum,
  };
}

function describe(w: PersonaWeights, prefs: Preferences): string {
  const lead = (Object.entries(w).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "balanced") as string;
  const leadWord: Record<string, string> = {
    price: "cost-led",
    quality: "quality-first",
    location: "location-obsessed",
    vibe: "vibe-driven",
    flexibility: "flexibility-first",
  };
  const tastes = prefs.interests.slice(0, 3).join(", ") || "open-minded";
  return `${leadWord[lead] ?? "balanced"} traveler, ${prefs.pace} pace — into ${tastes}`;
}
