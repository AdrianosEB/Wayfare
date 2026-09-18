import { useCallback, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { images } from '@/lib/images';

/**
 * A photo with a CLS-safe aspect box and an on-brand azure-gradient fallback if the image
 * fails to load. Components feed it a plain `image` URL (from `images.for(key)`) plus the
 * `imageKey` so the fallback gradient is deterministic. Always pass a meaningful `alt`
 * (empty string for decorative imagery).
 *
 * The gradient is painted as the *placeholder* too, not only on error. Every photo on the
 * landing page is lazily loaded, so without it scrolling into a section shows a row of empty
 * grey boxes that snap to photos — which reads as broken rather than loading. Now the box is
 * on-brand immediately and the photo crossfades over it.
 */
export interface PhotoProps {
  image: string;
  alt: string;
  /** key used for the deterministic gradient fallback. */
  imageKey?: string;
  className?: string;
  /** e.g. 'aspect-[16/10]' — reserve ratio to avoid layout shift. */
  ratio?: string;
  eager?: boolean;
  style?: CSSProperties;
}

export function Photo({ image, alt, imageKey, className, ratio, eager, style }: PhotoProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const gradient = images.gradient(imageKey ?? image);

  /**
   * A cached image can finish decoding before React attaches `onLoad`, in which case the
   * event never fires and the photo would sit at opacity 0 forever. Checking `complete` as
   * the node mounts closes that gap.
   */
  const ref = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <div
      className={cn('overflow-hidden bg-surface-2', ratio, className)}
      style={{ ...style, backgroundImage: gradient }}
    >
      {!failed && (
        <img
          ref={ref}
          src={image}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-500 ease-out motion-reduce:transition-none',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  );
}
