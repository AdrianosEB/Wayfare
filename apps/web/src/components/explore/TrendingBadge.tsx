import { cn } from '@/lib/cn';
import type { TripTrend } from '@/lib/content';

/**
 * Trending pill for the Explore card photo — must stay legible over imagery, so it uses a
 * semi-opaque background + backdrop-blur like the price pill in PricingPage.
 *
 * 'Hot' reads strongest (filled azure), 'Rising' a lighter azure, 'Steady' a neutral surface.
 * The "planned this week" social-proof count rides along as muted adjacent text. Visible by
 * default — no entrance animation.
 */
const TREND_META: Record<TripTrend, { glyph: string; label: TripTrend; tone: string }> = {
  Hot: { glyph: '🔥', label: 'Hot', tone: 'bg-azure-600/90 text-white' },
  Rising: { glyph: '↑', label: 'Rising', tone: 'bg-azure-500/85 text-white' },
  Steady: { glyph: '•', label: 'Steady', tone: 'bg-bg/90 text-ink' },
};

export function TrendingBadge({
  trending,
  plannedThisWeek,
  className,
}: {
  trending: TripTrend;
  plannedThisWeek: number;
  className?: string;
}) {
  const meta = TREND_META[trending];
  return (
    <span
      aria-label={`Trending: ${trending}, planned ${plannedThisWeek} times this week`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold leading-none',
        'shadow-card backdrop-blur',
        meta.tone,
        className,
      )}
    >
      <span aria-hidden>{meta.glyph}</span>
      <span>{meta.label}</span>
      <span
        className={cn(
          'tabular font-medium',
          trending === 'Steady' ? 'text-ink-3' : 'text-white/80',
        )}
      >
        · {plannedThisWeek} planned this week
      </span>
    </span>
  );
}
