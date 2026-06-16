import type { Listing } from '@/types';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import { SourceChip } from './SourceChip';

/**
 * A price + its provenance, always together. The amount uses tabular figures; the
 * SourceChip carries source + freshness. The combined SR label reads them as one unit
 * ("€620, Estimated price") per the a11y target in DESIGN_SYSTEM.md.
 */
export interface PriceProps {
  listing: Listing;
  size?: 'sm' | 'md' | 'lg';
  align?: 'start' | 'end';
  className?: string;
}

const sizeMap = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
} as const;

export function Price({ listing, size = 'md', align = 'end', className }: PriceProps) {
  const label = formatMoney(listing.price);
  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        align === 'end' ? 'items-end' : 'items-start',
        className,
      )}
    >
      <span
        className={cn('tabular font-semibold text-ink', sizeMap[size])}
        aria-label={`${label}, ${listing.source.label}`}
      >
        {label}
      </span>
      <SourceChip listing={listing} priceLabel={label} />
    </div>
  );
}
