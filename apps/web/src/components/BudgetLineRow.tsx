import type { BudgetLine } from '@/types';
import { cn } from '@/lib/cn';
import { formatAmount, freshnessNote } from '@/lib/format';
import { CATEGORY_META } from './budgetMeta';

/**
 * One category line in the breakdown. Tappable to highlight the itinerary items behind it
 * (its `itemRefs`). Carries a freshness dot so each line is honest about its prices.
 */
export function BudgetLineRow({
  line,
  currency,
  focused,
  onFocus,
}: {
  line: BudgetLine;
  currency: string;
  focused: boolean;
  onFocus: (category: BudgetLine['category']) => void;
}) {
  const meta = CATEGORY_META[line.category];
  const note = freshnessNote(line.freshness);
  const interactive = line.itemRefs.length > 0;

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => onFocus(line.category)}
      aria-pressed={focused}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition',
        interactive ? 'hover:bg-surface-2' : 'cursor-default',
        focused && 'bg-surface-2 ring-1 ring-primary/40',
      )}
    >
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', meta.bar)} aria-hidden />
      <span className="flex-1 text-sm text-ink">{meta.label}</span>
      {note && <span className="text-[10px] text-faint">{note}</span>}
      <span className="tabular text-sm font-semibold text-ink">
        {formatAmount(line.amount, currency)}
      </span>
    </button>
  );
}
