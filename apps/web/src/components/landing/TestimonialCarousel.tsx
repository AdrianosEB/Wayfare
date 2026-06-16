import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { StarIcon } from '@/components/icons';
import { TESTIMONIALS } from '@/lib/content';
import { Section } from './_shared';

/**
 * Testimonial carousel — one card at a time with prev/next arrows and dot navigation.
 * Keyboard-accessible: the arrow buttons carry aria-labels and the live region announces the
 * current card. Clearly sample content (labeled below the heading).
 */
export function TestimonialCarousel() {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const count = TESTIMONIALS.length;
  const current = TESTIMONIALS[index];

  if (!current) return null;

  const go = (next: number) => setIndex(((next % count) + count) % count);

  return (
    <Section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-3xl font-semibold text-ink">Loved by early travelers</h2>
        <span className="text-xs font-medium uppercase tracking-wide text-ink-3">Sample stories</span>
      </div>

      <div className="relative mt-8">
        <div
          className="overflow-hidden rounded-lg border border-border bg-bg p-8 shadow-card sm:p-10"
          aria-live="polite"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.figure
              key={index}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-1 text-azure-500" aria-label={`Rated ${current.rating} out of 5`}>
                {Array.from({ length: current.rating }).map((_, i) => (
                  <StarIcon key={i} className="text-base" />
                ))}
              </div>
              <blockquote className="mt-4 font-display text-xl font-medium leading-relaxed text-ink sm:text-2xl">
                “{current.quote}”
              </blockquote>
              <figcaption className="mt-5 text-sm text-ink-2">
                <span className="font-semibold text-ink">{current.author}</span>
                <span className="text-ink-3"> · {current.tripTaken}</span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <Arrow direction="prev" onClick={() => go(index - 1)} />
          <div className="flex items-center gap-2" role="tablist" aria-label="Choose a testimonial">
            {TESTIMONIALS.map((t, i) => (
              <button
                key={t.author}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Testimonial ${i + 1} of ${count}`}
                onClick={() => setIndex(i)}
                className={`h-2.5 rounded-pill transition focus-visible:ring-2 ${
                  i === index ? 'w-6 bg-azure-500' : 'w-2.5 bg-azure-200 hover:bg-azure-400'
                }`}
              />
            ))}
          </div>
          <Arrow direction="next" onClick={() => go(index + 1)} />
        </div>
      </div>
    </Section>
  );
}

function Arrow({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
  const isPrev = direction === 'prev';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrev ? 'Previous testimonial' : 'Next testimonial'}
      className="inline-flex h-10 w-10 items-center justify-center rounded-pill border border-border bg-bg text-ink-2 transition hover:bg-surface hover:text-ink focus-visible:ring-2"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {isPrev ? <path d="m15 6-6 6 6 6" /> : <path d="m9 6 6 6-6 6" />}
      </svg>
    </button>
  );
}
