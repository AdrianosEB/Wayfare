import { useEffect, useRef, useState } from 'react';

/**
 * Reveal-on-scroll via IntersectionObserver.
 *
 * Not a scroll listener: a listener fires on every wheel tick whether or not anything
 * crossed a threshold, and forces layout each time it measures. The observer fires once per
 * element, off the main thread's critical path.
 *
 * Returns `true` immediately when the visitor prefers reduced motion, so the element renders
 * in its final state and the transition never runs.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (revealed) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [revealed]);

  return { ref, revealed };
}
