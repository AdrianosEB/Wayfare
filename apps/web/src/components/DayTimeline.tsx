import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Day, ItineraryItem } from '@/types';
import { cn } from '@/lib/cn';
import { formatDayDate } from '@/lib/format';
import { ActivityItem } from './ActivityItem';
import { ChevronDownIcon } from './icons';

/**
 * One expandable card per day: ordered activity/meal/transit items along a timeline rail.
 * Defaults open; collapses to a one-line summary. `isChanged` marks items a refinement
 * touched.
 */
export function DayTimeline({
  day,
  defaultOpen = true,
  isChanged,
  isFocused,
}: {
  day: Day;
  defaultOpen?: boolean;
  isChanged?: (item: ItineraryItem) => boolean;
  isFocused?: (item: ItineraryItem) => boolean;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const priced = day.items.filter((i) => i.listing).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface"
      >
        <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2 leading-none">
          <span className="text-[9px] font-semibold uppercase text-faint">Day</span>
          <span className="tabular text-sm font-bold text-ink">{day.index}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{day.title}</p>
          <p className="text-xs text-faint">
            {formatDayDate(day.date)} · {day.items.length} item{day.items.length === 1 ? '' : 's'}
            {priced > 0 ? '' : ' · all free'}
          </p>
        </div>
        <ChevronDownIcon
          className={cn('text-lg text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? undefined : { height: 0, opacity: 0 }}
            animate={reduce ? undefined : { height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-2 pt-1">
              {day.notes && (
                <p className="mb-2 rounded-lg bg-surface-2/70 px-3 py-1.5 text-xs text-muted">
                  {day.notes}
                </p>
              )}
              <ul className="flex flex-col">
                {day.items.map((item) => (
                  <ActivityItem
                    key={item.id}
                    item={item}
                    changed={isChanged?.(item)}
                    focused={isFocused?.(item)}
                  />
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
