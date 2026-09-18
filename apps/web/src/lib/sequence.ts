/**
 * Scroll-scrubbed frame sequence — manifest shape, URL construction, and the capability
 * gate that decides whether a visitor gets the scrubbed canvas or a single static frame.
 *
 * The manifest is *generated*, not hand-written: `scripts/build-hero-frames.sh` probes the
 * source video and emits `public/hero/manifest.json` with the real frame count, real pixel
 * dimensions, and real byte totals. Nothing here hardcodes those, so re-running the script
 * with a different source or frame target needs no code change.
 */

export type VariantName = 'desktop' | 'mobile';

export interface SequenceVariant {
  /** Directory under `/public`, e.g. `/hero/desktop`. No trailing slash. */
  dir: string;
  /** Intrinsic frame dimensions, used only for logging/diagnostics — the canvas
   *  cover-fit reads the decoded bitmap's own width/height, never these. */
  width: number;
  height: number;
  /** Total bytes of this variant's primary (WebP) set, as measured at build time. */
  bytes: number;
}

export interface SequenceManifest {
  /** Build stamp, appended to every asset URL so a re-generated set is never served stale. */
  version: string;
  /** Number of frames actually produced (ffmpeg's real output count, not the target). */
  frames: number;
  /** Zero-pad width of the frame index, e.g. 4 → `frame-0001`. */
  pad: number;
  /** First frame's index — ffmpeg's `%04d` pattern starts at 1. */
  start: number;
  /** Formats in preference order, e.g. `['webp', 'jpg']`. */
  formats: string[];
  /** Filename stem, e.g. `frame`. */
  basename: string;
  variants: Record<VariantName, SequenceVariant>;
  /** Static poster per variant — shown immediately, and the whole hero in static mode. */
  poster: Record<VariantName, string>;
  source: { duration: number; fps: number };
}

/** Cache-busting suffix. Empty when a manifest predates versioning, so nothing breaks. */
function stamp(manifest: SequenceManifest): string {
  return manifest.version ? `?v=${manifest.version}` : '';
}

/** URL for a single frame. `index` is 0-based; the manifest's `start`/`pad` do the rest. */
export function frameUrl(
  manifest: SequenceManifest,
  variant: VariantName,
  index: number,
  format: string,
): string {
  const n = String(index + manifest.start).padStart(manifest.pad, '0');
  return `${manifest.variants[variant].dir}/${manifest.basename}-${n}.${format}${stamp(manifest)}`;
}

/**
 * URL for a variant's poster. Versioned for the same reason as the frames — the poster is
 * the one image every visitor sees, so a stale one is the most visible kind of stale.
 */
export function posterUrl(manifest: SequenceManifest, variant: VariantName): string {
  const url = manifest.poster[variant];
  return url ? `${url}${stamp(manifest)}` : url;
}

export type SequenceMode = 'scrub' | 'static';

export interface SequenceDecision {
  mode: SequenceMode;
  variant: VariantName;
  /** Why we landed here. Surfaced by `<ScrollSequence debug>` and handy in bug reports. */
  reason: string;
}

/**
 * Subset of the Network Information API we rely on. It is unshipped in Safari and Firefox,
 * so every field is optional and absence is treated as "fast enough" rather than "slow" —
 * penalising the browsers that decline to fingerprint their users would be backwards.
 */
interface NetworkInformationLike {
  effectiveType?: string;
  saveData?: boolean;
}

/** Connections we refuse to push ~6MB of frames down. */
const SLOW_CONNECTIONS = new Set(['slow-2g', '2g', '3g']);

/** Below this CSS width the sequence is never downloaded — static frame only. */
export const SCRUB_MIN_WIDTH = 768;
/** Below this CSS width a qualifying viewport gets the ~960px set instead of ~1920px. */
export const DESKTOP_MIN_WIDTH = 1280;

/**
 * Decide, once, what this visitor gets. Called on mount and on
 * `prefers-reduced-motion` changes — not on resize: swapping a visitor mid-session from
 * static to pinned would move the page under them, and re-downloading a second resolution
 * because they nudged a window edge is waste, not adaptivity.
 */
export function decideSequence(): SequenceDecision {
  if (typeof window === 'undefined') {
    return { mode: 'static', variant: 'desktop', reason: 'no window (SSR/prerender)' };
  }

  // Resolve the variant before any early return: a phone that asks for reduced motion
  // should still be handed the ~960px poster, not the ~1920px one.
  const width = window.innerWidth;
  const variant: VariantName = width < DESKTOP_MIN_WIDTH ? 'mobile' : 'desktop';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { mode: 'static', variant, reason: 'prefers-reduced-motion: reduce' };
  }

  if (width < SCRUB_MIN_WIDTH) {
    return { mode: 'static', variant: 'mobile', reason: `viewport ${width}px < ${SCRUB_MIN_WIDTH}px` };
  }

  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (conn?.saveData) {
    return { mode: 'static', variant: 'mobile', reason: 'navigator.connection.saveData' };
  }
  if (conn?.effectiveType && SLOW_CONNECTIONS.has(conn.effectiveType)) {
    return {
      mode: 'static',
      variant: 'mobile',
      reason: `navigator.connection.effectiveType = ${conn.effectiveType}`,
    };
  }

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof memory === 'number' && memory < 4) {
    return { mode: 'static', variant: 'mobile', reason: `deviceMemory ${memory}GB < 4GB` };
  }

  return { mode: 'scrub', variant, reason: `scrubbing at ${variant} resolution (${width}px)` };
}

/**
 * One-shot WebP support probe. Every engine we target has shipped WebP for years, so this
 * resolves `true` in practice — it exists so an old Safari silently gets the JPEG set
 * instead of 150 broken decodes.
 */
let webpSupport: Promise<boolean> | null = null;
export function supportsWebP(): Promise<boolean> {
  if (!webpSupport) {
    webpSupport = new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.width === 1);
      img.onerror = () => resolve(false);
      // 1x1 lossy WebP.
      img.src =
        'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    });
  }
  return webpSupport;
}
