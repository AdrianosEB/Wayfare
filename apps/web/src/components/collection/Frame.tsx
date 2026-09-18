import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { lqipFor, photoSrc, photoSrcSet, type Slot } from './chapters';
import { useReveal } from './useReveal';
import { releasePlay, requestPlay } from './videoDirector';

/**
 * One frame in a chapter — a real photograph, a real video loop, or a declared gap.
 *
 * The gap case is deliberately visible rather than hidden: an outlined box naming the asset
 * that belongs there. A missing photo should look missing, not be quietly papered over with
 * a gradient or a decorative stand-in.
 */

export interface FrameProps {
  slot: Slot;
  /** Value for the `sizes` attribute — set per slot, since large and small differ a lot. */
  sizes: string;
  /** Chapter one is above the fold and loads eagerly; everything below it is lazy. */
  eager?: boolean;
  className?: string;
  /** Stagger index within a group. Capped at 80ms per sibling. */
  index?: number;
}

const STAGGER_MS = 80;
const MAX_STAGGER_STEPS = 3;

export function Frame({
  slot,
  sizes,
  eager = false,
  className,
  index = 0,
}: FrameProps) {
  const { ref, revealed } = useReveal<HTMLDivElement>();
  const delay = Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS;

  return (
    <div
      ref={ref}
      // One step deeper than the page ground, so an unloaded frame still reads as a frame.
      className={cn('relative overflow-hidden bg-azure-100', className)}
      style={{
        // One transform plus opacity, 600ms, ease-out, no overshoot.
        transition: 'opacity 600ms cubic-bezier(0.16,1,0.3,1), transform 600ms cubic-bezier(0.16,1,0.3,1)',
        transitionDelay: `${delay}ms`,
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'scale(1)' : 'scale(1.04)',
      }}
    >
      {slot.kind === 'photo' && <FramePhoto slot={slot} sizes={sizes} eager={eager} />}
      {slot.kind === 'video' && <FrameVideo slot={slot} />}
      {slot.kind === 'gap' && <FrameGap slot={slot} />}
    </div>
  );
}

function FramePhoto({
  slot,
  sizes,
  eager,
}: {
  slot: Extract<Slot, { kind: 'photo' }>;
  sizes: string;
  eager: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const lqip = lqipFor(slot.key);
  // The travelling layer is taller than its window; the overhang is exactly what the
  // parallax consumes, so the frame is never left showing empty space at an edge.
  // Both layers are absolutely positioned so the photo paints ON TOP of its LQIP. Leaving
  // them `relative` stacks them in normal flow, pushing the real photo out of the
  // overflow-hidden frame entirely — a loaded, opacity-1 image that renders as an empty box.
  const media = { className: 'absolute inset-0 h-full w-full', style: undefined };

  return (
    <div className="absolute inset-0">
      {/*
        LQIP: a ~16px JPEG of THIS photograph, inlined and blurred while the full image
        arrives. It is a loading state for a real image, never a stand-in for a missing one —
        a slot with no photograph renders as a gap instead.
      */}
      {lqip && (
        <img
          src={lqip}
          alt=""
          aria-hidden
          style={media.style}
          className={cn(
            media.className,
            'scale-110 object-cover blur-xl transition-opacity duration-700',
            loaded ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}
      <img
        src={photoSrc(slot.key, 1280)}
        srcSet={photoSrcSet(slot.key)}
        sizes={sizes}
        alt={slot.alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        ref={(node) => {
          // A cached image can finish before React attaches onLoad, which would leave the
          // blur up permanently.
          if (node?.complete && node.naturalWidth > 0) setLoaded(true);
        }}
        style={media.style}
        className={cn(
          media.className,
          'object-cover transition-opacity duration-700 ease-out motion-reduce:transition-none',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}

function FrameVideo({ slot }: { slot: Extract<Slot, { kind: 'video' }> }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    /*
     * Set `muted` on the element itself, not just via the JSX prop.
     *
     * React does not reliably reflect `muted` to the DOM attribute, and the autoplay policy
     * reads the live property when `play()` is called. Without this the browser loads the
     * video, refuses to start it, and reports exactly what we saw: readyState 4, paused
     * true, no error — an autoplay rejection that looks like nothing happened at all.
     */
    video.muted = true;
    video.defaultMuted = true;

    // Reduced motion: hold frame one. The poster is that exact frame, so the clip simply
    // reads as a still photograph.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) requestPlay(video);
          else releasePlay(video);
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      releasePlay(video);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <video
        ref={videoRef}
        poster={`/collection/${slot.name}.webp`}
        muted
        loop
        playsInline
        preload="none"
        aria-label={slot.alt}
        className="h-full w-full object-cover"
      >
        <source src={`/collection/${slot.name}.mp4`} type="video/mp4" />
      </video>
    </div>
  );
}

function FrameGap({ slot }: { slot: Extract<Slot, { kind: 'gap' }> }) {
  return (
    /*
      MISSING ASSET — supply a real file for this slot.
      Subject:     see data-subject below
      Orientation: see data-orientation
      Min width:   see data-min-width
    */
    <div
      data-missing-asset=""
      data-subject={slot.subject}
      data-orientation={slot.orientation}
      data-min-width={slot.minWidth}
      className="flex h-full w-full items-center justify-center border border-dashed border-border p-6"
    >
      <p className="max-w-sm text-center font-mono text-[11px] leading-relaxed text-ink-3">
        Asset needed — {slot.subject}
        <br />
        {slot.orientation}, min {slot.minWidth}px wide
      </p>
    </div>
  );
}
