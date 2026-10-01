import type { ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { Chip } from '@/components/Chip';
import { images } from '@/lib/images';
import { cn } from '@/lib/cn';

/**
 * The `/explore` page hero: copy left, a 2×2 destination-photo collage right, stacking on
 * mobile. It renders no <Section> wrapper or page padding; the parent composes it inside a
 * centered max-w-site <Section>.
 */
export function ExploreHero() {
  const reduce = useReducedMotion();
  // Under reduced motion the hover lift is dropped entirely.
  const lift = reduce
    ? undefined
    : 'transition-transform duration-300 group-hover:scale-[1.04]';

  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {/* Left: copy */}
      <div className="max-w-xl">
        <Chip as="span" className="mb-4">Trending now</Chip>
        <h1 className="font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          See where everyone’s going.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          Real-shaped trips other travellers are planning right now, with the budget broken
          down, the best season to go, and every price honest about where it came from. Filter
          by vibe, who’s going, or what you want to spend, then tap one to make it yours.
        </p>
      </div>

      {/* Right: photo collage */}
      <div className="relative mx-auto w-full max-w-md lg:mx-0">
        {/* Soft azure glow behind the collage. Flush to the collage's width (inset-x-0) and
            bled only vertically: a wider glow painted past the viewport edge and caused a
            horizontal scrollbar on mobile. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -inset-y-6 -z-10 rounded-[2rem] bg-azure-100/70 blur-3xl"
        />

        {/* 2×2 of equal landscape tiles. The right column is nudged down (pt-6/pt-8) for a
            staggered look. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            <CollagePhoto
              imageKey="santorini"
              alt="Whitewashed cliffside houses above the sea in Santorini, Greece"
              lift={lift}
            />
            <CollagePhoto
              imageKey="lisbon"
              alt="Pastel tiled facades on a steep street in Lisbon, Portugal"
              lift={lift}
            />
          </div>
          <div className="flex flex-col gap-3 pt-6 sm:gap-4 sm:pt-8">
            <CollagePhoto
              imageKey="kyoto"
              alt="A quiet temple lane among autumn trees in Kyoto, Japan"
              lift={lift}
            >
              <div className="pointer-events-none absolute right-2.5 top-2.5 rounded-pill bg-bg/95 px-3 py-1.5 text-sm font-semibold text-ink shadow-card backdrop-blur">
                from <span className="tnum text-azure-700">€160</span>
              </div>
            </CollagePhoto>
            <CollagePhoto
              imageKey="amalfi"
              alt="Colourful houses stacked above a harbour on the Amalfi Coast, Italy"
              lift={lift}
            />
          </div>
        </div>

        {/* Floating "trending" accent pill, overlapping the collage corner */}
        <div className="pointer-events-none absolute -bottom-3 left-3 rounded-pill bg-azure-500 px-3.5 py-2 text-sm font-semibold text-white shadow-float">
          🔥 Trending this week
        </div>
      </div>
    </div>
  );
}

function CollagePhoto({
  imageKey,
  alt,
  lift,
  children,
}: {
  imageKey: string;
  alt: string;
  lift: string | undefined;
  children?: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl shadow-float">
      <Photo
        image={images.for(imageKey)}
        imageKey={imageKey}
        alt={alt}
        ratio="aspect-[4/3]"
        className={cn('h-full w-full', lift)}
      />
      {children}
    </div>
  );
}
