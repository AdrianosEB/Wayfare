import { cn } from '@/lib/cn';

/**
 * Decorative "flight route" accent for the `/explore` page: a few dashed arcs with dots at
 * their endpoints. The caller owns size, color (via `currentColor`) and opacity, e.g.:
 *   <ExploreRouteMotif className="absolute inset-0 h-full w-full text-azure-200 opacity-60" />
 */
export function ExploreRouteMotif({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      className={cn('pointer-events-none', className)}
      viewBox="0 0 800 300"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Dashed arcs. Color inherits from currentColor. */}
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth={1.5}
      >
        <path d="M70 210 Q 300 40 470 130" strokeDasharray="2 9" opacity={0.55} />
        <path d="M470 130 Q 620 190 740 90" strokeDasharray="2 9" opacity={0.45} />
        <path d="M120 90 Q 380 260 660 220" strokeDasharray="2 9" opacity={0.4} />
        <path d="M250 250 Q 430 150 560 250" strokeDasharray="2 9" opacity={0.35} />
      </g>

      {/* Dots at the route endpoints, slightly stronger azure than the lines. */}
      <g fill="currentColor" opacity={0.75}>
        <circle cx={70} cy={210} r={3.5} />
        <circle cx={470} cy={130} r={4} />
        <circle cx={740} cy={90} r={3.5} />
        <circle cx={120} cy={90} r={3.5} />
        <circle cx={660} cy={220} r={3.5} />
        <circle cx={250} cy={250} r={3.5} />
        <circle cx={560} cy={250} r={3.5} />
      </g>
    </svg>
  );
}
