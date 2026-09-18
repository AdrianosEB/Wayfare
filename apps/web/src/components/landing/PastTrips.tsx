import { motion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { Button } from '@/components/Button';
import { images } from '@/lib/images';
import { revealItem } from '@/lib/motion';
import { navigate, planHref } from '@/lib/router';
import { PAST_TRIPS } from '@/lib/content';
import type { PastTrip } from '@/lib/content';
import { Reveal, RevealGroup, Section } from './_shared';

/**
 * "Recently planned on Wayfare" — a showcase of example planned trips as inspiration and social
 * proof. Curated content for now; ready to become real saved per-user history when trip-saving
 * lands (see PAST_TRIPS in content.ts). Each card seeds the planner with a similar prompt.
 */
export function PastTrips() {
  return (
    <Section className="bg-surface">
      <Reveal className="max-w-xl">
        <h2 className="font-display text-3xl font-semibold text-ink">Recently planned on Wayfare</h2>
        <p className="mt-2 text-ink-2">
          Real-shaped trips other travellers put together — tap to plan one like it.
        </p>
      </Reveal>

      <RevealGroup className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PAST_TRIPS.map((trip) => (
          <PastTripCard
            key={trip.place}
            trip={trip}
            onClick={() => navigate(planHref({ seed: trip.prompt, autostart: true }))}
          />
        ))}
      </RevealGroup>
    </Section>
  );
}

function PastTripCard({ trip, onClick }: { trip: PastTrip; onClick: () => void }) {
  return (
    <motion.article
      variants={revealItem}
      className="group flex flex-col overflow-hidden rounded-lg bg-bg shadow-card transition-shadow hover:shadow-float"
    >
      <div className="relative overflow-hidden">
        <Photo
          image={images.for(trip.imageKey)}
          imageKey={trip.imageKey}
          alt={`${trip.place} — ${trip.vibe.toLowerCase()}`}
          ratio="aspect-[16/10]"
          className="transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
        />
        <span className="photo-scrim absolute inset-0" aria-hidden />
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
    </motion.article>
  );
}
