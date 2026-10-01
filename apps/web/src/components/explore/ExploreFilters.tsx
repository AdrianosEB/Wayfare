import { Chip } from '@/components/Chip';
import { ChevronDownIcon, XIcon } from '@/components/icons';
import {
  BUDGET_BANDS,
  TRIP_PARTIES,
  TRIP_REGIONS,
  TRIP_VIBES,
} from '@/lib/content';
import { cn } from '@/lib/cn';
import { EXPLORE_SORTS, type ExploreFiltersProps, type ExploreSort } from './useExploreFilters';

/**
 * Explore / Trending control bar. Presentational: fully controlled by the props the
 * `useExploreFilters` hook returns.
 */

/** One labeled facet group. The `<fieldset>`/`<legend>` gives the chip cluster an accessible name. */
function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

export function ExploreFilters({
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
}: ExploreFiltersProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Top row: result count + sort + clear-all */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-2">
          <span className="tnum font-semibold text-ink">{resultCount}</span>{' '}
          {resultCount === 1 ? 'trip' : 'trips'}
        </p>

        <div className="flex items-center gap-3">
          {/* "Clear all" shows only when at least one facet is active. */}
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-sm font-medium text-muted transition hover:bg-azure-50 hover:text-ink focus-visible:ring-2"
            >
              <XIcon className="text-[13px]" />
              Clear all
            </button>
          )}

          {/* A real <select>, restyled, for keyboard/AT support. The visible label is sr-only,
              so the control also carries an explicit aria-label. */}
          <label className="relative flex items-center">
            <span className="sr-only">Sort trips</span>
            <select
              aria-label="Sort trips"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as ExploreSort)}
              className={cn(
                'h-9 appearance-none rounded-pill border border-border bg-surface pl-3.5 pr-9 text-sm font-medium text-ink',
                'transition hover:border-primary/50 focus:border-primary/50 focus:outline-none focus-visible:ring-2',
              )}
            >
              {EXPLORE_SORTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-3 text-muted" />
          </label>
        </div>
      </div>

      {/* Single-select facets light a chip by equality; Vibe uses vibes.includes(value)
          because it is the one multi-select group. */}
      <div className="flex flex-col gap-4">
        <FacetGroup label="Region">
          {TRIP_REGIONS.map((value) => (
            <Chip
              key={value}
              selected={region === value}
              onClick={() => onToggleRegion(value)}
            >
              {value}
            </Chip>
          ))}
        </FacetGroup>

        <FacetGroup label="Who">
          {TRIP_PARTIES.map((value) => (
            <Chip
              key={value}
              selected={party === value}
              onClick={() => onToggleParty(value)}
            >
              {value}
            </Chip>
          ))}
        </FacetGroup>

        <FacetGroup label="Budget">
          {BUDGET_BANDS.map((value) => (
            <Chip
              key={value}
              selected={band === value}
              onClick={() => onToggleBand(value)}
            >
              {value}
            </Chip>
          ))}
        </FacetGroup>

        <FacetGroup label="Vibe">
          {TRIP_VIBES.map((value) => (
            <Chip
              key={value}
              selected={vibes.includes(value)}
              onClick={() => onToggleVibe(value)}
            >
              {value}
            </Chip>
          ))}
        </FacetGroup>
      </div>
    </div>
  );
}
