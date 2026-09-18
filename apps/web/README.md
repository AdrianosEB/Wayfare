# @wayfare/web

The chat-first web client for Wayfare: prompt → clarifying cards → streaming itinerary +
running budget → refine. React + Vite + Tailwind + Framer Motion + TypeScript, in a pnpm
workspace. See [`docs/FRONTEND_BRIEF.md`](../../docs/FRONTEND_BRIEF.md) and
[`docs/DESIGN_SYSTEM.md`](../../docs/DESIGN_SYSTEM.md).

## Run

```bash
pnpm install
pnpm --filter web dev   # http://localhost:5173
```

Dev defaults to **MSW fixture mocks** (no backend needed) — it replays
[`docs/fixtures/`](../../docs/fixtures). Point at the live API instead with:

```bash
VITE_USE_MOCKS=0 pnpm --filter web dev   # /api/* proxied → http://localhost:3000
```

MSW only mocks the endpoints the planner and auth use (`/api/session*`, `/api/auth/*`).
**`/agent` has no mock** — it talks to the real orchestration endpoints, so that tab needs
`pnpm dev:server` running and `VITE_USE_MOCKS=0`.

If something else already owns `:3000`, run the API elsewhere and repoint the proxy with
`API_TARGET` instead of editing `vite.config.ts`:

```bash
PORT=3100 pnpm dev:server
API_TARGET=http://localhost:3100 VITE_USE_MOCKS=0 pnpm --filter web dev
```

## /agent — the orchestration pipeline

`/agent` is the UI for the nine-agent verify-and-book pipeline in
[`packages/orchestrator`](../../packages/orchestrator), driven by
[`apps/server/src/routes/orchestrate.ts`](../../apps/server/src/routes/orchestrate.ts). The
backend had existed for a long time with no caller; this tab is that surface.

- `lib/orchestrate.ts` — `startOrchestration()` (POST, 202 `{ jobId }`) and
  `streamOrchestration()` (SSE `trace` … then `complete` | `error`). It carries its own SSE
  reader on purpose: `lib/sse.ts` is typed to the *planner's* event union, and widening it
  would loosen the types the working planner depends on.
- Progress wording is **not written here** — `labelFor()` in the route already maps each agent
  to a human sentence, so the page renders the server's vocabulary.
- Every staged step renders through the existing `<Price>` + `<SourceChip>`, so an amount never
  appears without its `source.label` ("Airline direct · sample"). That is `ListingSchema`'s
  transparency rule, and it is why the backend's sample prices cannot read as live quotes.
- **Nothing on this page books anything.** The booking agent emits intents with
  `status: "requires_approval"` and never executes them; the UI shows that status verbatim.

## Running the distilled student end to end

`training/` distils the persona agent into a local Qwen2.5-1.5B LoRA. Until now that model had
no runtime hookup — nothing in `apps/` or `packages/` could reach it. `LocalStructuredModel`
(`packages/orchestrator-llm/src/model.ts`) is that seam: any OpenAI-compatible server, selected
by `WAYFARE_LOCAL_MODEL_URL`, and no API key involved.

Three processes:

```bash
# 1. serve the student (Apple Silicon; needs a real GPU, not a headless session)
pnpm serve:student                 # mlx_lm.server on :8080 from training/fused-A

# 2. the API, with the persona agent pointed at it
PORT=3100 \
WAYFARE_LLM_ORCHESTRATOR=true \
WAYFARE_LLM_AGENTS=persona \
WAYFARE_LOCAL_MODEL_URL=http://localhost:8080 \
WAYFARE_LOCAL_MODEL="$PWD/training/fused-A" \
  pnpm dev:server

# 3. the web app, talking to the real API
API_TARGET=http://localhost:3100 VITE_USE_MOCKS=0 pnpm --filter web dev
```

Then open `/agent`. The bar under the headline names the runtime actually serving the agents,
and **Where the thinking happened** reports, per agent, whether it reached the model (with
tokens and wall time) or ran its deterministic implementation. `GET /api/health` carries the
same facts under `orchestrator`.

**Use `fused-A`, not `fused`.** They are different arms and it matters:

| model | schema-valid | note |
|---|---|---|
| `training/fused-A` | **100%** (20/20 measured here) | student-A — the production-usable arm |
| `training/fused-B` | 100% wire / **0% production** | omits `summary`, which `PersonaSchema` requires |
| `training/fused` | **0%** | emits `pace` as an array; behaves like the untuned base |

That is not a guess — `training/RESULTS.md` records the untuned base at 0.0% schema-valid, and
`training/smoke_test.py --model ./fused` fails on `preferences.pace is list, expected string`
while `--model ./fused-A` passes. Verify any arm before trusting it:

