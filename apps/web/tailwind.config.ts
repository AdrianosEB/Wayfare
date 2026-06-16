import type { Config } from 'tailwindcss';

/**
 * Wayfare azure design tokens — docs/design/TOKENS.md.
 *
 * White-dominant, bright sky-azure (#2F80ED) used with intent. Light theme only.
 * Colors reference RGB-channel CSS variables (index.css) via `rgb(var(--x) / <alpha-value>)`
 * so every token supports Tailwind opacity modifiers (`bg-azure-500/10`).
 *
 * Canonical names come straight from TOKENS.md. Legacy aliases (sand/primary/accent/muted/
 * faint/ontarget + *-soft) re-point the older planner styles onto the azure palette, so the
 * existing app re-skins with no churn. Prefer the canonical names in new code.
 */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---- canonical (TOKENS.md) ----
        bg: rgb('--bg'),
        surface: { DEFAULT: rgb('--surface'), 2: rgb('--surface-2') },
        border: rgb('--border'),
        scrim: rgb('--scrim'),
        ink: { DEFAULT: rgb('--ink'), 2: rgb('--ink-2'), 3: rgb('--ink-3') },
        azure: {
          50: rgb('--azure-50'),
          100: rgb('--azure-100'),
          200: rgb('--azure-200'),
          400: rgb('--azure-400'),
          500: rgb('--azure-500'),
          600: rgb('--azure-600'),
          700: rgb('--azure-700'),
          ring: rgb('--azure-ring'),
        },
        under: rgb('--under'),
        'on-target': rgb('--on-target'),
        over: rgb('--over'),
        live: rgb('--live'),
        estimate: rgb('--estimate'),

        // ---- legacy aliases → azure palette (re-skin without churn) ----
        sand: rgb('--bg'),
        'surface-2': rgb('--surface-2'),
        muted: rgb('--ink-2'),
        faint: rgb('--ink-3'),
        primary: rgb('--azure-500'),
        'primary-fg': rgb('--bg'),
        'primary-soft': rgb('--azure-50'),
        accent: rgb('--azure-500'),
        'accent-soft': rgb('--azure-50'),
        ontarget: rgb('--on-target'),
        'under-soft': rgb('--under-soft'),
        'ontarget-soft': rgb('--on-target-soft'),
        'over-soft': rgb('--over-soft'),
      },
      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        display: ['General Sans', 'Inter var', 'Inter', 'sans-serif'],
      },
      fontSize: {
        // hero / display headline — clamps 40 → 64
        display: ['clamp(2.5rem, 6vw, 4rem)', { lineHeight: '1.05', fontWeight: '600' }],
      },
      borderRadius: {
        sm: '10px',
        md: '16px',
        lg: '24px',
        pill: '999px',
        // legacy
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px rgb(15 23 42 / 0.06)',
        float: '0 12px 40px rgb(15 23 42 / 0.12)',
        // legacy alias
        lift: '0 12px 40px rgb(15 23 42 / 0.12)',
      },
      maxWidth: {
        site: '1200px',
        app: '1320px',
        prose: '680px',
      },
      keyframes: {
        'caret-blink': {
          '0%,70%,100%': { opacity: '1' },
          '20%,50%': { opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'caret-blink': 'caret-blink 1.1s steps(1) infinite',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
