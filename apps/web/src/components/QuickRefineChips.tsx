import { cn } from '@/lib/cn';

/**
 * Quick-action chips for common refinements (DESIGN_SYSTEM §6) — they lower the friction of
 * discovering what's possible. Tapping one sends it as a natural-language refinement.
 */
const QUICK: { label: string; utterance: string }[] = [
  { label: 'Make it cheaper', utterance: 'make it cheaper' },
  { label: 'Swap the hotel', utterance: 'swap the hotel for something nicer' },
  { label: 'Add a day trip', utterance: 'add a day trip to a quieter island' },
  { label: 'Earlier flight', utterance: 'find an earlier outbound flight' },
];

export interface QuickRefineChipsProps {
  onPick: (utterance: string) => void;
  disabled?: boolean;
}

export function QuickRefineChips({ onPick, disabled }: QuickRefineChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Quick refinements">
      {QUICK.map((q) => (
        <button
          key={q.utterance}
          type="button"
          disabled={disabled}
          onClick={() => onPick(q.utterance)}
          className={cn(
            'rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition',
            'hover:border-primary/40 hover:text-ink focus-visible:ring-2 disabled:opacity-50',
          )}
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}
