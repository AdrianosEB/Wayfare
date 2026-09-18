/**
 * Keeps ScrollTrigger's cached offsets honest as the document grows.
 *
 * Triggers measure their start and end when they are created, so anything that changes
 * document height afterwards leaves every earlier trigger firing in the wrong place. On
 * /collection that is the normal case, not an edge case: the hero's pin adds about two
 * viewports of `pinSpacing`, and it is created late because it waits on the frame sequence
 * decoding — seconds after the chapters have already registered.
 *
 * Two earlier attempts failed, and both failed the same way. Refreshing straight after
 * creating the pin was too early (its spacer had not been applied). Coalescing a refresh
 * across all the parties was *also* too early, because the chapters request theirs on mount,
 * long before the hero pin exists — the refresh then measured a short document and moved the
 * chapters' triggers even further forward.
 *
 * So instead of guessing when layout has settled, watch for it. A ResizeObserver on <body>
 * fires whenever the document's height actually changes — the late pin, images loading,
 * fonts swapping — and a refresh follows. No ordering assumptions.
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
