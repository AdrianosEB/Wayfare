import { cn } from '@/lib/cn';
import type { BudgetSplit } from '@/lib/content';

/**
 * A thin segmented bar showing how a trip's `total` splits across flights / stay / activities
 * / food, with a dotted legend underneath. Its aria-label summarizes the whole split.
 */
type SegmentKey = keyof BudgetSplit;

// Fixed order, so the bar and the legend read the same way. The first three step down the
// azure ramp (600 → 400 → 200); food uses `under` (green) because the palette has no azure-300.
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
  // Percentages are against `total` (the trip's headline price), not the sum of the segments,
  // so if the segments don't account for the whole total the bar under-fills. Fall back to
  // the segment sum, then 1, to keep the divisor positive when `total` is missing/zero.
  const sum = budget.flights + budget.stay + budget.activities + budget.food;
  const denom = total > 0 ? total : sum > 0 ? sum : 1;
  const pct = (n: number) => Math.round((n / denom) * 100);

  // One SR string for the whole bar so it reads as a single figure ("Flights 40%, Stay 30%…")
  // instead of four unlabeled colored spans.
  const summary = SEGMENTS.map((s) => `${s.label} ${pct(budget[s.key])}%`).join(', ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* role="img" + aria-label present the bar as one described image; the segment spans
          below are aria-hidden. */}
      <div
        role="img"
        aria-label={`Budget split (${currency}): ${summary}`}
        className="flex h-2 w-full overflow-hidden rounded-pill bg-surface-2"
      >
        {SEGMENTS.map((s) => {
          // Skip zero-width segments so we don't emit empty spans (a 0% flight leg, etc.).
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
