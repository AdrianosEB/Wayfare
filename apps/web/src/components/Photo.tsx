import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { images } from '@/lib/images';

/**
 * A photo with a CLS-safe aspect box and an on-brand azure-gradient fallback if the image
 * fails to load. Components feed it a plain `image` URL (from `images.for(key)`) plus the
 * `imageKey` so the fallback gradient is deterministic. Always pass a meaningful `alt`
 * (empty string for decorative imagery).
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
  const gradient = images.gradient(imageKey ?? image);

  return (
    <div
      className={cn('overflow-hidden bg-surface-2', ratio, className)}
      style={{ ...style, ...(failed ? { backgroundImage: gradient } : null) }}
    >
      {!failed && (
        <img
          src={image}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
