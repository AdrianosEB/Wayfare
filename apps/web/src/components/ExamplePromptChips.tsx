import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { cn } from '@/lib/cn';
import { EASE } from '@/lib/motion';

/**
 * Transform-only stagger — deliberately NOT the shared `staggerContainer`/`staggerIn` pair.
 *
 * Those start children at `opacity: 0`, and lib/motion.ts warns that the stagger orchestration
 * can stall (backgrounded tab, double-mount), freezing children invisible — the "disappearing
 * UI" bug. The shared variants are only safe when driven by `whileInView`, which self-heals via
 * IntersectionObserver; here they're driven by `animate`, which does not.
 *
 * These chips are the only alternative call-to-action on an otherwise empty planner screen, so
 * they must never be able to vanish. Opacity is never touched: a stalled animation leaves them
 * visible, merely un-nudged.
 */
const CHIPS_CONTAINER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const CHIP_ITEM: Variants = {
  hidden: { y: 12 },
  show: { y: 0, transition: { duration: 0.28, ease: EASE } },
};

/**
 * Tappable starter prompts on the empty state (US-1.3). Three examples spanning the
 * personas — a tight-budget solo trip, the Greek couple's trip, a family city break — so
 * users see the range and the expected "shape" of a prompt.
 */
const EXAMPLES: { label: string; prompt: string; tag: string }[] = [
  {
    tag: 'Couple · beach',
    label: 'A relaxed 8-day beach trip in Greece for two, ~€2,500',
    prompt:
      'I want a relaxed 8-day beach trip in Greece in late August for two people, around €2,500 total',
  },
  {
    tag: 'Solo · tight budget',
    label: 'A cheap sunny week in Europe in March, max €600, just me',
    prompt:
      'cheap sunny week somewhere in Europe in March, flexible dates, max €600, just me',
  },
  {
    tag: 'Family · city break',
    label: 'A long weekend in Lisbon with two kids, museums + parks',
    prompt:
      'a long weekend in Lisbon in October with two kids (6 and 9), some museums and parks, around £1,200',
  },
];

export interface ExamplePromptChipsProps {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

export function ExamplePromptChips({ onPick, disabled }: ExamplePromptChipsProps) {
  const reduce = useReducedMotion();
  return (
    <motion.ul
      variants={reduce ? undefined : CHIPS_CONTAINER}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'show'}
      className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:justify-center"
    >
      {EXAMPLES.map((ex) => (
        <motion.li key={ex.prompt} variants={reduce ? undefined : CHIP_ITEM} className="sm:max-w-[15rem] sm:flex-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(ex.prompt)}
            className={cn(
              'group flex h-full w-full flex-col items-start gap-1 rounded-2xl border border-border',
              'bg-surface/70 px-4 py-3 text-left transition',
              'hover:border-primary/40 hover:bg-surface hover:shadow-card',
              'focus-visible:ring-2 disabled:opacity-50',
            )}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              {ex.tag}
            </span>
            <span className="text-sm leading-snug text-muted group-hover:text-ink">
              {ex.label}
            </span>
          </button>
        </motion.li>
      ))}
    </motion.ul>
  );
}
