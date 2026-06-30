import { useReducedMotion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { Chip } from '@/components/Chip';
import { formatFrom } from '@/components/landing/_shared';
import { images } from '@/lib/images';
import type { ExploreTrip } from '@/lib/content';
import { BudgetSplitBar } from './BudgetSplitBar';
import { TrendingBadge } from './TrendingBadge';
import { ProvenanceChip } from './ProvenanceChip';

/**
 * A rich, tappable Explore card — the whole card is a button that seeds + starts the planner
 * (onPlan). Mirrors the PricingPage BudgetCard structure/hover idiom: a 16/10 Photo with a
 * subtle group-hover scale (guarded by useReducedMotion), shadow-card → hover:shadow-float.
 *
 * Photo overlays: a TrendingBadge top-left and a "from €X" price pill top-right (azure-700
 * figure, .tnum). Body: place, a meta line, vibe chips, the BudgetSplitBar, the blurb, and a
 * ProvenanceChip pinned to the bottom. Everything renders visible by default — only the photo
 * lift is animated.
 */
export function ExploreTripCard({
  trip,
  onPlan,
}: {
  trip: ExploreTrip;
  onPlan: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      onClick={onPlan}
      aria-label={`Plan a ${trip.lengthDays}-night ${trip.party} trip to ${trip.place}, from ${formatFrom(trip.total, trip.currency)}`}
      className="group flex w-full flex-col overflow-hidden rounded-lg bg-bg text-left shadow-card transition-shadow hover:shadow-float focus-visible:ring-2"
    >
      <div className="relative overflow-hidden">
        <Photo
          image={images.for(trip.imageKey)}
          imageKey={trip.imageKey}
          alt={`${trip.place} — ${trip.vibes.join(', ').toLowerCase()}`}
          ratio="aspect-[16/10]"
          className={reduce ? undefined : 'transition-transform duration-300 group-hover:scale-[1.03]'}
        />
        <div className="pointer-events-none absolute left-3 top-3">
          <TrendingBadge trending={trip.trending} />
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-pill bg-bg/95 px-3 py-1.5 text-sm font-semibold text-ink shadow-card backdrop-blur">
          from <span className="tnum text-azure-700">{formatFrom(trip.total, trip.currency)}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">{trip.place}</h3>
          <p className="mt-0.5 text-sm text-ink-2">
            {trip.lengthDays} nights · {trip.party} · {trip.bestSeason}
          </p>
          <p className="mt-1 text-xs font-medium text-azure-700">
            <span className="tnum">{trip.plannedThisWeek}</span> planned this week
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {trip.vibes.map((vibe) => (
            <Chip key={vibe} as="span">
              {vibe}
            </Chip>
          ))}
        </div>

        <BudgetSplitBar budget={trip.budget} total={trip.total} currency={trip.currency} />

        <p className="text-sm leading-relaxed text-ink-2">{trip.blurb}</p>

        <div className="mt-auto pt-1">
          <ProvenanceChip source={trip.source} freshness={trip.freshness} />
        </div>
      </div>
    </button>
  );
}
