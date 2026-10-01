/**
 * Refreshes ScrollTrigger whenever the document height changes.
 *
 * Triggers measure their start and end at creation, so a later height change leaves earlier
 * triggers firing in the wrong place. On /collection the hero's pin adds about two viewports
 * of `pinSpacing`, and it is created seconds after the chapters register because it waits on
 * the frame sequence decoding.
 *
 * Refreshing right after creating the pin was too early (its spacer had not been applied),
 * and so was a coalesced refresh, because the chapters request theirs on mount before the
 * pin exists. A ResizeObserver on <body> needs no ordering assumptions.
 */

type Refreshable = { refresh: () => void };

/** Ignore sub-pixel and trivial reflows; a pin adds viewports, not pixels. */
const MIN_DELTA_PX = 8;
/** Long enough for a refresh's own pin/unpin churn to settle before we look again. */
const SETTLE_MS = 150;

let installed = false;

export function installScrollRefreshWatcher(scrollTrigger: Refreshable): void {
  if (installed || typeof ResizeObserver === 'undefined') return;
  installed = true;

  let lastHeight = document.documentElement.scrollHeight;
  let timer: number | undefined;

  const observer = new ResizeObserver(() => {
    const height = document.documentElement.scrollHeight;
    if (Math.abs(height - lastHeight) < MIN_DELTA_PX) return;
    lastHeight = height;
    window.clearTimeout(timer);
    // Debounced, and `lastHeight` is updated before the refresh so the pin/unpin the
    // refresh itself performs cannot feed back into another refresh.
    timer = window.setTimeout(() => {
      lastHeight = document.documentElement.scrollHeight;
      scrollTrigger.refresh();
    }, SETTLE_MS);
  });

  observer.observe(document.body);
}
