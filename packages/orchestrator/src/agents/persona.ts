import type { Preferences, TripRequest, Pace } from "@wayfare/shared";
import type { Persona, PersonaReasoning, PersonaWeights, TravelerProfile } from "../types.js";
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
  // The price axis is deliberately symmetric: one rule up, one rule down, same magnitude.
  // It used to be one-way — `/budget|save/` pushed price up 0.4 and only `/luxury/` pulled it
  // down 0.2, so price could not leave the top without the word "luxury". Measured over the
  // 995-row train split, spends-freely travellers came out with a HIGHER mean price weight
  // (0.431) than frugal ones (0.421). Two false positives did most of that damage: `/budget/`
  // matched "treats the budget as a starting point, not a limit" and `/save/` matched "has
  // saved for this and wants to feel it" — both signals meaning the opposite.
  {
    // `on a budget` / `under budget` / `budget as a hard ceiling` are matched explicitly rather
    // than by a bare /budget/, which also fires on "treats the budget as a starting point, not a
    // limit" — a signal meaning the exact opposite.
    match: /on a budget|budget-conscious|tight budget|under budget|hard ceiling|counts every (euro|dollar|penny)|cheapest|\bcheap\b|frugal|shoestring|affordable|watching the pennies|on sale|resort fees|save money|street food/,
    nudge: { price: 0.35 },
  },
  {
    match: /not the constraint|cost doesn'?t matter|money is no object|never looks at the price|without checking the fare|doesn'?t do the maths|rather overpay|without blinking|upgrades at the desk|will pay more|flies business|starting point, not a limit|saved for this|waves off the bill/,
    nudge: { price: -0.35 },
  },
  // Quality-led, with only a light price nudge now that price has a rule of its own; a bigger
  // one here would double-count every "luxury" signal on an axis it is not really about.
  { match: /luxury|luxe|high-end|5-star/, nudge: { quality: 0.4, price: -0.1 } },
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
  const reasoning: PersonaReasoning[] = [];
  for (const rule of RULES) {
    if (!rule.match.test(haystack)) continue;
    matched.push(rule.match.source);
    // The substring that actually matched, so the trace quotes the traveler rather than a regex.
    const hit = haystack.match(rule.match)?.[0] ?? rule.match.source;
    for (const [k, v] of Object.entries(rule.nudge)) {
      weights[k as keyof PersonaWeights] += v as number;
      reasoning.push({
        signal: hit,
        dimension: k as PersonaReasoning["dimension"],
        direction: (v as number) >= 0 ? "up" : "down",
      });
    }
    rule.interests?.forEach((i) => interests.add(i));
    rule.lodging?.forEach((l) => lodging.add(l));
    if (rule.pace) pace = rule.pace;
  }

  // A budget is NOT a price preference, and is deliberately not nudged here. It is a constraint,
  // and the supervisor already enforces it structurally: `runSupervisor` prunes each flight+stay
  // partial against `budgetCap` before expanding it with activities, then bounds activity
  // selection by what remains. Adding price weight on top made the traveller's stated priorities
  // shift because of a number they were merely spending under — the same constraint counted
  // twice, once as a filter and once as a taste.

  const normalized = normalize(weights);
  const preferences: Preferences = {
    pace,
    interests: [...interests],
    lodgingStyle: lodging.size ? [...lodging] : undefined,
  };

  const persona: Persona = {
    reasoning,
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
