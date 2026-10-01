import { useCallback, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { images } from '@/lib/images';

/**
 * A photo in a fixed-ratio box over an azure gradient keyed by `imageKey`. The gradient is
 * the loading placeholder as well as the error fallback, so lazy-loaded photos don't show as
 * empty grey boxes first. Pass a meaningful `alt` (empty string for decorative imagery).
 */
export interface PhotoProps {
  image: string;
  alt: string;
  /** key used for the deterministic gradient fallback. */
  imageKey?: string;
  className?: string;
  /** e.g. 'aspect-[16/10]'. Reserves the ratio to avoid layout shift. */
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
