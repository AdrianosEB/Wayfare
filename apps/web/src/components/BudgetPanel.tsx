import type { Budget, SavingHint, Trip } from '@/types';
import { useSession } from '@/store/session';
import { cn } from '@/lib/cn';
import { formatAmount, formatDelta } from '@/lib/format';
import { BudgetBar } from './BudgetBar';
import { BudgetLineRow } from './BudgetLineRow';
import { SavingHintChip } from './SavingHintChip';
import { CATEGORY_ORDER, statusMeta } from './budgetMeta';
import { InfoIcon } from './icons';

/**
 * The always-present running budget (DESIGN_SYSTEM §5). Headline total vs target with
 * under/on/over state + progress bar; category breakdown that rolls up to the total (tap a
 * line to highlight its itinerary items); saving-hint chips; and a calm over-budget state
 * with the overage and offered trims. Color is never the only signal — text + icons too.
 */
export function BudgetPanel({ compact = false }: { compact?: boolean }) {
  const trip = useSession((s) => s.trip);
  const working = useSession((s) => s.workingTrip);
  const phase = useSession((s) => s.phase);
  const budgetDelta = useSession((s) => s.budgetDelta);
  const focusedCategory = useSession((s) => s.focusedCategory);
  const setFocusedCategory = useSession((s) => s.setFocusedCategory);
  const refine = useSession((s) => s.refine);

  const view = (trip ?? working) as Partial<Trip> | null;
  const budget = view?.budget;
  const refining = phase === 'refining';

  if (!budget || typeof budget.total !== 'number') {
    return <EmptyBudget compact={compact} />;
  }

  const status = statusMeta(budget.status);
  const currency = budget.currency;
  const over = budget.status === 'over';
  // During streaming a `partial` budget may carry only total+status (no breakdown yet),
  // so default the derived arrays — the headline total can grow before the lines land.
  const lines = budget.lines ?? [];
  const savings = budget.savings ?? [];

  const applyHint = (hint: SavingHint) => {
    // One-tap: turn the hint into a natural-language refinement.
    refine(hint.description);
  };

  return (
    <section
      aria-label="Budget"
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card',
        compact && 'rounded-none border-0 shadow-none p-0',
      )}
    >
      {/* Headline */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">Total</p>
          <p className="tabular text-2xl font-bold text-ink">
            {formatAmount(budget.total, currency)}
          </p>
          {budget.target && (
            <p className="tabular text-xs text-muted">
              of {formatAmount(budget.target.amount, currency)} {budget.target.type === 'hard' ? 'cap' : 'target'}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={budget.status} label={status.label} tone={status.tone} soft={status.soft} />
          {budgetDelta !== null && budgetDelta !== 0 && (
            <span
              className={cn(
                'tabular text-xs font-semibold',
                budgetDelta < 0 ? 'text-under' : 'text-ink',
              )}
            >
              {formatDelta(budgetDelta, currency)} this change
            </span>
          )}
        </div>
      </div>

      <BudgetBar budget={budget} />

      {/* Category breakdown */}
      <div className="flex flex-col">
        {CATEGORY_ORDER.map((cat) => lines.find((l) => l.category === cat))
          .filter((l): l is NonNullable<typeof l> => !!l)
          .map((line) => (
            <BudgetLineRow
              key={line.category}
              line={line}
              currency={currency}
              focused={focusedCategory === line.category}
              onFocus={setFocusedCategory}
            />
          ))}
      </div>

      {/* Over-budget: calm overage + offered trims (US-4.3) */}
      {over && budget.overageNote && (
        <div className="flex gap-2 rounded-xl bg-over-soft/60 p-3 text-sm text-over">
          <InfoIcon className="mt-0.5 shrink-0 text-base" />
          <p>{budget.overageNote}</p>
        </div>
      )}

      {/* Saving hints / trims (US-3.5) */}
      {savings.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-faint">
            {over ? 'Trim to come back under' : 'Ways to save'}
          </p>
          <div className="flex flex-wrap gap-2">
            {savings.map((hint, i) => (
              <SavingHintChip
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                hint={hint}
                currency={currency}
                variant={over ? 'trim' : 'saving'}
                disabled={refining}
                onApply={applyHint}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function StatusBadge({
  status,
  label,
  tone,
  soft,
}: {
  status: Budget['status'];
  label: string;
  tone: string;
  soft: string;
}) {
  // Icon + text accompany color (a11y: color is never the only signal).
  const glyph = status === 'over' ? '▲' : status === 'on_target' ? '◆' : '✓';
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', soft, tone)}
    >
      <span aria-hidden>{glyph}</span>
      {label}
    </span>
  );
}

function EmptyBudget({ compact }: { compact: boolean }) {
  return (
    <section
      aria-label="Budget"
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card',
        compact && 'rounded-none border-0 shadow-none p-0',
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-faint">Total</p>
      <div className="h-7 w-28 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-3 w-full animate-pulse rounded-full bg-surface-2" />
      <p className="text-xs text-faint">Your running budget appears here as the plan lands.</p>
    </section>
  );
}
