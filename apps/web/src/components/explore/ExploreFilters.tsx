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
 * Explore / Trending control bar — purely presentational, fully controlled by the props the
 * `useExploreFilters` hook returns (no filtering logic lives here). Renders labeled chip groups
 * for every facet (azure-filled when active via the shared `Chip`), a styled sort `<select>` on
 * the right, the live result count, and a "Clear all" ghost affordance that appears only when at
 * least one facet is active. Content is VISIBLE BY DEFAULT — no entrance animations gate it.
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
          {/* "Clear all" is rendered only when something is actually filtered — no dead control when
              every chip is already off. activeCount (not resultCount) is the gate: it tracks lit
              chips, so it's non-zero exactly when there's something to clear. */}
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

          {/* The native <select> is visually restyled (appearance-none + our own chevron), but stays
              a real <select> for keyboard/AT support. The visible label is collapsed to sr-only to
              keep the compact pill look, so we give the control an explicit accessible name — both
              the sr-only <span> inside the wrapping <label> and the redundant aria-label guarantee
              it's announced as "Sort trips" regardless of how the AT resolves the name. */}
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

      {/* Facet groups. Note the two "selected" shapes below: single-select facets light a chip via
          equality (region === value), while Vibe uses vibes.includes(value) because it's the one
          multi-select group. Both go through the same onToggle* callbacks the hook owns. */}
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
