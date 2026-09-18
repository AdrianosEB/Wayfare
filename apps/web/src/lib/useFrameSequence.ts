import { useCallback, useEffect, useRef, useState } from 'react';
import {
  frameUrl,
  supportsWebP,
  type SequenceManifest,
  type VariantName,
} from '@/lib/sequence';

/**
 * Preloads and decodes a numbered frame sequence for canvas scrubbing.
 *
 * Two deliberate choices shape this hook:
 *
 * 1. **Decoded frames live in a ref, not state.** The render loop reads
 *    `framesRef.current` directly, so decoding 150 frames causes *zero* re-renders for
 *    frame data. Only `decoded` / `ready` / `error` are state — and `decoded` is batched
 *    every `REPORT_EVERY` frames, because a progress readout does not need 150 renders.
 *
 * 2. **`createImageBitmap` where available.** It decodes off the main thread and hands back
 *    an already-rasterised bitmap, so `drawImage` during a scrub never pays decode cost on
 *    the frame it is trying to hit. The `<img>` path is a fallback, not the plan.
 *
 * Bitmaps are explicitly `close()`d on unmount. `ImageBitmap` holds memory outside the JS
 * heap that the GC will not reclaim for you, and 150 × 1920px frames is not a rounding
 * error — leaving them open is how a landing page ends up holding ~400MB.
 */

/** Anything `CanvasRenderingContext2D.drawImage` accepts that we actually produce. */
export type DecodedFrame = ImageBitmap | HTMLImageElement;

/** Parallel in-flight requests. Enough to saturate a connection, few enough that the
 *  browser's own per-host queue stays useful and frame 0 is not stuck behind frame 140. */
const CONCURRENCY = 6;
/**
 * Fraction of frames that must be decoded before scrubbing engages.
 *
 * Not 0.9. Frames are claimed in ascending order, so a decoded prefix is exactly what a
 * visitor scrubbing forward consumes first, and `nearest()` bridges anything still in
 * flight. Waiting for near-complete decode instead means that on a slow connection the
 * hero is very often still unarmed by the time someone scrolls — and an effect that does
 * not arm is worse than one that is briefly a little chunky at the far end.
 */
const READY_RATIO = 0.4;
/** Re-render cadence for the `decoded` counter. */
const REPORT_EVERY = 10;

export interface FrameSequenceHandle {
  /** Sparse until loading completes. Index-aligned with frame index (0-based). */
  framesRef: React.MutableRefObject<(DecodedFrame | undefined)[]>;
  /**
   * Nearest decoded frame to `index`, searching outward. Lets the canvas degrade to a
   * chunkier scrub on a half-loaded set instead of stalling on a hole.
   */
  nearest: (index: number) => DecodedFrame | undefined;
  /** Frames decoded so far (batched — see REPORT_EVERY). */
  decoded: number;
  total: number;
  /** True once enough frames are decoded to scrub without visible stalling. */
  ready: boolean;
  /** First fatal error. Individual frame failures are tolerated, not fatal. */
  error: Error | null;
}

function loadViaImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      // Best-effort: force the decode now rather than on first paint. Failure here is
      // not fatal — the image is loaded either way.
      const decoded = typeof img.decode === 'function' ? img.decode() : Promise.resolve();
      decoded.then(
        () => resolve(img),
        () => resolve(img),
      );
    };
    img.onerror = () => reject(new Error(`frame failed to load: ${url}`));
    img.src = url;
  });
}

async function decodeFrame(url: string, signal: AbortSignal): Promise<DecodedFrame> {
  if (typeof createImageBitmap === 'function' && typeof fetch === 'function') {
    const res = await fetch(url, { signal, cache: 'force-cache' });
    if (!res.ok) throw new Error(`frame ${res.status}: ${url}`);
    return createImageBitmap(await res.blob());
  }
  return loadViaImage(url);
}

function releaseFrames(frames: (DecodedFrame | undefined)[]) {
  for (const frame of frames) {
    if (typeof ImageBitmap !== 'undefined' && frame instanceof ImageBitmap) frame.close();
  }
  frames.length = 0;
}

/**
 * @param manifest  Stable manifest object — treated as an identity-compared dependency,
 *                  so pass an imported/memoised value, never a fresh literal.
 * @param variant   Which resolution set to pull.
 * @param enabled   When false, nothing is requested at all. This is the switch that keeps
 *                  reduced-motion, narrow, and slow-connection visitors from paying for
 *                  bytes they will never see.
 */
export function useFrameSequence(
  manifest: SequenceManifest,
  variant: VariantName,
  enabled: boolean,
): FrameSequenceHandle {
  const total = manifest.frames;
  const framesRef = useRef<(DecodedFrame | undefined)[]>([]);
  const [decoded, setDecoded] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || total <= 0) return;

    const controller = new AbortController();
    const frames: (DecodedFrame | undefined)[] = new Array(total);
    framesRef.current = frames;
    let done = 0;
    let cancelled = false;

    (async () => {
      const webp = await supportsWebP();
      // The repo ships a webp-only frame set (the jpg fallback tripled git history for
      // browsers released before ~2020). So when the manifest offers nothing this browser can
      // decode, request nothing: downloading 151 undecodable frames to end up on the poster
      // anyway is pure waste. `decideSequence` already routes such a visitor to the poster.
      const decodable = manifest.formats.filter((f) => f !== 'webp' || webp);
      const preferred = webp
        ? decodable.find((f) => f === 'webp')
        : decodable.find((f) => f !== 'webp');
      const format = preferred ?? decodable[0];

      // No decodable format (or an empty `formats`, i.e. a malformed manifest): request nothing.
      if (cancelled || !format) return;

      // Ordered work queue: a shared cursor consumed by CONCURRENCY workers. Frames are
      // claimed in ascending order so the early frames — the ones a visitor sees first —
      // land first, and `nearest()` has something useful to fall back on immediately.
      let cursor = 0;
      const worker = async () => {
        while (!cancelled) {
          const index = cursor++;
          if (index >= total) return;
          try {
            const frame = await decodeFrame(
              frameUrl(manifest, variant, index, format),
              controller.signal,
            );
            if (cancelled) {
              if (typeof ImageBitmap !== 'undefined' && frame instanceof ImageBitmap) {
                frame.close();
              }
              return;
            }
            frames[index] = frame;
          } catch (err) {
            if (cancelled || controller.signal.aborted) return;
            // A single missing frame is survivable — `nearest()` bridges the gap. Only
            // report it so the failure is visible in dev rather than silently smoothed over.
            if (import.meta.env.DEV) console.warn('[ScrollSequence]', err);
          }
          done += 1;
          if (done % REPORT_EVERY === 0 || done === total) setDecoded(done);
        }
      };

      try {
        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      releaseFrames(frames);
      setDecoded(0);
    };
  }, [manifest, variant, enabled, total]);

  const nearest = useCallback(
    (index: number): DecodedFrame | undefined => {
      const frames = framesRef.current;
      const exact = frames[index];
      if (exact) return exact;
      for (let offset = 1; offset < frames.length; offset += 1) {
        const before = frames[index - offset];
        if (before) return before;
        const after = frames[index + offset];
        if (after) return after;
      }
      return undefined;
    },
    [],
  );

  return {
    framesRef,
    nearest,
    decoded,
    total,
    ready: enabled && decoded >= Math.ceil(total * READY_RATIO),
    error,
  };
}
