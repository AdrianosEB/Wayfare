import type { Config } from 'tailwindcss';

/**
 * Wayfare visual language (see docs/DESIGN_SYSTEM.md):
 * warm "golden-hour travel" — sand background, deep ink text, a confident sea/teal for
 * actions, a sunset coral/amber accent for savings & "changed" markers, and calm semantic
 * green/amber/red for budget state. Dark mode from day one.
 *
 * Colors are CSS variables (RGB channel triples in index.css) so every token themes
 * automatically and supports Tailwind opacity modifiers (`bg-primary/10`).
 */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // surfaces
        sand: rgb('--c-sand'),
        surface: rgb('--c-surface'),
        'surface-2': rgb('--c-surface-2'),
        border: rgb('--c-border'),
        // text
        ink: rgb('--c-ink'),
        muted: rgb('--c-muted'),
        faint: rgb('--c-faint'),
        // brand
        primary: rgb('--c-primary'),
        'primary-fg': rgb('--c-primary-fg'),
        'primary-soft': rgb('--c-primary-soft'),
        accent: rgb('--c-accent'),
        'accent-soft': rgb('--c-accent-soft'),
        // semantic budget state
        under: rgb('--c-under'),
        'under-soft': rgb('--c-under-soft'),
        ontarget: rgb('--c-ontarget'),
        'ontarget-soft': rgb('--c-ontarget-soft'),
        over: rgb('--c-over'),
        'over-soft': rgb('--c-over-soft'),
      },
      borderRadius: {
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--c-shadow) / 0.04), 0 8px 24px -12px rgb(var(--c-shadow) / 0.18)',
        lift: '0 2px 6px rgb(var(--c-shadow) / 0.06), 0 18px 40px -16px rgb(var(--c-shadow) / 0.28)',
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
      },
      keyframes: {
        'caret-blink': {
          '0%,70%,100%': { opacity: '1' },
          '20%,50%': { opacity: '0' },
        },
      },
      animation: {
        'caret-blink': 'caret-blink 1.1s steps(1) infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
