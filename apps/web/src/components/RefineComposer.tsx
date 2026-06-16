import { useSession } from '@/store/session';
import { PromptInput } from './PromptInput';
import { QuickRefineChips } from './QuickRefineChips';

/**
 * The persistent refine zone at the foot of the chat: quick-action chips + the same
 * PromptInput (refine variant). Always reachable so the conversation can continue.
 */
export function RefineComposer() {
  const refine = useSession((s) => s.refine);
  const phase = useSession((s) => s.phase);
  const busy = phase === 'refining';
  const planning = phase === 'planning';

  return (
    <div className="flex flex-col gap-2.5">
      <QuickRefineChips onPick={refine} disabled={busy || planning} />
      <PromptInput
        variant="refine"
        placeholder="Refine your trip — “make it cheaper”, “swap the hotel”…"
        busy={busy}
        disabled={planning}
        onSubmit={refine}
      />
    </div>
  );
}
