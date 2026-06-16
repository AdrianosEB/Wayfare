import type { SavingHint } from '@/types';
import { cn } from '@/lib/cn';
import { formatDelta } from '@/lib/format';
import { TagIcon, SparkleIcon } from './icons';

/**
 * A friendly, one-tap saving/tradeoff (US-3.5): "Shift outbound −1 day · save €48".
 * Applying it triggers a scoped refinement. `trim` styling is used for over-budget cuts.
 */
export function SavingHintChip({
  hint,
  currency,
  variant = 'saving',
  disabled,
  onApply,
}: {
  hint: SavingHint;
  currency: string;
  variant?: 'saving' | 'trim';
  disabled?: boolean;
  onApply: (hint: SavingHint) => void;
}) {
  const saves = hint.delta < 0;
  const amount = formatDelta(hint.delta, currency);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onApply(hint)}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition',
        'focus-visible:ring-2 disabled:opacity-50',
        variant === 'trim'
          ? 'border-over/30 bg-over-soft/60 text-over hover:bg-over-soft'
          : 'border-accent/30 bg-accent-soft/50 text-ink hover:border-accent/60 hover:bg-accent-soft',
      )}
    >
      <span className={cn(variant === 'trim' ? 'text-over' : 'text-accent')}>
        {variant === 'trim' ? <TagIcon /> : <SparkleIcon />}
      </span>
      <span>{hint.description}</span>
      {hint.delta !== 0 && (
        <span
          className={cn(
            'tabular rounded-full px-1.5 py-0.5 font-semibold',
            saves ? 'bg-under-soft text-under' : 'bg-surface-2 text-ink',
          )}
        >
          {saves ? `save ${amount.replace('−', '')}` : amount}
        </span>
      )}
    </button>
  );
}
