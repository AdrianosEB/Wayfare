import type { ComponentType, SVGProps } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerChild } from '@/lib/motion';
import { SparkleIcon, TagIcon, MapPinIcon, CheckIcon } from '@/components/icons';
import { VALUE_CARDS } from '@/lib/content';
import { Section } from './_shared';

/**
 * "Why Wayfare" — the four differentiators in a 2×2 grid (stacked on mobile). Each card pairs
 * an azure line icon with the title + body from content.ts. Reveals with a stagger.
 */

const ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  tailor: SparkleIcon,
  cheaper: TagIcon,
  gems: MapPinIcon,
  honest: CheckIcon,
};

export function ValueCards() {
  return (
    <Section className="bg-surface">
      <h2 className="font-display text-3xl font-semibold text-ink">Why Wayfare</h2>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {VALUE_CARDS.map((card) => {
          const Icon = ICONS[card.key] ?? SparkleIcon;
          return (
            <motion.div
              key={card.key}
              variants={staggerChild}
              className="rounded-lg border border-border bg-bg p-6 shadow-card"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-azure-50 text-[22px] text-azure-600">
                <Icon aria-hidden />
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold text-ink">{card.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-2">{card.body}</p>
            </motion.div>
          );
        })}
      </motion.div>
    </Section>
  );
}
