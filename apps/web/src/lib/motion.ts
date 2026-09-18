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

/**
 * ⚠️ "Disappearing UI" guardrail — read before reusing these on critical content.
 *
 * `staggerChild` starts at opacity:0 and is revealed by its parent `staggerContainer`'s
 * `staggerChildren` orchestration. That orchestration can STALL — under React StrictMode's
 * dev double-mount (now removed in main.tsx) or in paused/backgrounded tabs — leaving the
 * children frozen near opacity:0, i.e. invisible. That was the "disappearing UI" bug.
 *
 * Safe usage (what the landing does): drive these from `whileInView` with
 * `viewport={{ once: true }}` for non-essential, scroll-revealed marketing chrome — the
 * IntersectionObserver re-triggers and self-heals. Do NOT gate must-see content (the streamed
 * itinerary, plan, or budget in the planner) behind an opacity-from-0 entrance; render that
 * VISIBLE BY DEFAULT. See main.tsx and store/session.ts.
 */

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

/**
 * Scroll reveal for marketing sections — a slightly larger, slower move than `staggerChild`,
 * which was tuned for in-app lists where things should appear briskly. On a landing page the
 * content is the event, so it gets 24px of travel and ~0.5s to settle.
 *
 * Always drive these from `whileInView` with `revealViewport` (i.e. `once: true`). Per the
 * guardrail above, that is what makes them safe: the IntersectionObserver re-fires and
 * self-heals, so content can never get stranded near opacity 0.
 */
export const revealContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.03 } },
};

/**
 * The slight scale is what separates "appears" from "settles" — travel alone reads as a
 * slide, while a 1.5% scale-up alongside it reads as the card coming to rest. Both are
 * compositor-only properties (transform + opacity), so a full grid staggering in never
 * touches layout or paint.
 */
export const revealItem: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.58, ease: EASE },
  },
};

/** Shared viewport config: fire once, slightly before the element is fully on screen. */
export const revealViewport = { once: true, margin: '-80px' } as const;

/** Hover lift for TripCard / StayCard. */
export const cardHover = { whileHover: { y: -2 }, transition: { duration: 0.18, ease: EASE } };
