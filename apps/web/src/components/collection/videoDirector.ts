/**
 * Caps how many loops play at once across the whole page.
 *
 * The reference site runs every clip simultaneously. On a laptop that is a fan event, and on
 * a phone it is a battery one — each decode is a separate hardware pipeline. Three is enough
 * that the page always feels alive without the tab becoming the most expensive thing running.
 *
 * Videos that enter view while the budget is full wait on their poster and are promoted the
 * moment a slot frees, so nothing is stranded paused after the others scroll away.
 */

const MAX_CONCURRENT = 3;

const playing = new Set<HTMLVideoElement>();
const waiting = new Set<HTMLVideoElement>();

function start(video: HTMLVideoElement) {
  playing.add(video);
  waiting.delete(video);
  // Autoplay can still be refused (low power mode, a user setting). The poster stays up,
  // which is the correct fallback, so swallow it rather than surfacing a console error.
  void video.play().catch(() => {
    playing.delete(video);
  });
}

function promoteOne() {
  const next = waiting.values().next();
  if (!next.done && playing.size < MAX_CONCURRENT) start(next.value);
}

/** Play if there is budget; otherwise queue and hold on the poster. */
export function requestPlay(video: HTMLVideoElement): void {
  if (playing.has(video)) return;
  if (playing.size < MAX_CONCURRENT) start(video);
  else waiting.add(video);
}

/** Pause and hand the slot to whoever is waiting. */
export function releasePlay(video: HTMLVideoElement): void {
  waiting.delete(video);
  if (playing.delete(video)) {
    video.pause();
    promoteOne();
  }
}
