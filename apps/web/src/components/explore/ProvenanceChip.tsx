import { cn } from '@/lib/cn';

/**
 * Price-provenance chip for the Explore cards — the trust surface.
 *
 * Mirrors SourceChip's LOOK (rounded-full border, bg-surface-2/70, 11px muted text, a small
 * dot) but is a plain string-based chip: it renders `${source} · ${freshness}` VERBATIM and
 * is not bound to a Listing. Today that's "Estimated · Updated this week"; the same chip flips
 * to "Amadeus · 2h ago" later with zero changes. We NEVER hardcode the word "mock" — the
 * strings come straight from the data.
 *
 * Unlike SourceChip this is presentational only: no popover, no Listing binding, no interaction.
 * The Explore card is itself the click target, so a nested interactive chip would swallow taps
 * and duplicate the accessible action — hence the plain <span>.
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
      {/* Fixed `estimate` dot token: these Explore cards are all estimates today, so — unlike
          SourceChip, which derives the dot color from a live `freshness` enum — the tint is
          constant here. The freshness *text* still comes from the data, not this class. */}
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-estimate ring-2 ring-estimate/30" />
      {/* truncate + max-w-full let a long "Amadeus · 2h ago" ellipsize inside a tight card rather
          than pushing the card wider. */}
      <span className="truncate">
        {source} <span className="text-faint">· {freshness}</span>
      </span>
    </span>
  );
}
