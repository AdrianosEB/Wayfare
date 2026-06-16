import type { SVGProps } from 'react';

/**
 * Minimal line-icon set (no icon dependency). Stroke = currentColor so icons inherit text
 * color and theme automatically. Sizing via className (default 1em square).
 */
type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: '1em',
    height: '1em',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...props,
  };
}

export const SendIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4.5 12 20 4l-4 16-4.5-6.5L4.5 12Z" />
  </svg>
);

export const PlaneIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M10.5 19.5 12 22l1.5-2.5V15l7 3v-2.2l-7-4.8V5a1.5 1.5 0 0 0-3 0v6l-7 4.8V18l7-3v4.5Z" />
  </svg>
);

export const BedIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 18V8m0 4h18m0 6v-5a3 3 0 0 0-3-3H7m-4 8h18" />
    <path d="M7 11V9a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
  </svg>
);

export const WalkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12.5" cy="4.5" r="1.6" />
    <path d="M11 21l1.4-5L10 13V9.5l3-1 2 2.5 2 1M10.5 21l-1-4" />
  </svg>
);

export const InfoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5m0-8.5h.01" />
  </svg>
);

export const SparkleIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11 12 16l-1.8-5L5.5 9.5l4.7-1.8L12 3Z" />
    <path d="M19 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7L19 14Z" />
  </svg>
);

export const SunIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2m0 16v2M4 12H2m20 0h-2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19" />
  </svg>
);

export const MoonIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5 12.5 4.5 4.5L19 6.5" />
  </svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const TagIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 12.5V5a2 2 0 0 1 2-2h7.5L21 11.5 13.5 19 3 12.5Z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </svg>
);

export const MapPinIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const FerryIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 17c1.5 1 2.5 1 4 0s2.5-1 4 0 2.5 1 4 0 2.5-1 4 0" />
    <path d="M4 14l1.6-4.2a1 1 0 0 1 .94-.65H17.4a1 1 0 0 1 .94.65L20 14M12 9V5m-3 0h6" />
  </svg>
);

export const ActivityIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 12h4l2 6 4-12 2 6h6" />
  </svg>
);

export const FreeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 13.5s1 1.5 3.5 1.5 3.5-1.5 3.5-1.5M9 9.5h.01M15 9.5h.01" />
  </svg>
);

export const MealIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 3v8a2 2 0 0 0 4 0V3M7 11v10M17 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4m0 0v9" />
  </svg>
);

export const XIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const MinusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);

export const ArrowRightIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </svg>
);

export const StarIcon = (p: IconProps) => (
  <svg {...base({ ...p, fill: 'currentColor', stroke: 'none' })}>
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.9 6.8 19.7l1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
  </svg>
);
