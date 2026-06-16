import type { Easing, Transition, Variants } from 'framer-motion';

/**
 * Shared Framer Motion variants (DESIGN_SYSTEM.md): calm, purposeful motion —
 * `staggerIn` for streaming itinerary items, `growBar` for the budget bar, `pulseChanged`
 * for refined items. Components also honor `prefers-reduced-motion` via `useReducedMotion`;
 * these variants degrade to opacity-only there.
 */

export const easeOut: Easing = [0.16, 1, 0.3, 1];

/** Container that staggers its children in as items stream/land. */
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

/** A single item fading + sliding up into place. */
export const staggerIn: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: easeOut },
  },
};

/** Reduced-motion variant: opacity only, no travel. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: easeOut } },
};

/** Budget bar smoothly growing to its target width (width animated by the component). */
export const growBar: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 22,
  mass: 0.9,
};

/** A gentle accent pulse/outline on items a refinement changed. */
export const pulseChanged: Variants = {
  idle: { boxShadow: '0 0 0 0 rgb(var(--c-accent) / 0)' },
  pulse: {
    boxShadow: [
      '0 0 0 0 rgb(var(--c-accent) / 0.0)',
      '0 0 0 4px rgb(var(--c-accent) / 0.28)',
      '0 0 0 0 rgb(var(--c-accent) / 0.0)',
    ],
    transition: { duration: 1.6, ease: 'easeInOut', repeat: 1 },
  },
};

/** Card stack / panel entrance. */
export const cardIn: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: easeOut } },
  exit: { opacity: 0, y: -8, scale: 0.985, transition: { duration: 0.2, ease: easeOut } },
};
