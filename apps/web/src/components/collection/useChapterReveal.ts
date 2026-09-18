import { useEffect, type RefObject } from 'react';
import { REVEAL_UNIT, type RevealStyle } from './chapters';

/**
 * Scroll-driven reveal for one chapter.
 *
 * Over the chapter's sticky hold:
 *   1. the full-bleed image expands from 1.28 to 1 — it settles rather than slides
 *   2. the headline arrives letter by letter in front of it — the main event
 *   3. the small frames fade up quietly, without competing for attention
 *
 * GSAP builds and eases the timeline, but it is NOT driven by ScrollTrigger. The playhead is
 * set from the section's live `getBoundingClientRect()` on every frame instead.
 *
 * That is a deliberate departure, and it was arrived at the hard way. ScrollTrigger caches
 * each trigger's start and end when it is created, and this page changes height long
 * afterwards: the hero's pin adds two viewports of `pinSpacing` and is created late, because
 * it waits on 151 frames decoding. Measured, every chapter's trigger sat exactly 2.0
 * viewports early — chapter I believed it started at 1.0vh when it actually starts at 3.0 —
 * so each headline finished writing itself on while the visitor was still looking at the
 * hero, and the words were simply already there by the time the chapter arrived.
 *
 * Refreshing was tried three ways and each failed: immediately after creating the pin (its
 * spacer had not been applied yet), coalesced across all parties (the chapters request on
 * mount, long before the pin exists), and from a ResizeObserver on the document (never
 * fires reliably — it needs rendering opportunities, the same reason IntersectionObserver
 * callbacks stall in a backgrounded tab).
 *
 * Live geometry has no cache to invalidate, so it cannot be stale. It is also the pattern
 * already proven for the hero canvas: read the truth every frame, draw from that.
 */

/** How far past its final size the image starts. Expanding *in* reads as arrival. */
const IMAGE_FROM_SCALE = 1.28;
/** Fraction of the chapter over which the image finishes expanding. */
const IMAGE_SETTLE_AT = 0.7;
/** Playhead easing per frame — a little lag, so it feels scrubbed rather than welded. */
const SMOOTHING = 0.14;

type Chapter = {
  section: HTMLElement;
  timeline: { progress: (value?: number) => number | unknown };
  current: number;
};

const chapters = new Set<Chapter>();
let frame: number | null = null;

/** Where the section sits within its own sticky hold, from live layout. 0 → 1. */
function targetProgress(section: HTMLElement): number {
  const rect = section.getBoundingClientRect();
  const travel = rect.height - window.innerHeight;
  if (travel <= 0) return rect.top <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -rect.top / travel));
}

/**
 * One loop for every chapter on the page, not one each. Six `getBoundingClientRect` reads
 * per frame is nothing, and they all happen together before any write, so the reads cannot
 * interleave with the writes and force repeated layout.
 */
function tick() {
  const targets: { chapter: Chapter; value: number }[] = [];
  for (const chapter of chapters) {
    targets.push({ chapter, value: targetProgress(chapter.section) });
  }
  for (const { chapter, value } of targets) {
    const next = chapter.current + (value - chapter.current) * SMOOTHING;
    // Skip the write once it is visually settled, so an idle page does no work.
    if (Math.abs(next - chapter.current) > 0.0005) {
      chapter.current = next;
      chapter.timeline.progress(next);
    }
  }
  frame = chapters.size > 0 ? requestAnimationFrame(tick) : null;
}

function register(chapter: Chapter) {
  chapters.add(chapter);
  // Start where the section already is, so a mid-page load is correct immediately.
  chapter.current = targetProgress(chapter.section);
  chapter.timeline.progress(chapter.current);
  if (frame === null) frame = requestAnimationFrame(tick);
}

function unregister(chapter: Chapter) {
  chapters.delete(chapter);
  if (chapters.size === 0 && frame !== null) {
    cancelAnimationFrame(frame);
    frame = null;
  }
}

/**
 * Stagger spacing, normalised so every headline takes about the same share of its chapter
 * regardless of length. A fixed per-unit value would make "Islands AND SLOW MORNINGS" (22
 * letters) crawl while "Begin ANYWHERE" (13) was over in a moment.
 */
function staggerFor(count: number): number {
  if (count <= 1) return 0;
  return Math.min(0.22, Math.max(0.012, 0.6 / (count - 1)));
}

/**
 * The six headline treatments. Each returns the from-state and to-state for its unit, so
 * the page never plays the same trick twice running.
 */
