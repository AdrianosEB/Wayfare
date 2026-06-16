import { motion, useReducedMotion } from 'framer-motion';
import type { Budget } from '@/types';
import { cn } from '@/lib/cn';
import { growBar } from '@/lib/motion';
import { CATEGORY_META, CATEGORY_ORDER } from './budgetMeta';

/**
 * A stacked, smoothly-growing budget bar: one segment per category, with a target marker
 * line. The scale is max(total, target) padded a little, so going over target visibly
 * pushes past the marker.
 */
export function BudgetBar({ budget }: { budget: Budget }) {
  const reduce = useReducedMotion();
  const target = budget.target?.amount;
  const scaleMax = Math.max(budget.total, target ?? 0) * 1.08 || 1;

  const lines = budget.lines ?? [];
  const segments = CATEGORY_ORDER.map((cat) => lines.find((l) => l.category === cat))
    .filter((l): l is NonNullable<typeof l> => !!l && l.amount > 0)
    .map((l) => ({ ...l, pct: (l.amount / scaleMax) * 100 }));

  const targetPct = target ? Math.min(100, (target / scaleMax) * 100) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="flex h-full w-full">
          {segments.map((s) => (
            <motion.div
              key={s.category}
              className={cn('h-full', CATEGORY_META[s.category].bar)}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${s.pct}%` }}
              transition={reduce ? { duration: 0 } : growBar}
              title={`${CATEGORY_META[s.category].label}`}
            />
          ))}
        </div>
        {/* target marker */}
        {targetPct !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-ink/50"
            style={{ left: `${targetPct}%` }}
            aria-hidden
          />
        )}
      </div>
      {targetPct !== null && (
        <div className="relative h-3 text-[10px] text-faint">
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${targetPct}%` }}
          >
            target
          </span>
        </div>
      )}
    </div>
  );
}
