import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSession } from '@/store/session';
import { EASE } from '@/lib/motion';
import { Chip } from '@/components/Chip';
import { SparkleIcon } from '@/components/icons';
import { PromptInput } from './PromptInput';
import { ExamplePromptChips } from './ExamplePromptChips';

/**
 * The planner empty state (SCREENS Screen 1). `initialPrompt` pre-fills the box when the
 * planner was entered from a trip-type tile; it does not auto-start.
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
    // Root is full width so the backdrop glow isn't cut off at the max-w-2xl column, where
    // it would show as a hard-edged blue rectangle. Content is re-constrained below.
    <div className="relative flex min-h-full w-full flex-col items-center justify-center overflow-hidden px-5 py-12">
      {/*
        Decorative backdrop, same technique as `components/explore/ExploreBackdrop.tsx`. Static,
        and with no negative horizontal insets so it can't widen the page on mobile.
      */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-b from-azure-100 via-azure-50/60 to-transparent" />
        <div className="absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-azure-400/30 blur-3xl" />
        <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-azure-500/25 blur-3xl" />
        <div className="absolute left-0 top-56 h-80 w-80 rounded-full bg-azure-400/25 blur-3xl" />
      </div>

      {/*
        Slide-up only, never an opacity:0 entrance: a stalled fade (e.g. on the SPA route
        change from the marketing nav) would leave the planner body blank under the TopBar.
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
          Tell me about your trip and I'll plan the whole thing: flights, stays, and a
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