function buildHeadline(
  gsap: typeof import('gsap').gsap,
  tl: gsap.core.Timeline,
  section: HTMLElement,
  style: RevealStyle,
): void {
  const unit = REVEAL_UNIT[style];
  const targets = section.querySelectorAll(`[data-reveal="${unit}"]`);
  if (targets.length === 0) return;

  const each = staggerFor(targets.length);
  const START = 0.08;

  // `gsap.set` first, then `.to` — never a staggered `fromTo`. A staggered `fromTo` applies
  // each target's start state only when the playhead reaches that target (and
  // `immediateRender: true` does not change it), so everything after the first unit sat
  // visible before its own reveal.
  switch (style) {
    case 'rise':
      gsap.set(targets, { yPercent: 30, opacity: 0 });
      tl.to(targets, { yPercent: 0, opacity: 1, ease: 'power2.out', duration: 0.12,
        stagger: { each, from: 'start' } }, START);
      break;

    case 'slide':
      // Letters arrive from the side rather than from below — the chapter sits right-aligned,
      // so they travel inward from the margin.
      gsap.set(targets, { xPercent: 60, opacity: 0 });
      tl.to(targets, { xPercent: 0, opacity: 1, ease: 'power3.out', duration: 0.16,
        stagger: { each, from: 'start' } }, START);
      break;

    case 'words':
      // Whole words, slower and heavier. Fewer units means each one can afford real travel.
      gsap.set(targets, { yPercent: 40, opacity: 0, scale: 0.94 });
      tl.to(targets, { yPercent: 0, opacity: 1, scale: 1, ease: 'power3.out', duration: 0.26,
        stagger: { each, from: 'start' } }, START);
      break;

    case 'wipe':
      // Whole lines rising from behind their clipping box — no fade at all, so it reads as
      // the type being uncovered rather than appearing.
      gsap.set(targets, { yPercent: 115 });
      tl.to(targets, { yPercent: 0, ease: 'power3.out', duration: 0.3,
        stagger: { each, from: 'start' } }, START);
      break;

    case 'scatter':
      // Letters resolve in a fixed shuffled order. No travel — they settle out of nothing,
      // which suits the chapter about prices being pinned down.
      gsap.set(targets, { opacity: 0, scale: 0.82 });
      tl.to(targets, { opacity: 1, scale: 1, ease: 'power1.out', duration: 0.16,
        stagger: { each, from: 'random' } }, START);
      break;

    case 'center-out':
      // Outward from the middle of the line, closing the page symmetrically.
      gsap.set(targets, { yPercent: -28, opacity: 0 });
      tl.to(targets, { yPercent: 0, opacity: 1, ease: 'power2.out', duration: 0.14,
        stagger: { each, from: 'center' } }, START);
      break;
  }
}

export function useChapterReveal(
  sectionRef: RefObject<HTMLElement>,
  enabled: boolean,
  style: RevealStyle,
): void {
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !enabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    let ctx: { revert: () => void } | undefined;
    let entry: Chapter | undefined;

    void (async () => {
      const { gsap } = await import('gsap');
      if (cancelled) return;

      ctx = gsap.context(() => {
        const image = section.querySelector('[data-reveal="image"]');
        const meta = section.querySelector('[data-reveal="meta"]');
        const body = section.querySelector('[data-reveal="body"]');
        const steps = section.querySelectorAll('[data-reveal="step"]');

        // Paused: this timeline's playhead is ours to set.
        const tl = gsap.timeline({ paused: true });
        // Zero-duration spacer fixes the length at 1, so positions read as fractions.
        tl.set({}, {}, 1);

        if (image) {
          tl.fromTo(
            image,
            { scale: IMAGE_FROM_SCALE },
            { scale: 1, ease: 'power1.out', duration: IMAGE_SETTLE_AT },
            0,
          );
        }

        buildHeadline(gsap, tl, section, style);

        // The label and standfirst are animated individually rather than by fading their
        // shared parent: a parent's opacity multiplies against each letter's own, which
        // would dim the very reveal it sits around.
        if (meta) {
          tl.fromTo(meta, { opacity: 0 }, { opacity: 1, ease: 'none', duration: 0.08 }, 0);
        }
        if (body) {
          tl.fromTo(
            body,
            { opacity: 0, yPercent: 8 },
            { opacity: 1, yPercent: 0, ease: 'power2.out', duration: 0.12 },
            0.78,
          );
        }
        // Support, so they fade rather than perform.
        steps.forEach((step, i) => {
          tl.fromTo(
            step,
            { opacity: 0, yPercent: 6 },
            { opacity: 1, yPercent: 0, ease: 'power1.out', duration: 0.12 },
            0.84 + i * 0.05,
          );
        });

        entry = { section, timeline: tl, current: 0 };
        register(entry);
      }, section);
    })();

    return () => {
      cancelled = true;
      if (entry) unregister(entry);
      ctx?.revert();
    };
  }, [sectionRef, enabled, style]);
}
