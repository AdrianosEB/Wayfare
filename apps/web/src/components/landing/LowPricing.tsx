import { useReducedMotion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { Chip } from '@/components/Chip';
import { images } from '@/lib/images';
import { navigate, planHref } from '@/lib/router';
import { BUDGET_TRIPS } from '@/lib/content';
import type { SampleTrip } from '@/lib/content';
import { Section, formatFrom } from './_shared';

/**
 * "Big trips, small budgets" — a photo-rich grid of the cheapest trips, reusing the BudgetCard
 * style from the `/pricing` page. Shows the first six BUDGET_TRIPS; tapping a card seeds the
 * planner. A "See all budget trips" link routes to the full `/pricing` page.
 */
export function LowPricing() {
  const trips = BUDGET_TRIPS.slice(0, 6);
  return (
    <Section className="bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-semibold text-ink">Big trips, small budgets</h2>
          <p className="mt-2 text-ink-2">
            The cheapest getaways worth taking right now — real places, low “from” prices, a plan
            that adds up. Tap one to tailor it to your dates.
          </p>
        </div>
        <a
          href="/pricing"
          onClick={(e) => {
            e.preventDefault();
            navigate('/pricing');
          }}
          className="rounded text-sm font-semibold text-azure-700 transition hover:text-azure-600 focus-visible:ring-2"
        >
          See all budget trips →
        </a>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((trip) => (
          <BudgetCard
            key={trip.place}
            trip={trip}
            onClick={() => navigate(planHref({ seed: trip.prompt, autostart: true }))}
          />
        ))}
      </div>
    </Section>
  );
}

function BudgetCard({ trip, onClick }: { trip: SampleTrip; onClick: () => void }) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col overflow-hidden rounded-lg bg-bg text-left shadow-card transition-shadow hover:shadow-float focus-visible:ring-2"
      aria-label={`Plan a ${trip.lengthDays}-night trip to ${trip.place}, from ${formatFrom(trip.fromAmount, trip.currency)}`}
    >
      <div className="relative overflow-hidden">
        <Photo
          image={images.for(trip.imageKey)}
          imageKey={trip.imageKey}
          alt={`${trip.place} — ${trip.vibe.toLowerCase()}`}
          ratio="aspect-[16/10]"
          className={reduce ? undefined : 'transition-transform duration-300 group-hover:scale-[1.03]'}
        />
        <div className="pointer-events-none absolute right-3 top-3 rounded-pill bg-bg/95 px-3 py-1.5 text-sm font-semibold text-ink shadow-card backdrop-blur">
          from <span className="tnum text-azure-700">{formatFrom(trip.fromAmount, trip.currency)}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">{trip.place}</h3>
          <p className="mt-0.5 text-sm text-ink-2">{trip.lengthDays} nights</p>
        </div>
        <div className="mt-auto">
          <Chip as="span">{trip.vibe}</Chip>
        </div>
      </div>
    </button>
  );
}
