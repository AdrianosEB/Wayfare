import { cn } from '@/lib/cn';
import type { TripTrend } from '@/lib/content';

/**
 * Compact trending pill for the Explore card photo. A semi-opaque background + backdrop-blur
 * keep it legible over imagery. Kept short (status only) so it never collides with the
 * "from €X" price pill on the opposite corner.
 */
// Tone steps down the azure ramp with intensity (600 → 500 → neutral surface). Glyphs are
// aria-hidden; the accessible name comes from the aria-label below.
const TREND_META: Record<TripTrend, { glyph: string; label: TripTrend; tone: string }> = {
  Hot: { glyph: '🔥', label: 'Hot', tone: 'bg-azure-600/90 text-white' },
  Rising: { glyph: '↑', label: 'Rising', tone: 'bg-azure-500/85 text-white' },
  Steady: { glyph: '•', label: 'Steady', tone: 'bg-bg/90 text-ink' },
};

export function TrendingBadge({
  trending,
  className,
}: {
  trending: TripTrend;
  className?: string;
}) {
  const meta = TREND_META[trending];
  return (
    <span
      aria-label={`Trending: ${trending}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold leading-none',
        'shadow-card backdrop-blur',
        meta.tone,
        className,
      )}
    >
      <span aria-hidden>{meta.glyph}</span>
      <span>{meta.label}</span>
    </span>
  );
}
