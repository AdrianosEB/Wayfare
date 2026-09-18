import { useEffect, useRef } from 'react';
import { installScrollRefreshWatcher } from '@/lib/scrollRefresh';

/**
 * Maps scroll position over a pinned section onto a normalised 0→1 progress value.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 * 1. **Progress comes from a dummy tween on a proxy object**, not from
 *    `ScrollTrigger.create({ onUpdate })`. `scrub` smoothing is a property of a *tween*
 *    driven by a ScrollTrigger; a bare `ScrollTrigger.create` reports raw, unsmoothed
 *    `self.progress` and silently ignores any `scrub` value you hand it. That is why
 *    hand-rolled versions of this effect feel jittery on a trackpad.
 *
 * 2. **GSAP is imported dynamically.** gsap + ScrollTrigger is ~40KB gzipped, and every
 *    visitor who gets the static fallback — reduced motion, narrow viewport, metered
 *    connection — would otherwise download it inside the main chunk to never call it.
 *    `prefetchScrollScrub()` lets the consumer start that fetch in parallel with frame
 *    decoding, so splitting it out costs nothing in engage latency.
 *
 * Progress is written to a ref, never to state: state would re-render the component on
 * every scroll tick. A single rAF loop in the consumer polls the ref instead.
 *
 * This hook deliberately reports nothing about whether the trigger is "active". It used to,
 * so the consumer could park its loop — but `ScrollTrigger`'s `isActive` is not reliably
 * populated during the initial refresh (`onToggle` also never fires for a trigger's initial
 * state, and a hero pinned at the top of the page is born active). Gating a render loop on
 * it is a race that loses roughly whenever the effect matters most. The consumer observes
 * the section's own visibility instead.
 */

type LoadedGsap = {
  gsap: typeof import('gsap').gsap;
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger;
};

let gsapPromise: Promise<LoadedGsap> | null = null;

function loadGsap(): Promise<LoadedGsap> {
  gsapPromise ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
    ([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      return { gsap, ScrollTrigger };
    },
  );
  return gsapPromise;
}

/**
 * Warm the GSAP chunk. Safe to call repeatedly — the import is memoised. Call it as soon as
 * you know scrubbing is wanted, so the fetch overlaps frame decoding instead of following it.
 */
export function prefetchScrollScrub(): void {
  void loadGsap();
}

export interface ScrollScrubOptions {
  /** The element to pin. Its own height defines the pinned viewport. */
  target: React.RefObject<HTMLElement>;
  /** When false no ScrollTrigger is created at all — nothing is pinned, nothing hijacked. */
  enabled: boolean;
  /** Viewports of scroll the scrub consumes before the section releases. */
  viewports: number;
  /** GSAP scrub: `true` is finger-locked, a number is seconds of catch-up smoothing. */
  scrub: number | boolean;
  /** Called instead of pinning when pinning would be disruptive. Receives the reason. */
  onSkip?: (reason: string) => void;
}

/**
 * Whether pinning right now would be invisible to the visitor rather than disruptive.
 *
 * `pinSpacing` injects extra page height below the hero, so engaging the pin while someone
 * is already reading further down would yank that content downward under them. Frames
 * decode asynchronously and the GSAP chunk loads asynchronously, so this is a real case on
 * a slow connection rather than a theoretical one — and it has to be re-checked after
 * every await.
 *
 * The test is on `scrollY`, not the element's `getBoundingClientRect().top`: a hero that
 * bleeds up under a sticky nav has a negative `top` at rest, which would make a rect-based
 * check decline to pin permanently. Half a viewport is where the hero stops being the
 * thing on screen.
 */
function safeToPin(): boolean {
  return window.scrollY <= window.innerHeight * 0.5;
}

export function useScrollScrub({
  target,
  enabled,
  viewports,
  scrub,
  onSkip,
}: ScrollScrubOptions): React.MutableRefObject<number> {
  const progressRef = useRef(0);

  // Read through a ref so an inline arrow in the consumer's JSX does not tear down and
  // rebuild the ScrollTrigger on every render.
  const handlers = useRef({ onSkip });
  handlers.current = { onSkip };

  useEffect(() => {
    const el = target.current;
    if (!enabled || !el) return;

    let cancelled = false;
    let arming = false;
    // Structural type rather than gsap's `Context`: it keeps this the only place that needs
    // to know GSAP's shape, and `revert()` is all the cleanup path uses.
    let ctx: { revert: () => void } | undefined;

    /**
     * Attempt to engage the pin. Safe to call repeatedly — it is a no-op unless pinning is
     * currently safe and not already set up.
     *
     * The retry loop matters: deciding once at decode-time and giving up would mean any
     * visitor who scrolls during loading loses the effect permanently, even after scrolling
     * back to the top where pinning is free. Instead we keep watching and arm the moment
     * the hero is back at the top of the viewport.
     */
    const tryArm = async () => {
      if (cancelled || arming || ctx || !safeToPin()) return;
      arming = true; // claim the slot so a burst of scroll events cannot double-arm

      const { gsap, ScrollTrigger } = await loadGsap();
      // Re-check after the await: the visitor may have scrolled while GSAP loaded.
      if (cancelled) return;
      if (!safeToPin()) {
        arming = false; // the scroll listener is still attached, so we will try again
        return;
      }

      window.removeEventListener('scroll', onScroll);
      const proxy = { p: 0 };

      // NOTE: deliberately *not* using ScrollTrigger.normalizeScroll(). It replaces native
      // scrolling document-wide to paper over mobile address-bar resizing, and in doing so
      // breaks keyboard paging, momentum, and assistive-tech scrolling across the whole
      // page. Pinning one section must not cost the document its native scroll.
      ctx = gsap.context(() => {
        gsap.to(proxy, {
          p: 1,
          ease: 'none',
          onUpdate: () => {
            progressRef.current = proxy.p;
          },
          scrollTrigger: {
            trigger: el,
            start: 'top top',
            // A function, so `invalidateOnRefresh` recomputes it on resize instead of
            // baking in the pixel height of whichever viewport happened to load first.
            end: () => `+=${window.innerHeight * viewports}`,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            scrub,
          },
        });
      });

      /*
       * This pin adds ~2 viewports of height, so anything measured before it is stale. The
       * watcher notices the height change and refreshes.
       *
       * NOTE: `ScrollTrigger` must be destructured above. It was omitted once, and because
       * this line sits *after* the pin is built, the pin kept working while the watcher
       * silently never installed — an uncaught ReferenceError per mount, no visible symptom,
       * and days of confusion about why refreshes never landed.
       */
      installScrollRefreshWatcher(ScrollTrigger);
    };

    const onScroll = () => {
      void tryArm();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    if (!safeToPin()) {
      handlers.current.onSkip?.('scrolled past the hero — will arm when it returns to top');
    }
    void tryArm();

    return () => {
      cancelled = true;
      window.removeEventListener('scroll', onScroll);
      ctx?.revert();
      progressRef.current = 0;
    };
  }, [target, enabled, viewports, scrub]);

  return progressRef;
}