```bash
pnpm --filter @wayfare/orchestrator-llm eval:local-model 20   # through the real runtime path
cd training && ./.venv/bin/python verify_fuse.py --fused ./fused-A --adapters ./adapters-A
```

Only `persona` is distilled, so only `persona` belongs in `WAYFARE_LLM_AGENTS`. Pointing the
other agents at a 1.5B student trained on one task means their answers miss the schema and
`decide()` falls back anyway — the model panel would show them as deterministic, having spent
the latency to get there.

Nothing silently degrades into fiction: an off-schema answer raises `SchemaValidationError` and
that agent falls back to deterministic code, which the panel reports.

## How it's wired to stay swap-safe

- **Wire types** live behind one barrel: [`src/types`](./src/types/index.ts). It currently
  re-exports a local mirror ([`wire.ts`](./src/types/wire.ts)) of `packages/shared`. When
  the backend publishes the package, change that one line to
  `export * from '@wayfare/shared'` and delete `wire.ts`. Nothing else changes — every
  component imports from `@/types`.
- **All calls hit `/api`** ([`src/lib/api.ts`](./src/lib/api.ts)); the client holds no keys.
- **Streaming** uses `fetch` + `ReadableStream` (not `EventSource`, which is GET-only) and
  parses `event:`/`data:` frames in [`src/lib/sse.ts`](./src/lib/sse.ts), ignoring `:`
  heartbeats. `partial` patches are applied as RFC-7386 merge patches (arrays replace);
  `complete.trip` is authoritative.
- **Price provenance** is read from `Listing.source.label` + `Listing.freshness` in
  [`SourceChip`](./src/components/SourceChip.tsx) — the string "mock" is never hardcoded, so
  the same chip shows `Estimated price` now and `Amadeus · 2h ago` later.

## Scroll-scrubbed hero

The landing hero is a frame sequence drawn onto a `<canvas>`, advanced by scroll position —
the Apple-product-page effect. [`ScrollSequence`](./src/components/ScrollSequence.tsx) is
self-contained: give it a manifest and the overlay content, and it owns the canvas, the
loader, the pin, and every fallback path.

```tsx
<ScrollSequence manifest={HERO_SEQUENCE} className="h-svh">
  <h1>Real DOM, over the canvas</h1>
</ScrollSequence>
```

### Why not just scrub a `<video>`

Seeking a video element is asynchronous, quantised to keyframes, and throttled differently
in every engine. You get stutter and frame snapping that no amount of tuning fixes, because
you are asking a codec optimised for forward playback to do random access at input rate.
Pre-decoded stills drawn to a canvas are exact: frame *n* is always frame *n*.

### The pipeline

```bash
cd apps/web
pnpm frames path/to/source.mp4 --frames 150 --start 12 --duration 5 --width 1440
# flags: --frames --quality --width --start --duration
```

Needs `ffmpeg` with libwebp on PATH (`brew install ffmpeg`); the script preflights for it.
The source path is resolved against the current directory, everything else against the
script.

[`scripts/build-hero-frames.sh`](./scripts/build-hero-frames.sh) probes the source, thins it
to the target frame count, and emits WebP (with a JPEG fallback) at ~1920px and ~960px —
all from **one** ffmpeg pass. The filter graph decodes the video once and splits it four
ways (two scales × two codecs), so there is no huge intermediate PNG directory:

```
fps=N/duration,split=2[hi][lo];
[hi]scale=1920:-2:flags=lanczos,split=2[dw][dj];
[lo]scale=960:-2:flags=lanczos,split=2[mw][mj]
```

It writes the real frame count, dimensions, and byte totals to
[`src/lib/hero-manifest.json`](./src/lib/hero-manifest.json) — a generated file the
component imports, so nothing about the sequence is hardcoded in TypeScript. It then checks
the desktop WebP set against an 8MB budget and fails loudly with the two knobs to turn
(`--frames`, then `--quality`). Frames land in `public/hero/`, outside the bundler.

Until that script has been run the manifest reports `frames: 0` and the hero renders its
`fallback` — the destination photo it used before. The page never depends on the asset
existing.

The manifest also carries a `version` stamp that is appended to every frame and poster URL.
Frames live at stable paths under `public/`, and the loader fetches with
`cache: 'force-cache'` — so without the stamp, re-running the pipeline would leave returning
visitors on previously cached frames, potentially a *mix* of old and new. On a scrub that
reads as the footage glitching, which is a memorably confusing bug to chase.

### What it actually costs — measured

