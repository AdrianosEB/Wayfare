import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { lqipFor, photoSrc, photoSrcSet, type Slot } from './chapters';
import { useReveal } from './useReveal';
import { releasePlay, requestPlay } from './videoDirector';

/**
 * One frame in a chapter: a photograph, a video loop, or a declared gap. A gap renders as an
 * outlined box naming the asset that belongs there, not a gradient or stand-in.
 */

export interface FrameProps {
  slot: Slot;
  /** Value for the `sizes` attribute, set per slot since large and small differ a lot. */
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
  // Both layers are absolutely positioned so the photo paints on top of its LQIP. Left
  // `relative` they stack in normal flow, which pushes the photo out of the overflow-hidden
  // frame and renders an empty box.
  const media = { className: 'absolute inset-0 h-full w-full', style: undefined };

  return (
    <div className="absolute inset-0">
      {/*
        LQIP: a ~16px JPEG of this photograph, inlined and blurred while the full image
        arrives. A slot with no photograph renders as a gap instead.
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
     * Set `muted` on the element itself, not just via the JSX prop. React does not reliably
     * reflect `muted` to the DOM attribute, and the autoplay policy reads the live property
     * when `play()` is called. Without this the video loads but never starts, with no error.
     */
    video.muted = true;
    video.defaultMuted = true;

    // Reduced motion: hold frame one. The poster is that exact frame.
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
    /* Missing asset: supply a real file for this slot (see the data-* attributes below). */
    <div
      data-missing-asset=""
      data-subject={slot.subject}
      data-orientation={slot.orientation}
      data-min-width={slot.minWidth}
      className="flex h-full w-full items-center justify-center border border-dashed border-border p-6"
    >
      <p className="max-w-sm text-center font-mono text-[11px] leading-relaxed text-ink-3">
        Asset needed: {slot.subject}
        <br />
        {slot.orientation}, min {slot.minWidth}px wide
      </p>
    </div>
  );
}
