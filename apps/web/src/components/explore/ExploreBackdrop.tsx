import { cn } from '@/lib/cn';

/**
 * Decorative background for the top of the `/explore` page (hero + stats). Place as the first
 * child of a `position: relative; overflow: hidden` container.
 *
 * Static, and every element is horizontally constrained: an earlier glow with negative
 * horizontal insets caused a mobile scrollbar.
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
      {/* Vertical wash: azure at the top, fading to transparent lower down. */}
      <div className="absolute inset-x-0 top-0 h-[46rem] bg-gradient-to-b from-azure-200 via-azure-100/60 to-transparent" />

      {/* Soft azure glows (heavy blur + low opacity) in the hero band below the nav. */}
      <div className="absolute top-4 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-azure-400/35 blur-3xl" />
      <div className="absolute top-10 right-0 h-[26rem] w-[26rem] rounded-full bg-azure-500/25 blur-3xl" />
      <div className="absolute left-0 top-44 h-96 w-96 rounded-full bg-azure-400/30 blur-3xl" />
    </div>
  );
}
