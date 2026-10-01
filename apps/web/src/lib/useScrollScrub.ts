import { useEffect, useRef } from 'react';
import { installScrollRefreshWatcher } from '@/lib/scrollRefresh';

/**
 * Maps scroll position over a pinned section onto a normalised 0→1 progress value.
 *
 * Progress comes from a dummy tween on a proxy object, not from
 * `ScrollTrigger.create({ onUpdate })`. `scrub` smoothing only applies to a tween driven by
 * a ScrollTrigger; a bare `ScrollTrigger.create` reports raw `self.progress` and ignores
 * `scrub`, which feels jittery on a trackpad.
 *
 * GSAP is imported dynamically (~40KB gzipped) so visitors on the static fallback never
 * download it. `prefetchScrollScrub()` lets the consumer start that fetch in parallel with
 * frame decoding.
 *
 * Progress is written to a ref, not state, to avoid a re-render on every scroll tick. The
 * consumer polls the ref from a rAF loop.
 *
 * The hook does not report whether the trigger is active. `isActive` is not reliably set
 * during the initial refresh, and `onToggle` never fires for a trigger's initial state. The
 * consumer observes the section's own visibility instead.
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
 * Warm the GSAP chunk. The import is memoised, so this is safe to call repeatedly. Call it
 * as soon as scrubbing is wanted so the fetch overlaps frame decoding.
 */
export function prefetchScrollScrub(): void {
  void loadGsap();
}

export interface ScrollScrubOptions {
  /** The element to pin. Its own height defines the pinned viewport. */
  target: React.RefObject<HTMLElement>;
  /** When false no ScrollTrigger is created and nothing is pinned. */
  enabled: boolean;
  /** Viewports of scroll the scrub consumes before the section releases. */
  viewports: number;
  /** GSAP scrub: `true` is finger-locked, a number is seconds of catch-up smoothing. */
  scrub: number | boolean;
  /** Called instead of pinning when pinning would be disruptive. Receives the reason. */
  onSkip?: (reason: string) => void;
}

/**
 * Whether pinning now would go unnoticed by the visitor.
 *
 * `pinSpacing` adds page height below the hero, so engaging the pin while someone is reading
 * further down would shift that content under them. Frames and the GSAP chunk both load
 * asynchronously, so this has to be re-checked after every await.
 *
 * The test is on `scrollY`, not the element's `getBoundingClientRect().top`: a hero that
 * bleeds up under a sticky nav has a negative `top` at rest, so a rect-based check would
 * never pin.
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
    // Structural type instead of gsap's `Context`; `revert()` is all the cleanup path uses.
    let ctx: { revert: () => void } | undefined;

    /**
     * Try to engage the pin. A no-op unless pinning is currently safe and not already set
     * up. It is retried on scroll so a visitor who scrolled during loading still gets the
     * effect once the hero is back at the top.
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

      // ScrollTrigger.normalizeScroll() is not used: it replaces native scrolling
      // document-wide and breaks keyboard paging, momentum, and assistive-tech scrolling.
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
            // A function, so `invalidateOnRefresh` recomputes it on resize.
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
       * `ScrollTrigger` must be destructured above. If it is missing, this line throws a
       * ReferenceError after the pin is built, so the pin still works and the watcher
       * silently never installs.
       */
      installScrollRefreshWatcher(ScrollTrigger);
    };

    const onScroll = () => {
      void tryArm();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    if (!safeToPin()) {
      handlers.current.onSkip?.('scrolled past the hero, will arm when it returns to top');
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
