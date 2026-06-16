# Wayfare Design Package (frontend implementation spec)

This folder is the **implementation-ready** design spec for the Wayfare frontend. It turns
the high-level [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) into concrete tokens, component specs,
screen layouts, copy, and motion that the `frontend` session can build directly in
`apps/web` — no design guesswork required.

**Look & feel:** smooth, cool, **white-dominant with bright sky-azure (`#2F80ED`)**,
photo-rich, modeled on [layla.ai](https://layla.ai). Friendly travel sidekick, not a
spreadsheet.

## Read in this order

1. **[TOKENS.md](./TOKENS.md)** — colors, type, spacing, radius, shadow, z-index, focus, and
   a drop-in Tailwind config + CSS variables. **Set this up first.**
2. **[MOTION.md](./MOTION.md)** — the Framer Motion variant catalogue (shared animation
   presets). Wire these once, reuse everywhere.
3. **[COMPONENTS.md](./COMPONENTS.md)** — the component library: props, states, variants,
   visual specs, a11y. Build bottom-up from here.
4. **[SCREENS.md](./SCREENS.md)** — the app shell + each planner screen, with states and how
   they bind to the API.
5. **[LANDING_PAGE.md](./LANDING_PAGE.md)** — the marketing landing page, section by section,
   with the full copy deck.
6. **[CONTENT_VOICE.md](./CONTENT_VOICE.md)** — voice, microcopy, example prompts, trip-type
   presets, FAQ, and all error/empty-state copy.

## Authoritative inputs (don't re-derive these)

- **Wire/data shapes:** [../API_CONTRACT.md](../API_CONTRACT.md) + `@wayfare/shared` types.
  Components render `Trip`/`Listing`/`Budget` etc. — never invent fields.
- **Sample data to build against:** [../fixtures/](../fixtures) (byte-identical to what the
  server emits). Build screens against these via the existing MSW mocks in
  `apps/web/src/mocks`.
- **Flows & questions:** [../CONVERSATION_FLOW.md](../CONVERSATION_FLOW.md).

## Tech (already chosen, in `apps/web`)

React + Vite + TypeScript + Tailwind + Framer Motion. State: React Query (server/stream),
Zustand (local UI). Mock data via MSW. No new frameworks.

## Scope of this pass

**Purely frontend.** Build the marketing landing page + the in-app planner UI, fully wired
to the **mock** API (no backend changes). Every price renders its source/freshness from data
(MVP = "Estimated"). Features tagged `v1`/`later` in DESIGN_SYSTEM §3 are **out of scope for
this pass** — design the components to accept them, but don't build flows that need real
providers.

## Definition of done (this pass)

- Azure token system + fonts wired into Tailwind; light theme only.
- Landing page renders all sections per LANDING_PAGE.md, responsive, photo-rich.
- Planner: prompt entry → clarifying cards → streaming → itinerary + budget → refine chat,
  all working against the MSW fixtures.
- Components match COMPONENTS.md (states + a11y); motion uses the MOTION.md variants.
- `pnpm --filter web dev` runs; `pnpm --filter web build` + `typecheck` pass.
