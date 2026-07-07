import { cn } from '@/lib/cn';

/**
 * ExploreRouteMotif — a purely decorative "flight route" accent for the `/explore` page.
 * A few gentle great-circle-style arcs drawn as thin DASHED azure lines, with small
 * "location" dots at their endpoints. Abstract and barely-there — evoking a map's flight
 * lines, not a literal map. Intended to sit very subtly behind a section (e.g. the closing
 * CTA band).
 *
 * Usage: place inside a `position: relative` (usually `overflow-hidden`) container and let the
 * caller own size + color + opacity, e.g.:
 *   <ExploreRouteMotif className="absolute inset-0 h-full w-full text-azure-200 opacity-60" />
 * The svg fills its box via `preserveAspectRatio="xMidYMid slice"` and carries NO fixed pixel
 * width/height, so it scales to whatever the caller's className dictates and never causes overflow.
 *
 * Design-system notes:
 * - VISIBLE BY DEFAULT — no opacity-from-0 entrance gating, no animation. Static by design.
 * - Color comes from `currentColor`, so the caller sets it with a text-azure-* class
 *   (azure-200 recommended). Dots use a slightly stronger azure via per-element opacity.
 * - `aria-hidden` + `focusable="false"` + `pointer-events-none`: never focusable, never in the
 *   a11y tree, never intercepts clicks. Azure/white tokens only (no azure-300).
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
      {/* Arcing "flight routes": thin, dashed, low-opacity lines that gently curve like
          great-circle paths. Colors inherit from currentColor (caller's text-azure-*). */}
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

      {/* "Location" dots at the route endpoints — slightly stronger azure than the lines. */}
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
