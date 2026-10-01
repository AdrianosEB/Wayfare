import { cn } from '@/lib/cn';

/**
 * Price-provenance chip for the Explore cards. Looks like SourceChip but renders
 * `${source} · ${freshness}` verbatim from the data and is not bound to a Listing. Never
 * hardcode the word "mock".
 *
 * A plain <span> with no popover: the Explore card is itself the click target, so a nested
 * interactive chip would swallow taps.
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
      {/* Fixed `estimate` dot: these cards are all estimates today, so unlike SourceChip the
          tint is constant. The freshness text still comes from the data. */}
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-estimate ring-2 ring-estimate/30" />
      {/* truncate + max-w-full let a long label ellipsize instead of widening the card. */}
      <span className="truncate">
        {source} <span className="text-faint">· {freshness}</span>
      </span>
    </span>
  );
}
