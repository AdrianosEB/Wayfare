import type { Flight } from '@/types';
import { cn } from '@/lib/cn';
import { formatClock, formatDuration } from '@/lib/format';
import { Price } from './Price';
import { ChangedBadge, DiffHighlight } from './DiffHighlight';
import { PlaneIcon } from './icons';

/**
 * One flight leg (outbound/return): times, route, stops, carrier + price/source chip.
 */
export function FlightCard({
  flight,
  changed,
  focused,
  pulseKey,
}: {
  flight: Flight;
  changed?: boolean;
  focused?: boolean;
  pulseKey?: string | number;
}) {
  const stopsLabel =
    flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops === 1 ? '' : 's'}`;
  const dirLabel = flight.direction === 'return' ? 'Return' : flight.direction === 'intra' ? 'Connection' : 'Outbound';

  return (
    <DiffHighlight changed={!!changed} focused={focused} pulseKey={pulseKey}>
      <div className="flex items-stretch gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary',
              flight.direction === 'return' && 'rotate-180',
            )}
          >
            <PlaneIcon className="text-base" />
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              {dirLabel}
            </span>
            {changed && <ChangedBadge />}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="tabular text-lg font-semibold text-ink">
              {formatClock(flight.departISO)}
            </span>
            <span className="font-mono text-sm text-muted">{flight.from}</span>
            <span className="flex-1 border-t border-dashed border-border" />
            <span className="whitespace-nowrap text-xs text-faint">
              {formatDuration(flight.departISO, flight.arriveISO)} · {stopsLabel}
            </span>
            <span className="flex-1 border-t border-dashed border-border" />
            <span className="font-mono text-sm text-muted">{flight.to}</span>
            <span className="tabular text-lg font-semibold text-ink">
              {formatClock(flight.arriveISO)}
            </span>
          </div>

          <div className="flex items-end justify-between gap-3">
            <span className="text-sm text-muted">{flight.carrier ?? flight.listing.title}</span>
            <Price listing={flight.listing} size="sm" />
          </div>
        </div>
      </div>
    </DiffHighlight>
  );
}
