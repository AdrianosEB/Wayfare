import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSession } from '@/store/session';
import { EASE } from '@/lib/motion';
import { Chip } from '@/components/Chip';
import { SparkleIcon } from '@/components/icons';
import { PromptInput } from './PromptInput';
import { ExamplePromptChips } from './ExamplePromptChips';

/**
 * The planner empty state (SCREENS Screen 1): a near-empty, inviting hero. One large input
 * plus the example prompts spanning the personas. `initialPrompt` pre-fills the box when the
 * planner was entered from a trip-type tile (seed, don't auto-start).
 */
export interface EmptyStateProps {
  initialPrompt?: string;
}

export function EmptyState({ initialPrompt }: EmptyStateProps) {
  const reduce = useReducedMotion();
  const submitPrompt = useSession((s) => s.submitPrompt);
  const phase = useSession((s) => s.phase);
  const [value, setValue] = useState(initialPrompt ?? '');

  return (
    // Root spans the FULL width so the decorative glow reads as an ambient page wash. If the
    // backdrop lived inside the max-w-2xl content column it would paint as a hard-edged blue
    // rectangle floating in the white page. Content is re-constrained to max-w-2xl below.
    <div className="relative flex min-h-full w-full flex-col items-center justify-center overflow-hidden px-5 py-12">
      {/*
        Decorative backdrop — same tone/technique as `components/explore/ExploreBackdrop.tsx`
        (soft brand-azure glows: heavy blur + low opacity, over a vertical azure wash), but
        implemented inline here because the explore one is tuned to that page's hero band.

        - VISIBLE BY DEFAULT: static, no animation, no opacity entrance. `aria-hidden` +
          `pointer-events-none` keep it out of the a11y tree and off the hit-testing path.
        - NO HORIZONTAL BLEED: every element is horizontally constrained (`inset-x-0` /
          `left-0` / `right-0` / `left-1/2 -translate-x-1/2`) — never negative horizontal
          insets — and the root's `overflow-hidden` clips anything reaching an edge, so this
          layer can never widen the page or produce a mobile scrollbar.
      */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-b from-azure-100 via-azure-50/60 to-transparent" />
        <div className="absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-azure-400/30 blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-azure-500/25 blur-3xl" />
        <div className="absolute left-0 top-56 h-80 w-80 rounded-full bg-azure-400/25 blur-3xl" />
      </div>

      {/*
        VISIBLE BY DEFAULT (see the "disappearing UI" guardrail): this wraps the whole planner
        empty state — heading, prompt box, example chips — so it must never be gated behind an
        opacity:0 entrance. A stalled fade here (e.g. on the SPA route change from the marketing
        nav's "Plan my trip") would leave the planner body blank under the TopBar. So we animate
        only a gentle slide-up as an enhancement; opacity stays 1 throughout, and under reduced
        motion we skip the initial offset entirely.
      */}
      <motion.div
        initial={reduce ? false : { y: 16 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="relative z-10 w-full max-w-2xl text-center"
      >
        <Chip as="span" icon={<SparkleIcon />} className="mb-5 shadow-card">
          Plan a trip in one sentence
        </Chip>

        <h1 className="text-balance font-display text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
          Where do you want to go?
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty text-ink-2">
          Tell me about your trip and I'll plan the whole thing — flights, stays, and a
          day-by-day plan that fits your budget.
        </p>

        <div className="mt-9 w-full text-left">
          <PromptInput
            variant="hero"
            autoFocus
            value={value}
            onValueChange={setValue}
            busy={phase === 'creating'}
            onSubmit={submitPrompt}
          />
        </div>

        <div className="mt-8">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-3">
            Or try one of these
          </p>
          <ExamplePromptChips onPick={submitPrompt} disabled={phase === 'creating'} />
        </div>
      </motion.div>
    </div>
  );
}
