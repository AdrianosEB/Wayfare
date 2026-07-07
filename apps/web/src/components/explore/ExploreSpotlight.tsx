import { useReducedMotion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { formatFrom } from '@/components/landing/_shared';
import { images } from '@/lib/images';
import type { ExploreTrip } from '@/lib/content';
import { BudgetSplitBar } from './BudgetSplitBar';
import { ProvenanceChip } from './ProvenanceChip';

/**
 * The editorial "spotlight" for the single hottest Explore trip — a large, magazine-style
 * feature that gives the otherwise-flat wall of cards a focal point. Two columns on desktop
 * (photo | editorial detail) that stack on mobile.
 *
 * Everything renders solid by default (no opacity-from-0 entrance gating) per the Explore
 * system; only the hero photo gets a subtle group-hover lift, guarded by useReducedMotion.
 * Reuses the exact BudgetSplitBar / ProvenanceChip / formatFrom idioms from ExploreTripCard so
 * the feature reads as the same design system, just scaled up. Unlike the cards this is NOT a
 * single button — the primary CTA is the dedicated <Button>, so the surface stays a plain
 * article with a proper heading for the page's focal element.
 */
export function ExploreSpotlight({
  trip,
  onPlan,
}: {
  trip: ExploreTrip;
  onPlan: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-azure-100/70 via-azure-50 to-bg shadow-card">
      <div className="grid grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-2 lg:gap-10 lg:p-8">
        {/* Large hero photo — a taller 3/2 ratio than the cards' 16/10 to read as a feature.
            group-hover scale mirrors ExploreTripCard, guarded by useReducedMotion. */}
        <div className="group overflow-hidden rounded-xl shadow-float">
          <Photo
            image={images.for(trip.imageKey)}
            imageKey={trip.imageKey}
            alt={`${trip.place} — ${trip.vibes.join(', ').toLowerCase()}`}
            ratio="aspect-[3/2]"
            eager
            className={reduce ? undefined : 'transition-transform duration-300 group-hover:scale-[1.03]'}
          />
        </div>

        {/* Editorial detail column. */}
        <div className="flex flex-col gap-4">
          {/* Eyebrow row: azure pill + muted traveller count. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-azure-100 px-3 py-1 text-sm font-medium leading-none text-azure-700">
              🔥 Most planned this week
            </span>
            <span className="text-ink-3">
              · <span className="tnum">{trip.plannedThisWeek}</span> travellers
            </span>
          </div>

          <div>
            <h2 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
              {trip.place}
            </h2>
            <p className="mt-1.5 text-sm text-ink-2 sm:text-base">
              {trip.lengthDays} nights · {trip.party} · {trip.bestSeason}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {trip.vibes.map((vibe) => (
              <Chip key={vibe} as="span">
                {vibe}
              </Chip>
            ))}
          </div>

          <p className="text-base leading-relaxed text-ink-2 lg:text-lg">{trip.blurb}</p>

          <BudgetSplitBar budget={trip.budget} total={trip.total} currency={trip.currency} />

          {/* Footer row: price figure, primary CTA, and the provenance chip. mt-auto pins it to
              the bottom of the taller column so the feature stays balanced against the photo. */}
          <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-2">
            <p className="text-base text-ink">
              from{' '}
              <span className="tnum text-lg font-semibold text-azure-700">
                {formatFrom(trip.total, trip.currency)}
              </span>
            </p>
            <Button size="lg" onClick={onPlan}>
              Plan this trip
            </Button>
            <ProvenanceChip source={trip.source} freshness={trip.freshness} />
          </div>
        </div>
      </div>
    </article>
  );
}
