import { motion, useReducedMotion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { Chip } from '@/components/Chip';
import { staggerChild } from '@/lib/motion';
import { images } from '@/lib/images';
import { formatFrom } from './_shared';
import type { SampleTrip } from '@/lib/content';

/**
 * A destination card for "Where to go next" — photo, place, "{days} days · from {price}",
 * and a vibe chip. Tapping it seeds the prompt and enters the planner. Hover lifts.
 */
export function TripCard({ trip, onClick }: { trip: SampleTrip; onClick: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      variants={staggerChild}
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="group flex w-full flex-col overflow-hidden rounded-lg bg-bg text-left shadow-card transition-shadow hover:shadow-float focus-visible:ring-2"
      aria-label={`Plan a ${trip.lengthDays}-day trip to ${trip.place}, from ${formatFrom(trip.fromAmount, trip.currency)}`}
    >
      <Photo
        image={images.for(trip.imageKey)}
        imageKey={trip.imageKey}
        alt={`${trip.place} — ${trip.vibe.toLowerCase()}`}
        ratio="aspect-[16/10]"
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">{trip.place}</h3>
          <p className="mt-0.5 text-sm text-ink-2">
            {trip.lengthDays} days · from{' '}
            <span className="tnum font-medium text-ink">{formatFrom(trip.fromAmount, trip.currency)}</span>
          </p>
        </div>
        <div className="mt-auto">
          <Chip as="span">{trip.vibe}</Chip>
        </div>
      </div>
    </motion.button>
  );
}
