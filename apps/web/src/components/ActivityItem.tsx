import type { ItineraryItem } from '@/types';
import { cn } from '@/lib/cn';
import { formatClock, formatDistance } from '@/lib/format';
import { Price } from './Price';
import { ChangedBadge } from './DiffHighlight';
import {
  ActivityIcon,
  FerryIcon,
  FreeIcon,
  MealIcon,
  WalkIcon,
} from './icons';

/**
 * One ordered item within a day: activity / transit / meal / free. Shows time, title,
 * walking distance from the previous item, a kid-suitability mark where relevant, and a
 * price + source chip when priced. "Free" items are styled distinctly (and celebrated for
 * budget users).
 */

const kindIcon = {
  activity: ActivityIcon,
  transit: FerryIcon,
  meal: MealIcon,
  free: FreeIcon,
} as const;

export function ActivityItem({
  item,
  changed,
  focused,
}: {
  item: ItineraryItem;
  changed?: boolean;
  focused?: boolean;
}) {
  const Icon = kindIcon[item.kind];
  const isFree = item.kind === 'free' || !item.listing;
  const time = item.startTime ?? (item.listing ? '' : '');

  return (
    <li className="relative flex gap-3">
      {/* timeline rail dot */}
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-surface',
            isFree ? 'bg-under-soft text-under' : 'bg-primary-soft text-primary',
            changed && 'bg-accent-soft text-accent',
          )}
        >
          <Icon className="text-sm" />
        </span>
        <span className="w-px flex-1 bg-border" aria-hidden />
      </div>

      <div className="flex-1 pb-4">
        {item.walkingFromPrev && (
          <span className="mb-1 inline-flex items-center gap-1 text-[11px] text-faint">
            <WalkIcon className="text-[12px]" />
            {item.walkingFromPrev.minutes} min walk ·{' '}
            {formatDistance(item.walkingFromPrev.meters)}
          </span>
        )}
        <div
          className={cn(
            'flex items-start justify-between gap-3 rounded-xl border bg-surface px-3 py-2.5 transition',
            focused ? 'border-primary/50 ring-1 ring-primary/40' : 'border-border',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {time && (
                <span className="tabular text-xs font-medium text-faint">
                  {item.startTime?.includes('T') ? formatClock(time) : time}
                  {item.endTime && `–${item.endTime.includes('T') ? formatClock(item.endTime) : item.endTime}`}
                </span>
              )}
              {changed && <ChangedBadge />}
              {item.kidSuitable && (
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Kid-friendly
                </span>
              )}
            </div>
            <p className={cn('mt-0.5 text-sm', isFree ? 'text-muted' : 'text-ink')}>
              {item.title}
            </p>
            {isFree && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-under-soft px-2 py-0.5 text-[11px] font-semibold text-under">
                Free
              </span>
            )}
          </div>
          {item.listing && <Price listing={item.listing} size="sm" />}
        </div>
      </div>
    </li>
  );
}
