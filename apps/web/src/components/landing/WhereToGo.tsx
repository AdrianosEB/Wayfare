import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/motion';
import { navigate, planHref } from '@/lib/router';
import { SAMPLE_TRIPS } from '@/lib/content';
import { Section } from './_shared';
import { TripCard } from './TripCard';

/**
 * "Where to go next" — a row of sample destination cards. Desktop is a grid; mobile becomes a
 * horizontal scroll-snap rail. Tapping a card seeds its prompt and starts planning.
 */
export function WhereToGo() {
  return (
    <Section>
      <h2 className="font-display text-3xl font-semibold text-ink">Where to go next</h2>
      <p className="mt-2 max-w-prose text-ink-2">
        A few starting points — tap one and tweak it in the chat.
      </p>

      {/* Mobile: scroll-snap rail · Desktop: grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="no-scrollbar mt-8 -mx-6 flex snap-x-mandatory gap-4 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4"
      >
        {SAMPLE_TRIPS.map((trip) => (
          <div key={trip.place} className="w-[78%] shrink-0 snap-start sm:w-auto">
            <TripCard trip={trip} onClick={() => navigate(planHref({ seed: trip.prompt, autostart: true }))} />
          </div>
        ))}
      </motion.div>
    </Section>
  );
}
