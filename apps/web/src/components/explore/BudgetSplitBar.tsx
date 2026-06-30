import { cn } from '@/lib/cn';
import type { BudgetSplit } from '@/lib/content';

/**
 * A thin, segmented horizontal bar showing how a trip's `total` splits across flights / stay /
 * activities / food. Four on-brand tints — the azure trio (600/400/200) plus the calm green
 * `under` token as the distinct warm-ish accent for food (azure-300 does NOT exist in the
 * palette; see TOKENS). A compact dotted legend underneath shows each segment's share.
 *
 * Rendered solid by default — no opacity entrance animation — and carries an aria-label that
 * summarizes the whole split for screen readers.
 */
type SegmentKey = keyof BudgetSplit;

const SEGMENTS: { key: SegmentKey; label: string; bar: string; dot: string }[] = [
  { key: 'flights', label: 'Flights', bar: 'bg-azure-600', dot: 'bg-azure-600' },
  { key: 'stay', label: 'Stay', bar: 'bg-azure-400', dot: 'bg-azure-400' },
  { key: 'activities', label: 'Activities', bar: 'bg-azure-200', dot: 'bg-azure-200' },
  { key: 'food', label: 'Food', bar: 'bg-under', dot: 'bg-under' },
];

export function BudgetSplitBar({
  budget,
  total,
  currency,
  className,
}: {
  budget: BudgetSplit;
  total: number;
  currency: string;
  className?: string;
}) {
  // Guard against a zero/negative total so widths stay finite; sum is the honest denominator.
  const sum = budget.flights + budget.stay + budget.activities + budget.food;
  const denom = total > 0 ? total : sum > 0 ? sum : 1;
  const pct = (n: number) => Math.round((n / denom) * 100);

  const summary = SEGMENTS.map((s) => `${s.label} ${pct(budget[s.key])}%`).join(', ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div
        role="img"
        aria-label={`Budget split (${currency}): ${summary}`}
        className="flex h-2 w-full overflow-hidden rounded-pill bg-surface-2"
      >
        {SEGMENTS.map((s) => {
          const width = pct(budget[s.key]);
          if (width <= 0) return null;
          return (
            <span
              key={s.key}
              className={s.bar}
              style={{ width: `${width}%` }}
              aria-hidden
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-none text-ink-3">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} aria-hidden />
            <span className="text-ink-2">{s.label}</span>
            <span className="tabular">{pct(budget[s.key])}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
