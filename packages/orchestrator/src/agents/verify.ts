import type { Listing } from "@wayfare/shared";
import type { Candidate, VerifiedOption, Verdict, DirectDeal } from "../types.js";
import type { Tracer } from "../trace.js";

/**
 * VerificationAgent — the reason this is an *agency* and not a search box. Every provider is
 * treated as an unreliable witness. The agent groups candidates by the real-world entity they
 * point at (same hotel, regardless of who listed it) and cross-examines them:
 *
 *   - corroboration: how many independent sources agree this entity exists at ~this price;
 *   - price agreement: a wide spread across sources means one of them is lying or stale → suspect;
 *   - direct deal: a direct source undercutting the aggregators is money left on the table;
 *   - the ruling: `verified` (trust it), `unconfirmed` (only one source), or `suspect` (don't lead with it).
 *
 * It never invents trust: `best` is the lowest price we'd actually be willing to book, and the
 * verdict + flags let the matcher and the critic act on the uncertainty instead of hiding it.
 */

export interface VerifyOptions {
  /** spread (max/min) above which prices disagree enough to be suspect. */
  suspectSpreadRatio?: number;
  /** distinct sources needed to call an entity verified on corroboration alone. */
  minCorroboration?: number;
}

export function verify(
  candidates: Candidate[],
  aggregatorIds: Set<string>,
  tracer: Tracer,
  opts: VerifyOptions = {},
): VerifiedOption[] {
  const suspectSpreadRatio = opts.suspectSpreadRatio ?? 1.6;
  const minCorroboration = opts.minCorroboration ?? 2;

  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const arr = groups.get(c.entity.key) ?? [];
    arr.push(c);
    groups.set(c.entity.key, arr);
  }

  const options: VerifiedOption[] = [];
  for (const group of groups.values()) {
    const first = group[0]!;
    const listings = group.map((c) => c.listing);
    const currency = first.listing.price.currency;
    const sources = [...new Set(listings.map((l) => l.source.provider))];

    const prices = listings.map((l) => l.price.amount);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const spreadRatio = min > 0 ? max / min : 1;

    const aggPrices = listings.filter((l) => aggregatorIds.has(l.source.provider)).map((l) => l.price.amount);
    const directListings = listings.filter((l) => !aggregatorIds.has(l.source.provider));
    const directPrices = directListings.map((l) => l.price.amount);

    let directDeal: DirectDeal | undefined;
    if (aggPrices.length && directPrices.length) {
      const bestAgg = Math.min(...aggPrices);
      const bestDirect = Math.min(...directPrices);
      if (bestDirect < bestAgg) {
        const directSource = directListings.reduce((a, b) => (a.price.amount <= b.price.amount ? a : b));
        const aggListing = listings
          .filter((l) => aggregatorIds.has(l.source.provider))
          .reduce((a, b) => (a.price.amount <= b.price.amount ? a : b));
        directDeal = {
          aggregatorPrice: bestAgg,
          aggregatorSource: aggListing.source.provider,
          directPrice: bestDirect,
          directSource: directSource.source.provider,
          savings: bestAgg - bestDirect,
          currency,
        };
      }
    }

    const flags: string[] = [];
    let verdict: Verdict;
    if (spreadRatio > suspectSpreadRatio) {
      verdict = "suspect";
      flags.push("price_mismatch");
    } else if (sources.length >= minCorroboration) {
      verdict = "verified";
    } else {
      const solo = listings[0]!;
      const trustedSolo = solo.confidence >= 0.8 && (solo.freshness === "live" || solo.freshness === "cached");
      verdict = trustedSolo ? "verified" : "unconfirmed";
      flags.push("single_source");
    }
    if (directDeal) flags.push("direct_cheaper");

    // `best` = the lowest price we'd book. On a suspect group we distrust the cheap outlier and
    // fall back to the corroborated cluster (median), so a bait price can't win on price alone.
    const best = verdict === "suspect" ? medianListing(listings) : cheapest(listings);

    const bestCandidate = group.find((c) => c.listing.id === best.id) ?? first;

    options.push({
      entity: first.entity,
      verdict,
      confidence: scoreConfidence(listings, sources.length, spreadRatio, verdict),
      best,
      corroboration: listings,
      sources,
      priceSpread: { min, max, currency },
      directDeal,
      rating: bestCandidate.rating,
      distanceToFocusMeters: bestCandidate.distanceToFocusMeters,
      tags: bestCandidate.tags,
      flags,
    });
  }

  const byVerdict = tally(options.map((o) => o.verdict));
  tracer.emit("verify", "cross_checked", {
    entities: options.length,
    ...byVerdict,
    directDeals: options.filter((o) => o.directDeal).length,
  });
  return options;
}

function cheapest(listings: Listing[]): Listing {
  return listings.reduce((a, b) => (a.price.amount <= b.price.amount ? a : b));
}

function medianListing(listings: Listing[]): Listing {
  const sorted = [...listings].sort((a, b) => a.price.amount - b.price.amount);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

function scoreConfidence(
  listings: Listing[],
  sourceCount: number,
  spreadRatio: number,
  verdict: Verdict,
): number {
  if (verdict === "suspect") return Math.min(0.4, avgConfidence(listings));
  const corroboration = Math.min(1, 0.6 + 0.2 * (sourceCount - 1));
  const agreement = spreadRatio <= 1.15 ? 1 : spreadRatio <= 1.4 ? 0.85 : 0.6;
  return clamp01(avgConfidence(listings) * corroboration * agreement);
}

function avgConfidence(listings: Listing[]): number {
  return listings.reduce((a, l) => a + l.confidence, 0) / listings.length;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function tally(verdicts: Verdict[]): Record<Verdict, number> {
  return {
    verified: verdicts.filter((v) => v === "verified").length,
    unconfirmed: verdicts.filter((v) => v === "unconfirmed").length,
    suspect: verdicts.filter((v) => v === "suspect").length,
  };
}
