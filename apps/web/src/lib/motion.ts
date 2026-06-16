import type { Easing, Transition, Variants } from 'framer-motion';

/**
 * Shared Framer Motion variants — docs/design/MOTION.md. Calm, purposeful motion:
 * reveal don't bounce, stagger to show thinking, highlight change. Defined once, reused
 * everywhere. Components also honor `prefers-reduced-motion` via `useReducedMotion`; these
 * degrade to opacity-only there.
 */

/** Standard easing (ease-out-quint-ish) from MOTION.md. */
export const EASE: Easing = [0.22, 1, 0.36, 1];
/** Legacy alias kept for existing planner imports. */
export const easeOut = EASE;

/** Container that staggers its children in (cards, itinerary items, question cards). */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** A single item fading + sliding up into place (child of `staggerContainer`). */
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};
/** The planner imports the child/item variant as `staggerIn`. */
export const staggerIn = staggerChild;

/** Message bubbles, section reveals on scroll. */
export const fadeIn: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
};

/** Budget bar smoothly growing to its target width (width animated by the component). */
export const growBar: Transition = {
  type: 'spring',
  stiffness: 120,
  damping: 22,
  mass: 0.9,
};

/** A refined/changed item: pulse an azure ring once, then settle. */
export const pulseChanged: Variants = {
  idle: { boxShadow: '0 0 0 0 rgba(47,128,237,0)' },
  pulse: {
    boxShadow: [
      '0 0 0 0 rgba(47,128,237,0.0)',
      '0 0 0 4px rgba(47,128,237,0.35)',
      '0 0 0 0 rgba(47,128,237,0.0)',
    ],
    transition: { duration: 1.1, ease: EASE },
  },
};

/** Agent status line: typing-style reveal. */
export const statusLine: Variants = {
  hidden: { opacity: 0, x: -6 },
  show: { opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE } },
};

/** Card stack / panel entrance. */
export const cardIn: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: EASE } },
  exit: { opacity: 0, y: -8, scale: 0.985, transition: { duration: 0.2, ease: EASE } },
};

/** Modal / sheet (mobile budget expand). */
export const sheet: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
  exit: { opacity: 0, y: 24, transition: { duration: 0.2 } },
};

/** Hover lift for TripCard / StayCard. */
export const cardHover = { whileHover: { y: -2 }, transition: { duration: 0.18, ease: EASE } };
