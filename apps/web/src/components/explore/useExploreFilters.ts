import { useCallback, useMemo, useState } from 'react';
import {
  budgetBand,
  type BudgetBand,
  type ExploreTrip,
  type TripParty,
  type TripRegion,
  type TripVibe,
} from '@/lib/content';

/**
 * Explore / Trending filtering + sorting brain.
 *
 * Owns all facet + sort state, derives `filtered` with `useMemo`, and hands the UI a fully
 * controlled `filterControlProps` bundle (current selections + their toggle/setter callbacks +
 * resultCount + clearAll). The `ExploreFilters` component is purely presentational — no filtering
 * logic lives there. See docs contract in the page composer:
 *
 *   const { filtered, filterControlProps, activeCount, resultCount } = useExploreFilters(EXPLORE_TRIPS);
 *   <ExploreFilters {...filterControlProps} />
 */

/** The five sort modes offered in the control bar. `Trending` is the default. */
export type ExploreSort =
  | 'Trending'
  | 'Price: low to high'
  | 'Price: high to low'
  | 'Shortest'
  | 'Longest';

/** Render order for the sort control — keep `Trending` first (default). */
export const EXPLORE_SORTS: ExploreSort[] = [
  'Trending',
  'Price: low to high',
  'Price: high to low',
  'Shortest',
  'Longest',
];

/**
 * Trend priority for the default `Trending` sort: Hot > Rising > Steady. Lower rank sorts first,
 * so this is a lookup we subtract in the comparator (a.rank - b.rank) rather than a label list.
 */
const TREND_RANK: Record<ExploreTrip['trending'], number> = {
  Hot: 0,
  Rising: 1,
  Steady: 2,
};

/**
 * Props for the presentational `ExploreFilters` bar. `useExploreFilters` returns a value that is
 * exactly assignable to this, so the page can spread `<ExploreFilters {...filterControlProps} />`.
 */
export interface ExploreFiltersProps {
  /** Single-select region, or undefined for "all regions". */
  region: TripRegion | undefined;
  /** Single-select party, or undefined for "all". */
  party: TripParty | undefined;
  /** Single-select budget band, or undefined for "all". */
  band: BudgetBand | undefined;
  /** Multi-select vibes (OR semantics). Empty array = "all". */
  vibes: TripVibe[];
  /** Current sort mode. */
  sort: ExploreSort;
  /** Toggle a region (clicking the active one clears it). */
  onToggleRegion: (region: TripRegion) => void;
  /** Toggle a party. */
  onToggleParty: (party: TripParty) => void;
  /** Toggle a budget band. */
  onToggleBand: (band: BudgetBand) => void;
  /** Toggle a vibe in/out of the multi-select set. */
  onToggleVibe: (vibe: TripVibe) => void;
  /** Set the sort mode. */
  onSortChange: (sort: ExploreSort) => void;
  /** Reset every facet (sort is preserved — see clearAll docs). */
  clearAll: () => void;
  /** Number of active facet selections (region + party + band + each selected vibe). */
  activeCount: number;
  /** Number of trips after filtering (== filtered.length). */
  resultCount: number;
}

/** What the hook returns to the page. */
export interface UseExploreFiltersResult {
  filtered: ExploreTrip[];
  filterControlProps: ExploreFiltersProps;
  activeCount: number;
  resultCount: number;
}

/**
 * Toggle helper for single-select facets: pick a new value, or clear it when the same value is
 * clicked again. This "click the active chip to unset it" behaviour is why region/party/band are
 * modeled as a lone value-or-undefined rather than a set — there's no separate "clear" affordance
 * per group; re-tapping the lit chip is the clear.
 */
function toggleSingle<T>(current: T | undefined, next: T): T | undefined {
  return current === next ? undefined : next;
}

