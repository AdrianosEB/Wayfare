import { cn } from '@/lib/cn';
import type { TripTrend } from '@/lib/content';

/**
 * Compact trending pill for the Explore card photo — must stay legible over imagery, so it
 * uses a semi-opaque background + backdrop-blur like the price pill in PricingPage. Kept short
 * (status only) so it never collides with the "from €X" price pill on the opposite corner; the
 * "planned this week" social-proof count lives in the card body instead.
 *
 * 'Hot' reads strongest (filled azure), 'Rising' a lighter azure, 'Steady' a neutral surface.
 * Visible by default — no entrance animation.
 */
// Tone steps down the azure ramp with intensity (600 → 500 → neutral surface). The /90–/85
// alpha keeps each background semi-opaque so the backdrop-blur reads over any photo while the
// hue still shows through. Glyphs are aria-hidden decoration — the accessible name comes from
// the aria-label below, so the raw emoji/arrow never reaches a screen reader.
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
