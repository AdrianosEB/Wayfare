import type { Stay } from '@/types';
import { formatDistance, humanize } from '@/lib/format';
import { images } from '@/lib/images';
import { Photo } from './Photo';
import { Price } from './Price';
import { ChangedBadge, DiffHighlight } from './DiffHighlight';
import { BedIcon, MapPinIcon, StarIcon, WalkIcon } from './icons';

/**
 * The stay card: name, type, rating, key amenities, distance-to-focus ("120 m to beach"),
 * nights, and price + source chip.
 */
export function StayCard({
  stay,
  changed,
  focused,
  pulseKey,
}: {
  stay: Stay;
  changed?: boolean;
  focused?: boolean;
  pulseKey?: string | number;
}) {
  return (
    <DiffHighlight changed={!!changed} focused={focused} pulseKey={pulseKey}>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <Photo
          image={images.for(stay.location?.name ?? stay.type)}
          imageKey={stay.name}
          alt={stay.name}
          ratio="aspect-[16/9]"
        />
        <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <BedIcon className="text-lg" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-semibold text-ink">{stay.name}</h4>
              {changed && <ChangedBadge />}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="capitalize">{humanize(stay.type)}</span>
              {typeof stay.rating === 'number' && (
                <span className="inline-flex items-center gap-1">
                  <StarIcon className="text-[12px] text-ontarget" />
                  <span className="tabular">{stay.rating.toFixed(1)}</span>
                </span>
              )}
              <span className="tabular">
                {stay.nights} night{stay.nights === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <Price listing={stay.listing} size="sm" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {stay.distanceToFocus && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary">
              <WalkIcon className="text-[13px]" />
              {formatDistance(stay.distanceToFocus.meters)} {stay.distanceToFocus.label}
            </span>
          )}
          {stay.location.name && (
            <span className="inline-flex items-center gap-1 text-xs text-faint">
              <MapPinIcon className="text-[13px]" />
              {stay.location.name}
            </span>
          )}
          {stay.amenities?.slice(0, 4).map((a) => (
            <span
              key={a}
              className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted"
            >
              {humanize(a)}
            </span>
          ))}
        </div>
        </div>
      </div>
    </DiffHighlight>
  );
}
