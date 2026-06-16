import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { Listing } from '@/types';
import { cn } from '@/lib/cn';
import { freshnessNote } from '@/lib/format';

/**
 * The price-provenance badge — Wayfare's trust surface. It renders ENTIRELY from
 * `listing.source.label` + `listing.freshness` (+ `fetchedAt`), so the same component shows
 * "Estimated price" today and "Amadeus · 2h ago" later with zero changes. We never hardcode
 * the word "mock" — the dot color and explainer are derived from `freshness`, the visible
 * text from `source.label`.
 */

const freshnessMeta: Record<
  Listing['freshness'],
  { dot: string; ring: string; explain: string }
> = {
  live: {
    dot: 'bg-under',
    ring: 'ring-under/30',
    explain: 'Live price pulled just now from the provider.',
  },
  cached: {
    dot: 'bg-ontarget',
    ring: 'ring-ontarget/30',
    explain: 'A recently cached price — may have shifted slightly since it was fetched.',
  },
  estimate: {
    dot: 'bg-faint',
    ring: 'ring-faint/30',
    explain: 'An estimate to plan against — not a live, bookable quote yet.',
  },
  mock: {
    dot: 'bg-faint',
    ring: 'ring-faint/30',
    explain:
      'A sample price so you can plan now. It’ll be replaced by a live quote once providers are connected.',
  },
};

export interface SourceChipProps {
  listing: Listing;
  /** Screen-reader context, e.g. the formatted price, so SR reads "€620, Estimated price". */
  priceLabel?: string;
  className?: string;
}

export function SourceChip({ listing, priceLabel, className }: SourceChipProps) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const popId = useId();
  const meta = freshnessMeta[listing.freshness];
  const note = freshnessNote(listing.freshness, listing.fetchedAt);
  const srLabel = priceLabel
    ? `${priceLabel}, ${listing.source.label}`
    : `Price source: ${listing.source.label}`;

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-describedby={open ? popId : undefined}
        aria-label={`${srLabel}. What this means.`}
        className={cn(
          'group inline-flex max-w-full items-center gap-1.5 rounded-full border border-border',
          'bg-surface-2/70 px-2 py-0.5 text-[11px] font-medium leading-none text-muted',
          'ring-1 ring-inset ring-transparent transition hover:text-ink hover:ring-border',
          'focus-visible:ring-2',
        )}
      >
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full ring-2', meta.dot, meta.ring)} />
        <span className="truncate">{listing.source.label}</span>
        {note && <span className="tabular text-faint">· {note}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            id={popId}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className={cn(
              'absolute bottom-full left-0 z-30 mb-1.5 w-60 rounded-xl border border-border',
              'bg-surface p-3 text-left text-xs leading-relaxed text-muted shadow-lift',
            )}
          >
            <span className="mb-1 block font-semibold text-ink">{listing.source.label}</span>
            {meta.explain}
            {listing.source.url && (
              <span className="mt-1.5 block truncate text-[11px] text-faint">
                {listing.source.provider}
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
