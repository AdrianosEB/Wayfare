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
 * Explore / Trending filtering + sorting. Owns all facet + sort state, derives `filtered`,
 * and hands `ExploreFilters` a fully controlled `filterControlProps` bundle:
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

/** Render order for the sort control. Keep `Trending` first (default). */
export const EXPLORE_SORTS: ExploreSort[] = [
  'Trending',
  'Price: low to high',
  'Price: high to low',
  'Shortest',
  'Longest',
];

/** Trend priority for the default `Trending` sort: Hot > Rising > Steady. Lower rank sorts first. */
const TREND_RANK: Record<ExploreTrip['trending'], number> = {
  Hot: 0,
  Rising: 1,
  Steady: 2,
};

/** Props for `ExploreFilters`. `useExploreFilters` returns a value assignable to this. */
export interface ExploreFiltersProps {
  /** Single-select region, or undefined for "all regions". */
  region: TripRegion | undefined;
  /** Single-select party, or undefined for "all". */
  party: TripParty | undefined;
  /** Single-select budget band, or undefined for "all". */
  band: BudgetBand | undefined;
  /** Multi-select vibes (OR semantics). Empty array = "all". */
  vibes: TripVibe[];
  sort: ExploreSort;
  /** Toggle a region (clicking the active one clears it). */
  onToggleRegion: (region: TripRegion) => void;
  onToggleParty: (party: TripParty) => void;
  onToggleBand: (band: BudgetBand) => void;
  /** Toggle a vibe in/out of the multi-select set. */
  onToggleVibe: (vibe: TripVibe) => void;
  onSortChange: (sort: ExploreSort) => void;
  /** Reset every facet (sort is preserved). */
  clearAll: () => void;
  /** Number of active facet selections (region + party + band + each selected vibe). */
  activeCount: number;
  /** Number of trips after filtering (== filtered.length). */
  resultCount: number;
}

export interface UseExploreFiltersResult {
  filtered: ExploreTrip[];
  filterControlProps: ExploreFiltersProps;
  activeCount: number;
  resultCount: number;
}

/**
 * Toggle for single-select facets: pick a new value, or clear it when the active value is
 * clicked again.
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
  // Vibe is the one multi-select facet: a trip can match several vibes at once (see the OR
  // match in `filtered`).
  const onToggleVibe = useCallback(
    (next: TripVibe) =>
      setVibes((cur) =>
        cur.includes(next) ? cur.filter((v) => v !== next) : [...cur, next],
      ),
    [],
  );
  const onSortChange = useCallback((next: ExploreSort) => setSort(next), []);

  /** Reset every facet. Sort is preserved: "Clear all" is about the filter facets. */
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
      // Vibe is OR: keep a trip if it has any selected vibe. No selection = all.
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
        // Default ordering: by trend (Hot > Rising > Steady), then by plannedThisWeek
        // descending.
        sorted.sort(
          (a, b) =>
            TREND_RANK[a.trending] - TREND_RANK[b.trending] ||
            b.plannedThisWeek - a.plannedThisWeek,
        );
        break;
    }
    return sorted;
  }, [trips, region, party, band, vibes, sort]);

  // activeCount counts lit chips, not facet groups: each single-select facet contributes 0
  // or 1 and every selected vibe counts individually.
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
