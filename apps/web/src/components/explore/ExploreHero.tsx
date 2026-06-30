import { useReducedMotion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { Chip } from '@/components/Chip';
import { images } from '@/lib/images';
import { cn } from '@/lib/cn';

/**
 * ExploreHero — the `/explore` page hero. Two-column on desktop (copy left, a lively
 * destination-photo collage right), stacking to one column on mobile with the collage below
 * the text. Photo-rich and premium: an azure glow behind a staggered/overlapping set of
 * curated destination shots, with a couple of tasteful floating accents.
 *
 * Design-system notes:
 * - Renders VISIBLE BY DEFAULT — no opacity-from-0 entrance gating. The only motion is a
 *   subtle hover lift on each photo, guarded by `useReducedMotion`.
 * - Azure/white tokens only. No <Section> wrapper or page padding — the parent composes this
 *   inside a centered max-w-site <Section>.
 */
export function ExploreHero() {
  const reduce = useReducedMotion();
  const lift = reduce
    ? undefined
    : 'transition-transform duration-300 group-hover:scale-[1.04]';

  return (
    <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
      {/* LEFT — copy */}
      <div className="max-w-xl">
        <Chip as="span" className="mb-4">Trending now</Chip>
        <h1 className="font-display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          See where everyone’s going.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-2">
          Real-shaped trips other travellers are planning right now — with the budget broken
          down, the best season to go, and every price honest about where it came from. Filter
          by vibe, who’s going, or what you want to spend, then tap one to make it yours.
        </p>
      </div>

      {/* RIGHT — photo collage */}
      <div className="relative">
        {/* Soft azure glow / blob behind the collage */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-azure-100 opacity-70 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 -top-8 -z-10 h-40 w-40 rounded-full bg-azure-200 opacity-50 blur-2xl"
        />

        {/* Staggered 2-column masonry. Left column sits lower for the offset look. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="flex flex-col gap-3 pt-6 sm:gap-4 sm:pt-10">
            <CollagePhoto
              imageKey="santorini"
              alt="Whitewashed cliffside houses above the sea in Santorini, Greece"
              ratio="aspect-[3/4]"
              lift={lift}
            />
            <CollagePhoto
              imageKey="lisbon"
              alt="Pastel tiled facades on a steep street in Lisbon, Portugal"
              ratio="aspect-square"
              lift={lift}
            />
          </div>
          <div className="flex flex-col gap-3 sm:gap-4">
            <CollagePhoto
              imageKey="kyoto"
              alt="A quiet temple lane among autumn trees in Kyoto, Japan"
              ratio="aspect-square"
              lift={lift}
            >
              {/* "from" price tag overlaid on the top-right photo */}
              <div className="pointer-events-none absolute right-2.5 top-2.5 rounded-pill bg-bg/95 px-3 py-1.5 text-sm font-semibold text-ink shadow-card backdrop-blur">
                from <span className="tnum text-azure-700">€160</span>
              </div>
            </CollagePhoto>
            <CollagePhoto
              imageKey="amalfi"
              alt="Colourful houses stacked above a harbour on the Amalfi Coast, Italy"
              ratio="aspect-[3/4]"
              lift={lift}
            />
            <CollagePhoto
              imageKey="barcelona"
              alt="Sunlit Modernista rooftops and spires in Barcelona, Spain"
              ratio="aspect-[4/3]"
              lift={lift}
            />
          </div>
        </div>

        {/* Floating "trending" accent pill, overlapping the collage corner */}
        <div className="pointer-events-none absolute -bottom-3 left-2 rounded-pill bg-azure-500 px-3.5 py-2 text-sm font-semibold text-white shadow-float sm:-bottom-4 sm:left-4">
          🔥 Trending this week
        </div>
      </div>
    </div>
  );
}

function CollagePhoto({
  imageKey,
  alt,
  ratio,
  lift,
  children,
}: {
  imageKey: string;
  alt: string;
  ratio: string;
  lift: string | undefined;
  children?: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl shadow-float">
      <Photo
        image={images.for(imageKey)}
        imageKey={imageKey}
        alt={alt}
        ratio={ratio}
        className={cn('h-full w-full', lift)}
      />
      {children}
    </div>
  );
}
