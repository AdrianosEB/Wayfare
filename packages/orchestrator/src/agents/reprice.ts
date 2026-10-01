import type { ListingKind } from "@wayfare/shared";
import type {
  Candidate,
  ItineraryCombination,
  ItineraryConfirmation,
  RepriceLine,
  SearchQuery,
  VerifiedOption,
} from "../types.js";
import type { SearchProvider } from "../providers/types.js";
import type { Tracer } from "../trace.js";
import type { SearchLimits } from "../limits.js";
import { queryKey } from "../limits.js";
import { computeItineraryTotal, itineraryLegs } from "./supervisor.js";

/**
 * The last gate before an itinerary is surfaced. Prices can move between the first scan and
 * now, so this goes back to each leg's source, re-fetches the price for that entity, and
 * recomputes the itinerary total. The itinerary is `confirmed` only if every leg is still
 * there and nothing drifted past tolerance.
 */

export interface RepriceArgs {
  combo: ItineraryCombination;
  providers: SearchProvider[];
  destination: string;
  nights: number;
  travelers: number;
  now: string;
  tracer: Tracer;
  /** the shared fan-out limiter, so reprice respects the same per-provider cap. */
  limits?: SearchLimits<Candidate[]>;
  /** allowed fractional drift per leg and on the total before we withhold "confirmed". */
  tolerance?: number;
}

export async function repriceItinerary(args: RepriceArgs): Promise<ItineraryConfirmation> {
  const { combo, providers, destination, nights, travelers, now, tracer } = args;
  const tolerance = args.tolerance ?? 0.02;

  const legs = itineraryLegs(combo);
  const lines: RepriceLine[] = [];
  const nowByKind: { flight?: number; stay?: number; activities: number[] } = { activities: [] };

  // re-fetch every leg concurrently at its source, through the shared limiter so reprice
  // can't set off its own 429 storm.
  const fetched = await Promise.all(
    legs.map((leg) =>
      currentPriceAtSource(providers, destination, leg.option, args.limits).catch(() => undefined),
    ),
  );

  legs.forEach((leg, i) => {
    const was = leg.option.best.price.amount;
    const current = fetched[i];
    const found = current != null;
    const nowPrice = found ? current : was; // couldn't re-fetch → carry the quote but flag it
    const ok = found && Math.abs(nowPrice - was) <= tolerance * was;
    lines.push({
      entity: leg.option.entity.name,
      source: leg.option.best.source.provider,
      was,
      now: nowPrice,
      ok,
    });
    if (leg.kind === "flight") nowByKind.flight = nowPrice;
    else if (leg.kind === "stay") nowByKind.stay = nowPrice;
    else nowByKind.activities.push(nowPrice);
  });

  const repricedTotal = computeItineraryTotal({
    ...(nowByKind.flight != null ? { flightUnit: nowByKind.flight } : {}),
    ...(nowByKind.stay != null ? { stayUnit: nowByKind.stay } : {}),
    activityUnits: nowByKind.activities,
    nights,
    travelers,
    priceFactor: combo.window?.priceFactor ?? 1,
  });
  const originalTotal = combo.total;
  const drift = repricedTotal - originalTotal;
  const confirmed =
    lines.every((l) => l.ok) && Math.abs(drift) <= tolerance * Math.max(1, originalTotal);

  const confirmation: ItineraryConfirmation = {
    confirmed,
    originalTotal,
    repricedTotal,
    drift,
    currency: combo.currency,
    checkedAt: now,
    lines,
    note: confirmed
      ? `Re-priced all ${lines.length} legs at source. Total holds at ${repricedTotal} ${combo.currency}. Bookable.`
      : `Re-price found drift (${drift >= 0 ? "+" : ""}${drift} ${combo.currency}) or a missing leg. Surfacing as unconfirmed.`,
  };
  tracer.emit("reprice", "checked", { confirmed, drift, legs: lines.length });
  return confirmation;
}

/** Re-query the leg's own source for its current price on the same entity. */
async function currentPriceAtSource(
  providers: SearchProvider[],
  destination: string,
  option: VerifiedOption,
  limits?: SearchLimits<Candidate[]>,
): Promise<number | undefined> {
  const kind = option.entity.kind as ListingKind;
  const sourceId = option.best.source.provider;
  const provider = providers.find((p) => p.id === sourceId && p.kinds.includes(kind));
  if (!provider) return undefined;
  const query: SearchQuery = { kind, where: destination, hints: [] };
  const candidates = limits
    ? await limits.run(sourceId, queryKey(sourceId, query), () => provider.search(query))
    : await provider.search(query);
  const match = candidates.find(
    (c) => c.entity.key === option.entity.key && c.listing.source.provider === sourceId,
  );
  return match?.listing.price.amount;
}
