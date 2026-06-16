import { motion, useReducedMotion } from 'framer-motion';
import { useSession } from '@/store/session';
import { PromptInput } from './PromptInput';
import { ExamplePromptChips } from './ExamplePromptChips';

/**
 * The front door (DESIGN_SYSTEM §1): a near-empty, inviting hero. One large centered input
 * plus a few example prompts spanning the personas. Minimal chrome — "just type."
 */
export function EmptyState() {
  const reduce = useReducedMotion();
  const submitPrompt = useSession((s) => s.submitPrompt);
  const phase = useSession((s) => s.phase);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-5 py-12">
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full text-center"
      >
        <h1 className="text-balance text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Where do you want to go?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-pretty text-muted">
          Describe your trip in a sentence — a vibe, a budget, roughly when. Wayfare plans the
          whole thing and shows you the money math.
        </p>

        <div className="mt-8 w-full text-left">
          <PromptInput
            variant="hero"
            autoFocus
            busy={phase === 'creating'}
            onSubmit={submitPrompt}
          />
        </div>

        <div className="mt-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-faint">
            Or try one of these
          </p>
          <ExamplePromptChips onPick={submitPrompt} disabled={phase === 'creating'} />
        </div>
      </motion.div>
    </div>
  );
}
