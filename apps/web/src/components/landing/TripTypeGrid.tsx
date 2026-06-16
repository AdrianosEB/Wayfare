import { motion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { staggerContainer, staggerChild } from '@/lib/motion';
import { images } from '@/lib/images';
import { navigate, planHref } from '@/lib/router';
import { TRIP_TYPES } from '@/lib/content';
import { Section } from './_shared';

/**
 * "Plan any kind of trip" — small photo tiles for each trip-type preset. Selecting one seeds
 * the tailored prompt via `/plan/:type` and enters the app.
 */
export function TripTypeGrid() {
  return (
    <Section id="trip-types" className="bg-surface">
      <h2 className="font-display text-3xl font-semibold text-ink">Plan any kind of trip</h2>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        {TRIP_TYPES.map((t) => (
          <motion.button
            key={t.type}
            type="button"
            variants={staggerChild}
            onClick={() => navigate(planHref({ type: t.type }))}
            className="group relative isolate flex aspect-[4/3] items-end overflow-hidden rounded-lg text-left shadow-card transition hover:shadow-float focus-visible:ring-2"
            aria-label={`Plan a ${t.label.toLowerCase()} trip`}
          >
            <Photo
              image={images.for(t.imageKey)}
              imageKey={t.imageKey}
              alt=""
              className="absolute inset-0 -z-10 h-full w-full transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-0 -z-10 bg-scrim" aria-hidden />
            <span className="p-3.5 text-sm font-semibold leading-tight text-white">{t.label}</span>
          </motion.button>
        ))}
      </motion.div>
    </Section>
  );
}
