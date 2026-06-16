import { z } from "zod";
import {
  ListingSchema,
  BudgetTypeSchema,
  type Budget,
  type BudgetCategory,
  type BudgetLine,
  type Freshness,
  type Listing,
} from "@wayfare/shared";
import { foodPerDayEur, convertFromEur } from "../integrations/costIndex.js";

/**
 * compute_budget — the ONLY place totals are summed (AGENT_DESIGN.md). Deterministic, pure,
 * and the arbiter of whole-trip cost. The model never sums prices itself; it calls this so the
 * running total is always exactly the sum of the chosen listings + a food/contingency buffer.
 */

export const ComputeBudgetInputSchema = z
  .object({
    items: z.array(ListingSchema),
    currency: z.string(),
    target: z.object({ amount: z.number(), type: BudgetTypeSchema }).optional(),
    /** trip length in nights and party size — drive the food/buffer line. */
    nights: z.number().int().min(1),
    partySize: z.number().int().min(1),
    /** destination cost tier (1–5) for the food allowance. */
    tier: z.number().int().min(1).max(5),
  })
  .strict();
export type ComputeBudgetInput = z.infer<typeof ComputeBudgetInputSchema>;

const CATEGORY_BY_KIND: Record<Listing["kind"], BudgetCategory> = {
  flight: "flights",
  stay: "stay",
  activity: "activities",
  transit: "transit",
};

const FRESHNESS_RANK: Record<Freshness, number> = {
  live: 0,
  cached: 1,
  estimate: 2,
  mock: 3,
};

/** worst-case (least fresh) freshness across a set of listings; drives line labeling. */
function worstFreshness(listings: Listing[]): Freshness {
  let worst: Freshness = "live";
  for (const l of listings) {
    if (FRESHNESS_RANK[l.freshness] > FRESHNESS_RANK[worst]) worst = l.freshness;
  }
  return worst;
}

const SYMBOL: Record<string, string> = { EUR: "€", GBP: "£", USD: "$" };
const sym = (currency: string) => SYMBOL[currency.toUpperCase()] ?? `${currency} `;

const CATEGORY_ORDER: BudgetCategory[] = [
  "flights",
  "transit",
  "stay",
  "activities",
  "food",
  "buffer",
];

export function computeBudget(input: ComputeBudgetInput): Budget {
  const { items, currency, target, nights, partySize, tier } = input;

  // group listings by category
  const byCat = new Map<BudgetCategory, Listing[]>();
  for (const l of items) {
    const cat = CATEGORY_BY_KIND[l.kind];
    const arr = byCat.get(cat) ?? [];
    arr.push(l);
    byCat.set(cat, arr);
  }

  const lines: BudgetLine[] = [];
  for (const [category, listings] of byCat) {
    const amount = listings.reduce((sum, l) => sum + l.price.amount, 0);
    lines.push({
      category,
      amount: Math.round(amount),
      itemRefs: listings.map((l) => l.id),
      freshness: worstFreshness(listings),
    });
  }

  // food/contingency buffer — not an itinerary listing, so it has no itemRefs.
  const bufferRaw = convertFromEur(nights * partySize * foodPerDayEur(tier), currency);
  const bufferAmount = Math.round(bufferRaw / 25) * 25;
  if (bufferAmount > 0) {
    lines.push({ category: "buffer", amount: bufferAmount, itemRefs: [], freshness: "mock" });
  }

  lines.sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );

  const total = lines.reduce((sum, l) => sum + l.amount, 0);

  let status: Budget["status"] = "on_target";
  let overageNote: string | undefined;
  if (target) {
    if (total > target.amount) {
      status = "over";
      const overBy = total - target.amount;
      overageNote = `About ${sym(currency)}${overBy} over your ${sym(currency)}${target.amount} target.`;
    } else if (total < target.amount) {
      status = "under";
    }
  }

  const budget: Budget = {
    currency,
    ...(target ? { target } : {}),
    total,
    lines,
    status,
    ...(overageNote ? { overageNote } : {}),
    savings: [], // ≥1 hint is attached by the planner (US-3.5)
  };
  return budget;
}
