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

// Segment order is fixed (flights → stay → activities → food) so the stacked bar and the legend
// below always read left-to-right in the same order. Tints step DOWN the azure ramp
// (600 → 400 → 200) for the first three, then break to `under` (green) for food — that contrast
// is what makes food distinguishable, since azure-300 is intentionally absent from the palette.
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
  // Percentages are taken against `total` (the trip's headline price), NOT the sum of the four
  // segments — so if the segments don't fully account for the total the bar honestly under-fills
  // rather than silently normalizing to 100%. Fall back to the segment sum, then to 1, only to
  // keep the divisor positive and widths finite when `total` is missing/zero.
  const sum = budget.flights + budget.stay + budget.activities + budget.food;
  const denom = total > 0 ? total : sum > 0 ? sum : 1;
  const pct = (n: number) => Math.round((n / denom) * 100);

  // One SR string for the whole bar so it reads as a single figure ("Flights 40%, Stay 30%…")
  // instead of four unlabeled colored spans.
  const summary = SEGMENTS.map((s) => `${s.label} ${pct(budget[s.key])}%`).join(', ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* role="img" + aria-label collapses the decorative segment spans into one described image;
          the individual bars are aria-hidden below. The bar track shows bg-surface-2 in any gap
          left when the segments sum to under 100% of the total. */}
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
