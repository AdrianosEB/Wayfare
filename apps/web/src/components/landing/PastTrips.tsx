import { useReducedMotion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { Button } from '@/components/Button';
import { images } from '@/lib/images';
import { navigate, planHref } from '@/lib/router';
import { PAST_TRIPS } from '@/lib/content';
import type { PastTrip } from '@/lib/content';
import { Section } from './_shared';

/**
 * "Recently planned on Wayfare" — a showcase of example planned trips as inspiration and social
 * proof. Curated content for now; ready to become real saved per-user history when trip-saving
 * lands (see PAST_TRIPS in content.ts). Each card seeds the planner with a similar prompt.
 */
export function PastTrips() {
  return (
    <Section>
      <div className="max-w-xl">
        <h2 className="font-display text-3xl font-semibold text-ink">Recently planned on Wayfare</h2>
        <p className="mt-2 text-ink-2">
          Real-shaped trips other travellers put together — tap to plan one like it.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PAST_TRIPS.map((trip) => (
          <PastTripCard
            key={trip.place}
            trip={trip}
            onClick={() => navigate(planHref({ seed: trip.prompt, autostart: true }))}
          />
        ))}
      </div>
    </Section>
  );
}

function PastTripCard({ trip, onClick }: { trip: PastTrip; onClick: () => void }) {
  const reduce = useReducedMotion();
  return (
    <article className="group flex flex-col overflow-hidden rounded-lg bg-bg shadow-card transition-shadow hover:shadow-float">
      <div className="relative overflow-hidden">
        <Photo
          image={images.for(trip.imageKey)}
          imageKey={trip.imageKey}
          alt={`${trip.place} — ${trip.vibe.toLowerCase()}`}
          ratio="aspect-[16/10]"
          className={reduce ? undefined : 'transition-transform duration-300 group-hover:scale-[1.03]'}
        />
        <span className="absolute inset-0 bg-scrim" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="font-display text-lg font-semibold leading-tight text-white">{trip.summary}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <p className="text-sm text-ink-2">{trip.vibe}</p>
        <Button variant="ghost" className="mt-auto self-start" onClick={onClick}>
          Plan one like this →
        </Button>
      </div>
    </article>
  );
}
