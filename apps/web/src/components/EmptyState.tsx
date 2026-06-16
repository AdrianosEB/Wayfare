import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSession } from '@/store/session';
import { EASE } from '@/lib/motion';
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
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-5 py-12">
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="w-full text-center"
      >
        <h1 className="text-balance font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Where do you want to go?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-pretty text-ink-2">
          Tell me about your trip and I'll plan the whole thing — flights, stays, and a
          day-by-day plan that fits your budget.
        </p>

        <div className="mt-8 w-full text-left">
          <PromptInput
            variant="hero"
            autoFocus
            value={value}
            onValueChange={setValue}
            busy={phase === 'creating'}
            onSubmit={submitPrompt}
          />
        </div>

        <div className="mt-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-3">
            Or try one of these
          </p>
          <ExamplePromptChips onPick={submitPrompt} disabled={phase === 'creating'} />
        </div>
      </motion.div>
    </div>
  );
}