The current hero is a 4K Aegean drone clip (151 frames, a 5s window at 30fps, so a 1:1
frame mapping with no temporal resampling):

| Set | Dimensions | WebP | JPEG fallback |
|---|---|---|---|
| desktop | 1440×810 | **7.70 MB** (96% of budget) | 18.17 MB |
| mobile | 960×540 | 4.32 MB | 9.66 MB |

Note the width: **1440, not 1920.** Live-action water is close to incompressible — rippling
highlights are high-entropy detail, and WebP cannot find structure in them. Measured on this
clip at 1920px:

| Quality | KB/frame | 150 frames |
|---|---|---|
| q72 | 107.3 | 15.83 MB |
| q60 | 90.4 | 13.34 MB |
| q52 | 79.7 | 11.75 MB |
| q45 | 71.6 | 10.55 MB |

Dropping quality from 72 to 45 — well past the point where artefacts are visible on a still —
saves only 33%, and still misses an 8MB budget by 30%. **On detailed footage `--quality` buys
artefacts faster than it buys bytes.** Resolution is the lever that works: 1440px at q50 fits
150 full frames inside the budget, and on moving footage under a text scrim the difference
from 1920 is very hard to see. Graphic or low-detail source material behaves completely
differently and should stay at 1920.

### Scroll → frame

[`useScrollScrub`](./src/lib/useScrollScrub.ts) pins the section over
`innerHeight × viewports` of scroll and maps it to `0…1`:

```
index = clamp(round(progress × (N - 1)), 0, N - 1)
```

`round`, not `floor`: with `floor(p × (N-1))` the last frame only appears at exactly
`p === 1`, so the final frame effectively never renders. The pin range is a *function*
(`end: () => '+=' + innerHeight * viewports`) with `invalidateOnRefresh`, so it recomputes
on resize instead of baking in whichever viewport happened to load first.

Progress is produced by a dummy tween on a proxy object rather than read from
`ScrollTrigger.create({ onUpdate })`. This is the part worth knowing: `scrub` smoothing is a
property of a **tween** driven by a ScrollTrigger. A bare `ScrollTrigger.create` reports raw
`self.progress` and silently ignores any `scrub` you pass it, which is why hand-rolled
versions of this effect feel jittery on a trackpad.

### One render loop

A single `requestAnimationFrame` loop reads the latest progress from a ref and draws. Nothing
draws inside a scroll callback — input events fire far faster than the display refreshes, so
that would decode and discard frames nobody sees. The loop early-exits when the frame index
has not moved, and is gated on an `IntersectionObserver` so it is not running for the life of
the page.

That gate is *not* ScrollTrigger's active state, which was the subtlest bug here:
`onToggle` never fires for a trigger's **initial** state, and `isActive` is not reliably
populated during the first refresh. A hero pinned at the top of the page on first load
therefore reports nothing at all — the pin engages, progress advances, and the canvas never
repaints. Visibility is both simpler and exactly the condition under which drawing matters.

Cover-fit is done by hand in **device** pixels:

```
scale = max(cw/fw, ch/fh);  dx = (cw - fw*scale)/2
```

The canvas backing store is sized to `cssSize × min(dpr, 2)` and all arithmetic stays in that
one coordinate space. Using `ctx.scale(dpr, dpr)` with CSS-pixel maths introduces a second
space, and with it sub-pixel drift that shows up as a shimmering 1px seam during a scrub.

### Loading, and what never happens

[`useFrameSequence`](./src/lib/useFrameSequence.ts) loads frames through a bounded worker
pool (6 in flight) using `createImageBitmap`, which decodes off the main thread so a scrub
never pays decode cost on the frame it is trying to hit. Frames are claimed in **ascending**
order, so the decoded prefix is exactly what a visitor scrubbing forward consumes first.

- Decoded frames live in a **ref**, not state — decoding 150 frames causes zero re-renders
  for frame data. Only `decoded` / `ready` / `error` are state, and `decoded` is batched.
- The poster is a real `<img>` at high fetch priority, so the hero is never blank. It stays
  mounted *under* the canvas, which crossfades in on first successful draw. Both layers are
  `absolute inset-0` on the same box, so the handoff is structurally incapable of shifting
  layout.
- Scrubbing arms at 40% decoded, not ~100%. `nearest()` bridges frames still in flight, and
  an effect that briefly steps at the far end beats one that never arms at all.
- `ImageBitmap`s are explicitly `close()`d on unmount. They hold memory outside the JS heap
  that the GC will not reclaim for you, and 150 × 1920px frames is not a rounding error.

### Fallbacks