export function useExploreFilters(trips: ExploreTrip[]): UseExploreFiltersResult {
  const [region, setRegion] = useState<TripRegion | undefined>(undefined);
  const [party, setParty] = useState<TripParty | undefined>(undefined);
  const [band, setBand] = useState<BudgetBand | undefined>(undefined);
  const [vibes, setVibes] = useState<TripVibe[]>([]);
  const [sort, setSort] = useState<ExploreSort>('Trending');

  const onToggleRegion = useCallback(
    (next: TripRegion) => setRegion((cur) => toggleSingle(cur, next)),
    [],
  );
  const onToggleParty = useCallback(
    (next: TripParty) => setParty((cur) => toggleSingle(cur, next)),
    [],
  );
  const onToggleBand = useCallback(
    (next: BudgetBand) => setBand((cur) => toggleSingle(cur, next)),
    [],
  );
  // Vibe is the one MULTI-select facet: toggling adds/removes from a set rather than replacing,
  // because a trip can legitimately match several vibes at once (see the OR match in `filtered`).
  const onToggleVibe = useCallback(
    (next: TripVibe) =>
      setVibes((cur) =>
        cur.includes(next) ? cur.filter((v) => v !== next) : [...cur, next],
      ),
    [],
  );
  const onSortChange = useCallback((next: ExploreSort) => setSort(next), []);

  /**
   * Reset every facet. Sort is intentionally PRESERVED — "Clear all" is about the *filter* facets,
   * and a user who deliberately picked, say, "Price: low to high" shouldn't have it snap back to
   * `Trending` just because they widened their search. Note this doesn't touch `sort` at all.
   */
  const clearAll = useCallback(() => {
    setRegion(undefined);
    setParty(undefined);
    setBand(undefined);
    setVibes([]);
  }, []);

  const filtered = useMemo(() => {
    const matched = trips.filter((trip) => {
      if (region && trip.region !== region) return false;
      if (party && trip.party !== party) return false;
      if (band && budgetBand(trip.total) !== band) return false;
      // Vibe is OR: keep a trip if it has ANY selected vibe. No selection = all.
      if (vibes.length > 0 && !vibes.some((v) => trip.vibes.includes(v))) return false;
      return true;
    });

    const sorted = [...matched];
    switch (sort) {
      case 'Price: low to high':
        sorted.sort((a, b) => a.total - b.total);
        break;
      case 'Price: high to low':
        sorted.sort((a, b) => b.total - a.total);
        break;
      case 'Shortest':
        sorted.sort((a, b) => a.lengthDays - b.lengthDays);
        break;
      case 'Longest':
        sorted.sort((a, b) => b.lengthDays - a.lengthDays);
        break;
      case 'Trending':
      default:
        // Default ordering: bucket by trend momentum (Hot > Rising > Steady), then within a bucket
        // break ties by raw popularity (plannedThisWeek descending). The `|| b - a` is a classic
        // comparator chain — the second key only decides when TREND_RANK is equal.
        sorted.sort(
          (a, b) =>
            TREND_RANK[a.trending] - TREND_RANK[b.trending] ||
            b.plannedThisWeek - a.plannedThisWeek,
        );
        break;
    }
    return sorted;
  }, [trips, region, party, band, vibes, sort]);

  // activeCount is the count of *chips lit*, not facet groups touched: each single-select facet
  // contributes 0 or 1, and every selected vibe counts individually. It gates the "Clear all"
  // affordance in the UI (shown only when > 0), not the filtering itself. resultCount is derived
  // rather than tracked so it always mirrors `filtered` exactly.
  const activeCount =
    (region ? 1 : 0) + (party ? 1 : 0) + (band ? 1 : 0) + vibes.length;
  const resultCount = filtered.length;

  const filterControlProps: ExploreFiltersProps = {
    region,
    party,
    band,
    vibes,
    sort,
    onToggleRegion,
    onToggleParty,
    onToggleBand,
    onToggleVibe,
    onSortChange,
    clearAll,
    activeCount,
    resultCount,
  };

  return { filtered, filterControlProps, activeCount, resultCount };
}
