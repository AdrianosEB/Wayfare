# Design Tokens

The single source of visual truth. Set this up **before** building components. White is the
dominant surface; **azure (`#2F80ED`) is used with intent** — primary actions, active/focus,
links, the budget highlight, brand marks. Never large azure fills.

## 1. CSS variables (drop into `apps/web/src/index.css`)

```css
:root {
  /* Base / surfaces — white dominant */
  --bg: #FFFFFF;
  --surface: #F7F9FC;
  --surface-2: #EEF3FA;
  --border: #E2E8F0;
  --scrim: rgba(15, 23, 42, 0.45);   /* over hero photos for legible text */

  /* Ink / text */
  --ink: #0F172A;
  --ink-2: #475569;
  --ink-3: #94A3B8;

  /* Azure accent scale */
  --azure-50: #EAF2FE;
  --azure-100: #D6E6FD;
  --azure-200: #AFCFFB;
  --azure-400: #5C9CF0;
  --azure-500: #2F80ED;   /* PRIMARY */
  --azure-600: #1E6FE0;   /* hover / pressed */
  --azure-700: #1A5FBF;   /* emphasis text on light */
  --azure-ring: rgba(47, 128, 237, 0.35);

  /* Semantic — budget state (sparingly) */
  --under: #16A34A;       /* under budget */
  --on-target: #2F80ED;   /* on target (stays on-brand azure) */
  --over: #E0533D;        /* over budget — warm red, calm not alarmist */

  /* Source / freshness */
  --live: #16A34A;        /* live price */
  --estimate: #94A3B8;    /* mock / estimate (neutral, honest) */

  /* Elevation */
  --shadow-card: 0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06);
  --shadow-float: 0 12px 40px rgba(15,23,42,.12);

  /* Radius */
  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 999px;
}
```

## 2. Tailwind config (extend in `apps/web/tailwind.config.ts`)

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        border: "var(--border)",
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        azure: {
          50: "var(--azure-50)", 100: "var(--azure-100)", 200: "var(--azure-200)",
          400: "var(--azure-400)", 500: "var(--azure-500)", 600: "var(--azure-600)",
          700: "var(--azure-700)",
        },
        under: "var(--under)", "on-target": "var(--on-target)", over: "var(--over)",
        live: "var(--live)", estimate: "var(--estimate)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["General Sans", "Inter", "sans-serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      boxShadow: { card: "var(--shadow-card)", float: "var(--shadow-float)" },
      maxWidth: { site: "1200px", app: "1320px", prose: "680px" },
    },
  },
  plugins: [],
} satisfies Config;
```

## 3. Typography scale

Use `font-display` for headings, `font-sans` for body. **Tabular figures on every price**
(`font-variant-numeric: tabular-nums`; expose a `.tnum` utility).

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `display` | 64 / 1.05 (clamp 40→64) | 600 | Hero headline |
| `h1` | 40 / 1.1 | 600 | Page titles |
| `h2` | 30 / 1.2 | 600 | Section headers |
| `h3` | 22 / 1.3 | 600 | Card titles |
| `body` | 16 / 1.6 | 400 | Default |
| `sm` | 14 / 1.5 | 400/500 | Secondary, chips |
| `xs` | 12 / 1.4 | 500 | Captions, source chips |

**Fonts:** load Inter + General Sans via `@fontsource` (preferred, self-hosted) or Fontshare
(General Sans) + Google (Inter). Preload the display weight to avoid hero FOUT.

## 4. Buttons (the azure system)

| Variant | Fill | Text | Hover | Use |
|---|---|---|---|---|
| **Primary** | `azure-500` | white | `azure-600` | "Plan my trip", "Plan it", send |
| **Secondary** | white, `border` | `ink` | `surface` | secondary actions |
| **Ghost** | transparent | `azure-700` | `azure-50` | inline / nav links |
| **Pill/Chip** | `azure-50` | `azure-700` | `azure-100` | example prompts, quick refine, saving hints |

Radius: `pill` for chips/CTAs, `md` for blocky buttons. Height: 44px default (touch-safe),
52px for hero CTA. Disabled: 40% opacity, no shadow.

## 5. Focus, elevation, layout

- **Focus ring (always visible, keyboard):** `0 0 0 3px var(--azure-ring)` + 1px `azure-500`
  border. Never remove outlines without replacing them.
- **Cards:** `bg-surface` or white, `rounded-lg`, `shadow-card`, 1px `border` optional.
  Hover lift: translateY(-2px) + `shadow-float` (use sparingly, e.g. TripCard).
- **Z-index scale:** base 0 · sticky nav 30 · budget sticky bar (mobile) 40 · dropdowns 50 ·
  modals 60 · toasts 70.
- **Container widths:** marketing `max-w-site` (1200px); app shell `max-w-app` (1320px);
  prose/chat column `max-w-prose` (680px).
- **Grid:** 4px base spacing. Section vertical rhythm: 96px desktop / 64px mobile between
  landing sections.

## 6. Usage rules (keep it "smooth & cool", not loud)

- White/`surface` is ~90% of any screen. Azure appears on **interactive + brand** elements
  only.
- One primary azure CTA per view. Don't stack azure buttons.
- Photography carries color/warmth; the UI chrome stays cool white + azure.
- Prices are always `tnum`; source/freshness chip sits with every price (see SourceChip in
  COMPONENTS.md).
- Generous whitespace > dividers. Prefer space and soft shadows over hard lines.
