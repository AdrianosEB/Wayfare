import { cn } from '@/lib/cn';

/**
 * ExploreBackdrop — a purely decorative background layer for the TOP of the `/explore` page
 * (hero + stats). It warms the otherwise stark-white page with a gentle azure glow that melts
 * into the page background further down.
 *
 * Usage: place as the FIRST child of a `position: relative; overflow: hidden` container. The root
 * is `absolute inset-0`, so it fills that parent and sits behind content (`-z-10`).
 *
 * Design-system notes:
 * - VISIBLE BY DEFAULT — no opacity-from-0 entrance gating, no animation. Static by design.
 * - Azure/white tokens only (azure-50/100/200). `aria-hidden` + `pointer-events-none`: it never
 *   receives focus, a11y tree entries, or clicks.
 * - NO horizontal bleed. Every element is horizontally constrained (`inset-x-0` / `left-*` /
 *   `left-1/2 -translate-x-1/2`) and the root's `overflow-hidden` clips any blob that reaches an
 *   edge, so this layer can never widen the page. (An earlier decorative glow using negative
 *   horizontal insets caused a mobile scrollbar — hence the strict rule.)
 */
export function ExploreBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        className,
      )}
    >
      {/* Vertical wash: a clear azure tint at the very top fading to transparent (the page's white)
          lower down, so the top carries a real glow and melts into the background. */}
      <div className="absolute inset-x-0 top-0 h-[46rem] bg-gradient-to-b from-azure-200 via-azure-100/60 to-transparent" />

      {/* Soft brand-azure glows for a clearly-visible-but-gentle wash (heavy blur + low opacity =
          the "gradient glow" look, on-brand for sky-azure). Positioned in the VISIBLE hero band
          (below the solid nav). All horizontally constrained; any bleed is clipped by the root's
          overflow-hidden. */}
      <div className="absolute top-4 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-azure-400/35 blur-3xl" />
      <div className="absolute top-10 right-0 h-[26rem] w-[26rem] rounded-full bg-azure-500/25 blur-3xl" />
      <div className="absolute left-0 top-44 h-96 w-96 rounded-full bg-azure-400/30 blur-3xl" />
    </div>
  );
}
