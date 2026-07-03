import type { ReactNode } from 'react';
import { EXPLORE_TRIPS, type ExploreTrip } from '@/lib/content';
import { formatFrom } from '@/components/landing/_shared';
import { cn } from '@/lib/cn';

/**
 * Social-proof stats band for /explore — a lightweight "live" dashboard strip that sits
 * between the hero and the filter bar. All figures are DERIVED from EXPLORE_TRIPS so they
 * stay correct as the catalogue changes (no hardcoded numbers). Renders visible by default;
 * there are no entrance animations gating content.
 *
 * Placement: self-contained block (no Section wrapper). Assumes it sits inside a centered
 * `max-w-site` container provided by the page. Spread `className` onto the root for spacing.
 */

interface Stat {
  /** Big tabular figure. */
  figure: string;
  /** Whether `figure` is numeric — gets the `.tnum` class for aligned digits. */
  numeric: boolean;
  /** Small label under the figure. */
  label: string;
  /** Optional second line of fine print. */
  sub?: string;
  /** Small leading accent (emoji/dot). */
  accent: ReactNode;
}

/** Derive the band's stats from the trip catalogue. */
function deriveStats(trips: readonly ExploreTrip[]): Stat[] {
  const plannedThisWeek = trips.reduce((sum, t) => sum + t.plannedThisWeek, 0);
  const destinations = trips.length;

  // Cheapest trip — keep its own currency so the figure stays correct if currencies vary.
  const cheapest = trips.reduce<ExploreTrip | null>(
    (min, t) => (min === null || t.total < min.total ? t : min),
    null,
  );

  return [
    {
      figure: plannedThisWeek.toLocaleString('en-US'),
      numeric: true,
      label: 'Trips planned this week',
      accent: '\u{1F525}', // fire
    },
    {
      figure: destinations.toLocaleString('en-US'),
      numeric: true,
      label: 'Destinations to explore',
      accent: '\u{1F30D}', // globe
    },
    {
      figure: cheapest ? formatFrom(cheapest.total, cheapest.currency) : '—',
      numeric: true,
      label: 'Trips start from',
      accent: '\u{1F3F7}\u{FE0F}', // tag
    },
    {
      // Price-honesty stat. Deliberately phrased around labelling/provenance — we never surface
      // the word "mock" to travellers; a figure is an estimate with its source shown, full stop.
      figure: 'Every price labelled',
      numeric: false, // prose, not a figure — renders at the smaller (text-lg/xl) size below
      label: 'estimate · source shown',
      accent: (
        <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-azure-500" />
      ),
    },
  ];
}

export function ExploreStats({ className }: { className?: string }) {
  const stats = deriveStats(EXPLORE_TRIPS);

  return (
    <div
      className={cn('rounded-xl bg-azure-50 px-5 py-6 sm:px-8 sm:py-7', className)}
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 sm:gap-x-8">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-base leading-none text-azure-600">
              {stat.accent}
            </span>
            {/* Numeric figures get big + tabular (.tnum) so digits line up across the row;
                non-numeric figures are prose (the price-honesty line), so they render a step
                smaller to read as a sentence, not a headline number. */}
            <dd
              className={cn(
                'font-display font-semibold leading-tight text-ink',
                stat.numeric ? 'tnum text-2xl sm:text-3xl' : 'text-lg sm:text-xl',
              )}
            >
              {stat.figure}
            </dd>
            <dt className="text-sm text-ink-2">{stat.label}</dt>
            {stat.sub && <p className="text-sm text-ink-3">{stat.sub}</p>}
          </div>
        ))}
      </dl>
    </div>
  );
}
