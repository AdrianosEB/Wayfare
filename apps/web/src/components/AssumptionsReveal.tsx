import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Assumption } from '@/types';
import { cn } from '@/lib/cn';
import { humanize } from '@/lib/format';
import { InfoIcon, ChevronDownIcon } from './icons';

/**
 * The "ⓘ assumptions" reveal (US-5.2): lists the inferred defaults the agent took (e.g. on
 * skipped questions), so every assumption is visible rather than silent.
 */
export function AssumptionsReveal({ assumptions }: { assumptions: Assumption[] }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  if (assumptions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface-2/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-muted hover:text-ink"
      >
        <InfoIcon className="text-base text-faint" />
        <span className="flex-1 font-medium">
          {assumptions.length} assumption{assumptions.length === 1 ? '' : 's'} made
        </span>
        <ChevronDownIcon className={cn('text-base transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={reduce ? undefined : { height: 0, opacity: 0 }}
            animate={reduce ? undefined : { height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            className="overflow-hidden px-4 pb-3"
          >
            {assumptions.map((a, i) => (
              <li
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className="border-t border-border/60 py-2 first:border-t-0"
              >
                <p className="text-sm text-ink">
                  <span className="font-medium">{humanize(a.field)}:</span> {a.assumed}
                </p>
                <p className="text-xs text-faint">{a.reason}</p>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
