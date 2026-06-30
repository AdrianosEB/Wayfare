import { cn } from '@/lib/cn';

/**
 * Price-provenance chip for the Explore cards — the trust surface.
 *
 * Mirrors SourceChip's LOOK (rounded-full border, bg-surface-2/70, 11px muted text, a small
 * dot) but is a plain string-based chip: it renders `${source} · ${freshness}` VERBATIM and
 * is not bound to a Listing. Today that's "Estimated · Updated this week"; the same chip flips
 * to "Amadeus · 2h ago" later with zero changes. We NEVER hardcode the word "mock" — the
 * strings come straight from the data.
 */
export function ProvenanceChip({
  source,
  freshness,
  className,
}: {
  source: string;
  freshness: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border',
        'bg-surface-2/70 px-2 py-0.5 text-[11px] font-medium leading-none text-muted',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-estimate ring-2 ring-estimate/30" />
      <span className="truncate">
        {source} <span className="text-faint">· {freshness}</span>
      </span>
    </span>
  );
}
