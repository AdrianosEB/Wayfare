import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Trip } from '@/types';
import { useSession } from '@/store/session';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/format';
import { statusMeta } from './budgetMeta';
import { BudgetPanel } from './BudgetPanel';
import { ChevronDownIcon, XIcon } from './icons';

/**
 * Mobile-only: a sticky bottom bar showing the running total + state, always in view. Tap
 * to expand the full BudgetPanel in a bottom sheet. Hidden on desktop (budget docks in the
 * plan column there).
 */
export function MobileBudgetBar() {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const trip = useSession((s) => s.trip);
  const working = useSession((s) => s.workingTrip);
  const view = (trip ?? working) as Partial<Trip> | null;
  const budget = view?.budget;
  if (!budget || typeof budget.total !== 'number') return null;

  const status = statusMeta(budget.status);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open budget"
          className="pointer-events-auto flex w-full items-center gap-3 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80"
        >
          <div className="flex flex-1 flex-col items-start">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">
              Total
            </span>
            <span className="tabular text-lg font-bold leading-none text-ink">
              {formatAmount(budget.total, budget.currency)}
            </span>
          </div>
          <span
            className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', status.soft, status.tone)}
          >
            {status.label}
          </span>
          <ChevronDownIcon className="rotate-180 text-lg text-muted" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex items-end lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close budget"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-ink/40"
            />
            <motion.div
              initial={reduce ? { opacity: 0 } : { y: '100%' }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: '100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-sand p-4 pb-8"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink">Budget</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted"
                >
                  <XIcon className="text-base" />
                </button>
              </div>
              <BudgetPanel />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