[`decideSequence()`](./src/lib/sequence.ts) runs once per visitor. Reduced motion, viewports
under 768px, `saveData`, `effectiveType` of 3g or worse, or under 4GB of device memory all
resolve to **static**: one poster frame, no pinning, no sequence downloaded, and the GSAP
chunk never even fetched. It is re-evaluated on `prefers-reduced-motion` changes but
deliberately *not* on resize — flipping a visitor from static to pinned mid-session would
move the page under them.

Two more guarantees:

- **Scroll is never trapped.** No `ScrollTrigger.normalizeScroll()`, which replaces native
  scrolling document-wide and takes keyboard paging, momentum, and assistive-tech scrolling
  with it. Pinning one section must not cost the document its native scroll.
- **Pinning is skipped if it would be disruptive.** `pinSpacing` injects ~2 viewports of
  height, so arming it while someone is already reading further down would yank that content
  downward. If the hero is not near the top when frames finish, the pin waits — and re-arms
  the moment the hero is back at the top, rather than giving up permanently.

The headline, subhead, prompt, and chips are ordinary DOM stacked over the canvas, never
baked into frames: selectable, translatable, and read in order by a screen reader. The canvas
itself is `aria-hidden`.

GSAP is dynamically imported (~46KB gzipped, a separate chunk) and warmed in parallel with
frame decoding, so the static path never pays for it. Pass `debug` to `ScrollSequence` for a
live readout of mode, decode progress, and scrub state; the drawn frame index is always
mirrored to `data-frame` on the canvas.

## /collection — chaptered scroll narrative

Six chapters on a near-black ground, booking reachable throughout. Route registered in
`App.tsx`; everything lives in [`src/components/collection`](./src/components/collection).

### Asset rule

Every photograph and every frame of video on this page is real. Nothing is generated, no
placeholder service is used, and no gradient or colour block stands in for a photo. A slot
with no real asset renders as a **declared gap** — an outlined box carrying
`data-missing-asset`, `data-subject`, `data-orientation` and `data-min-width` — so a missing
photo looks missing instead of being quietly papered over.

```bash
# Verifies every curated photo returns 200, then inlines a ~16px LQIP of each.
pnpm exec bash scripts/build-lqip.sh

# Cuts the page's loops from a source video: H.264, no audio track, WebP poster = frame one.
pnpm exec bash scripts/build-collection-video.sh <source.mp4>
```

Chapter V's large frame is a real photograph of the thing being priced — a terrace with an
Aegean view. A **planner screenshot would still be the stronger frame there**, because the
chapter's claim is about the product rather than the destination; if you can supply one
(landscape, min 1600px) it should replace `aegean_terrace`.

`build-lqip.sh` **fails the build** if any curated photo 404s. That check has already caught
two dead IDs (`krakow`, `museum`) that were silently falling through to a deterministic
fallback — which renders a real photograph of the wrong place, and so looks like working
code rather than a bug.

### The motion model

Each chapter is two viewports tall with a `position: sticky` stage inside. The stage locks to
the top and holds while the second viewport scrolls through, and one GSAP timeline is scrubbed
across that hold ([`useChapterReveal.ts`](./src/components/collection/useChapterReveal.ts)):

| Element | `data-reveal` | Motion | Position in timeline |
|---|---|---|---|
| Full-bleed photograph | `image` | scale **1.28 → 1** | 0 → 0.7 |
| Headline | `letter` / `word` / `line` | per-chapter, see below | 0.08 → ~0.73 |
| Standfirst | `body` | rise 8% + fade | 0.78 |
| Small frames | `step` | quiet fade + 6% drift | 0.84, 0.89, 0.94 |

Each chapter gets its **own** headline treatment and its own side of the stage, so the page
never plays the same trick twice running:

| Chapter | Style | Unit | Motion | Align |
|---|---|---|---|---|
| I The art of arriving | `rise` | letter | rise 30%, fade | left |
| II Choose a feeling | `words` | word | rise 40% + scale, slower | centre |
| III Islands and slow mornings | `slide` | letter | in from the margin, x 60% | right |
| IV Cities worth walking | `wipe` | line | rises from behind a clip, no fade | left |
| V Every price sourced and dated | `scatter` | letter | resolves in shuffled order, no travel | centre |
| VI Begin anywhere | `center-out` | letter | outward from the middle of the line | right |

Stagger spacing is **normalised by unit count** (`staggerFor`), so a 25-letter headline and a
13-letter one take about the same share of their chapter. A fixed per-unit value made
"Islands AND SLOW MORNINGS" crawl while "Begin ANYWHERE" was over instantly.

