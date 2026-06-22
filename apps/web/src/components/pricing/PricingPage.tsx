import { useReducedMotion } from 'framer-motion';
import { TopNav } from '@/components/landing/TopNav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { Section, formatFrom } from '@/components/landing/_shared';
import { Photo } from '@/components/Photo';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/Button';
import { images } from '@/lib/images';
import { navigate, planHref } from '@/lib/router';
import { BUDGET_TRIPS } from '@/lib/content';
import type { SampleTrip } from '@/lib/content';

/**
 * `/pricing` — a photo-rich showcase of the cheapest trips we'd point someone to. Mirrors the
 * landing TopNav + SiteFooter chrome and the azure/white design system. Cards render solid by
 * default (no opacity-from-0 entrance gating); only a subtle hover lift on the photo. Tapping
 * a card seeds the planner with that trip's prompt and auto-starts.
 */
export function PricingPage() {
  return (
    <div className="min-h-full bg-bg">
      <TopNav alwaysSolid />
      <main>
        <PricingHero />

        <Section className="pt-0">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BUDGET_TRIPS.map((trip) => (
              <BudgetCard
                key={trip.place}
                trip={trip}
                onClick={() => navigate(planHref({ seed: trip.prompt, autostart: true }))}
              />
            ))}
          </div>

          <p className="mt-8 max-w-prose text-sm text-ink-3">
            “From” prices are illustrative starting points for a short stay — flights and a
            simple place to sleep, per person unless noted. Tell us your dates and origin in the
            planner and we’ll price the whole thing honestly.
          </p>
        </Section>

        <PricingCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function PricingHero() {
  return (
    <Section className="pb-8 pt-16 sm:pt-24">
      <div className="max-w-2xl">
        <Chip as="span" className="mb-4">Budget-friendly</Chip>
        <h1 className="font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          Big trips, small budgets.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          The cheapest getaways worth taking right now — real destinations, low “from” prices,
          and a plan that adds up. Tap one to start tailoring it to your dates and budget.
        </p>
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

function PricingCTA() {
  return (
    <Section className="pt-0">
      <div className="flex flex-col items-start gap-5 rounded-xl bg-azure-50 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            Got a number in mind?
          </h2>
          <p className="mt-1.5 max-w-prose text-ink-2">
            Tell the planner your budget and we’ll find the trip that fits it — and show the math.
          </p>
        </div>
        <Button
          size="lg"
          className="shrink-0"
          onClick={() =>
            navigate(
              planHref({
                seed: 'Plan me the cheapest fun trip you can for a long weekend, max €250, just me',
                autostart: true,
              }),
            )
          }
        >
          Plan a cheap trip
        </Button>
      </div>
    </Section>
  );
}
