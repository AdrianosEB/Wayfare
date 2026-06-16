# Motion

Calm, purposeful motion via **Framer Motion**. Define these variants once in
`apps/web/src/lib/motion.ts` and reuse — don't hand-roll per component. All motion respects
`prefers-reduced-motion` (see §5).

## Principles

- **Reveal, don't bounce.** Content eases in as the agent works. No springy overshoot on UI
  chrome.
- **Standard easing:** `[0.22, 1, 0.36, 1]` (ease-out-quint-ish). Standard duration 220ms;
  larger reveals 400–600ms.
- **Stagger to show thinking.** Itinerary items and cards stagger in 60ms apart.
- **Highlight change.** Refined items pulse an azure outline once, then settle.

## Variant catalogue (`lib/motion.ts`)

```ts
export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeIn = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
};

export const staggerIn = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

// child of a staggerIn container (cards, itinerary items, question cards)
export const staggerChild = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};

// budget bar / progress growth
export const growBar = (pct: number) => ({
  initial: { width: 0 },
  animate: { width: `${pct}%`, transition: { duration: 0.6, ease: EASE } },
});

// a refined/changed item: pulse an azure ring once
export const pulseChanged = {
  initial: { boxShadow: "0 0 0 0 rgba(47,128,237,0)" },
  animate: {
    boxShadow: [
      "0 0 0 0 rgba(47,128,237,0.0)",
      "0 0 0 4px rgba(47,128,237,0.35)",
      "0 0 0 0 rgba(47,128,237,0.0)",
    ],
    transition: { duration: 1.1, ease: EASE },
  },
};

// agent status line: typing-style reveal
export const statusLine = {
  hidden: { opacity: 0, x: -6 },
  show: { opacity: 1, x: 0, transition: { duration: 0.2, ease: EASE } },
};

// skeleton shimmer (use a CSS keyframe instead if simpler)
export const shimmer = {
  animate: { backgroundPositionX: ["-200%", "200%"], transition: { duration: 1.4, repeat: Infinity, ease: "linear" } },
};

// hero TripCard hover lift
export const cardHover = { whileHover: { y: -2 }, transition: { duration: 0.18, ease: EASE } };

// modal / sheet
export const sheet = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
  exit: { opacity: 0, y: 24, transition: { duration: 0.2 } },
};
```

## Where each is used

| Variant | Used by |
|---|---|
| `fadeIn` | message bubbles, section reveals on scroll |
| `staggerIn` + `staggerChild` | TripCard rows, ValueCard grid, QuestionCardStack, DayTimeline items, itinerary blocks filling in |
| `growBar` | BudgetBar, BudgetLineRow proportions |
| `pulseChanged` | items in a refinement `diff` (ChangedBadge / DiffHighlight) |
| `statusLine` | AgentStatusLine during streaming |
| `shimmer` | skeletons in the streaming/loading state |
| `cardHover` | TripCard, StayCard hover |
| `sheet` | mobile budget expand, any modal/drawer |

## Streaming choreography (the signature moment)

When a plan streams in (SSE `status`/`partial` → `complete`):
1. Status lines appear one at a time with `statusLine` (newest at bottom).
2. As each `partial` patch lands, the matching block (flights → stay → days) swaps skeleton
   → content with `staggerChild`.
3. The BudgetBar `growBar`s toward the running total; the headline number counts up
   (animate the value, `tnum`).
4. On `complete`, everything settles; any late items finish their stagger.

Keep it under ~15s perceived (NFR-1); motion fills the wait so it never feels frozen.

## Reduced motion (required)

Wrap usage so `prefers-reduced-motion: reduce` collapses transforms to simple opacity
fades and disables loops:

```ts
import { useReducedMotion } from "framer-motion";
const reduce = useReducedMotion();
// when reduce: skip y/x offsets and repeats; keep opacity 0→1 only.
```

- No `pulseChanged` loop, no `shimmer`, no count-up under reduced motion — show final state
  with a 120ms opacity fade. Changed items get a static azure outline instead of a pulse.