The scrim follows the text — it darkens the side the words are on, and centred chapters get a
top-and-bottom gradient instead. The small frames always take the **opposite** side. The text
column also reserves `26vh` at its foot: the frames sit in a band across the bottom of the
stage, and without that reservation the centred chapters printed their headline straight
through them.

The image *expands into* place rather than sliding past, which reads as arrival rather than
drift. The numbers matter: an earlier pass used 1.18 spread across the whole chapter, which
worked out to about 2% of scale per 10% of scroll — technically animating, perceptually
static. 1.28 landing by 70% is a change you can actually watch happen.

**Keep the scrims reaching `transparent`.** An earlier pair bottomed out at `/25` and `/70`
and multiplied over each other, so even a bright photograph rendered as a flat blue-grey
wash — and an image you cannot see cannot be seen to move. That single mistake made the
whole page look like the scroll was broken. The small frames land one after another — each finishes before the next begins. The
headline sits in front of the photograph over two scrim gradients: a horizontal one carrying
the text side and a vertical one keeping the small frames legible, rather than one flat
overlay that would grey out the whole picture.

One timeline per chapter, not several independent triggers, so every element is driven by a
single progress value and they cannot drift apart.

**The playhead is driven by live geometry, not by ScrollTrigger** — see
`useChapterReveal.ts`. ScrollTrigger caches each trigger's start and end at creation, and
this page changes height long afterwards: the hero's pin adds two viewports of `pinSpacing`
and is created late because it waits on 151 frames decoding. Measured, every chapter's
trigger sat exactly **2.0 viewports early** — chapter I believed it started at 1.0vh when it
really starts at 3.0 — so each headline finished writing itself on while the visitor was
still looking at the hero.

Three refresh strategies were tried and all three failed: refreshing straight after creating
the pin (spacer not yet applied), coalescing a refresh across all parties (the chapters
request theirs on mount, long before the pin exists), and a ResizeObserver on the document
(never fires reliably — it needs rendering opportunities, the same reason IntersectionObserver
callbacks stall in a backgrounded tab). Reading `getBoundingClientRect()` every frame has no
cache to invalidate, so it cannot go stale. It is also the pattern already proven for the
hero canvas: read the truth each frame, draw from that.

**Nothing is hidden in CSS.** GSAP's `fromTo` applies the start state itself, so when the
timeline never runs — reduced motion, no JS, or a narrow viewport where it is disabled — every
frame renders visible and in place rather than stranded at opacity 0. That failure mode is
exactly what the guardrail in `lib/motion.ts` warns about.

Sticky does the holding rather than a JS pin, so without scripting each chapter is still a
legible full-bleed panel with its text over it; it simply arrives already assembled.

### Deliberate departures from the reference

- **Real scroll.** The reference's document is exactly one viewport tall; it hijacks the
  wheel and drives a JS timeline. That is why it asks phone users to rotate and why it is
  `noindex`. This page scrolls natively, is indexable, and has a real mobile layout.
- **At most three videos play at once** ([`videoDirector.ts`](./src/components/collection/videoDirector.ts)).
  The reference runs every clip simultaneously; each decode is a separate hardware pipeline.
  Clips that enter view while the budget is full wait on their poster and are promoted when
  a slot frees.

### Two things worth knowing

**`muted` must be set on the element, not just in JSX.** React does not reliably reflect it
to the DOM, and the autoplay policy reads the live property at `play()` time. Without it the
browser loads the video, refuses to start, and reports `readyState 4`, `paused true` and *no
error* — an autoplay rejection that looks like nothing happened.

**Video posters always load eagerly.** `<video poster>` has no lazy equivalent, so both
posters (135KB) are fetched on first paint even though the second clip is far below the fold.
That is the single largest item in the initial payload. Swapping below-fold posters for a
lazy `<img>` overlay would recover ~74KB; at 371KB against a 1.2MB budget it has not been
worth the complexity.

### Indexability

The app is a client-rendered SPA with one `index.html`, so this route sets its own `<title>`
and description on mount. A crawler that executes JS will index it; for guaranteed indexing
the route wants prerendering or SSR. Stated rather than assumed.

## Structure

```
src/
  types/      wire types barrel (the swap point) + local mirror
  lib/        api, sse, mergePatch, format (tabular money), motion variants
  store/      zustand session store (stream glue) + theme
  mocks/      MSW handlers replaying the fixtures (dev only)
  components/ the DESIGN_SYSTEM component inventory
scripts/      build-hero-frames.sh — ffmpeg → hero frame sets + manifest
public/hero/  generated frame sets (not bundled)
```
