import { useReducedMotion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { images } from '@/lib/images';
import { EXPLORE_TRIPS, TRIP_VIBES } from '@/lib/content';
import type { ExploreTrip, TripVibe } from '@/lib/content';

/**
 * "Browse by vibe" — a photo-rich shortcut row for the Explore page. For each vibe we borrow the
 * photo of the first trip carrying that vibe and show how many trips match, so the row stays in
 * sync with EXPLORE_TRIPS without any hand-tuned imagery. Tapping a tile hands the vibe up to the
 * page, which applies it as a filter. Renders self-contained; the parent wraps it in a Section.
 */
export function ExploreVibeTiles({ onPick }: { onPick: (vibe: TripVibe) => void }) {
  const reduce = useReducedMotion();

  // Derive one tile per vibe from the trip data: the first matching trip supplies the photo, and
  // the match count supplies the badge. Vibes with no trips are dropped so we never render a blank.
  const tiles = TRIP_VIBES.map((vibe) => {
    const matches = EXPLORE_TRIPS.filter((trip: ExploreTrip) => trip.vibes.includes(vibe));
    return { vibe, count: matches.length, imageKey: matches[0]?.imageKey };
  }).filter((tile): tile is { vibe: TripVibe; count: number; imageKey: string } =>
    tile.imageKey !== undefined,
  );

  return (
    <div>
      <h2 className="font-display text-3xl font-semibold text-ink">Browse by vibe</h2>
      <p className="mt-2 text-ink-2">Pick a feeling and we'll filter the trips to match.</p>

      <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map(({ vibe, count, imageKey }) => (
          <button
            key={vibe}
            type="button"
            onClick={() => onPick(vibe)}
            aria-label={`Filter to ${vibe} trips (${count})`}
            className="group relative isolate flex aspect-[4/5] items-end overflow-hidden rounded-lg text-left shadow-card transition-shadow hover:shadow-float focus-visible:ring-2"
          >
            <Photo
              image={images.for(imageKey)}
              imageKey={imageKey}
              alt=""
              className={
                reduce
                  ? 'absolute inset-0 -z-10 h-full w-full'
                  : 'absolute inset-0 -z-10 h-full w-full transition-transform duration-300 group-hover:scale-[1.04]'
              }
            />
            {/*
              Explicit transparent-at-top gradient rather than the shared `bg-scrim` utility:
              `bg-scrim` currently also carries an OPAQUE background-color (Tailwind registers
              `scrim` as a color, colliding with the gradient-only .bg-scrim in index.css), which
              fully hides the photo behind it. This gradient keeps the label legible while letting
              the photo show through.
            */}
            <span
              className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
              aria-hidden
            />
            <span className="relative p-3">
              <span className="block text-sm font-semibold leading-tight text-white">{vibe}</span>
              <span className="mt-0.5 block text-xs text-white/80">
                {count} {count === 1 ? 'trip' : 'trips'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
