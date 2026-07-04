import { useReducedMotion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { images } from '@/lib/images';
import { navigate, planHref } from '@/lib/router';
import { EXPLORE_TRIPS } from '@/lib/content';
import type { ExploreTrip } from '@/lib/content';

/**
 * "Curated collections" — a small editorial row on `/explore` that groups the trips into a few
 * themed ways in. Each collection is DERIVED from EXPLORE_TRIPS (matching trips + count computed
 * here, never hardcoded), so it stays honest if the data changes. Tapping a card seeds the
 * planner with that collection's prompt and auto-starts. Solid by default — no entrance gating,
 * only a guarded hover lift on the photo motif.
 */

interface Collection {
  title: string;
  subtitle: string;
  seed: string;
  match: (trip: ExploreTrip) => boolean;
}

const COLLECTIONS: Collection[] = [
  {
    title: 'Under €500 escapes',
    subtitle: 'Big getaways that barely dent the account.',
    seed: 'Plan me a cheap getaway under €500',
    match: (t) => t.total <= 500,
  },
  {
    title: 'Bucket-list splurges',
    subtitle: 'The once-in-a-while trips worth saving up for.',
    seed: 'Plan me a bucket-list splurge trip',
    match: (t) => t.total > 2000,
  },
  {
    title: 'Longer adventures',
    subtitle: 'A proper week or more to really settle in.',
    seed: 'Plan me a longer trip, a week or more',
    match: (t) => t.lengthDays >= 6,
  },
];

export function ExploreCollections() {
  return (
    <div>
      <div className="max-w-xl">
        <h2 className="font-display text-3xl font-semibold text-ink">Curated collections</h2>
        <p className="mt-2 text-ink-2">
          A few themed ways in — tap one and we’ll start a plan in that spirit.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {COLLECTIONS.map((collection) => {
          const trips = EXPLORE_TRIPS.filter(collection.match);
          return <CollectionCard key={collection.title} collection={collection} trips={trips} />;
        })}
      </div>
    </div>
  );
}

function CollectionCard({ collection, trips }: { collection: Collection; trips: ExploreTrip[] }) {
  const reduce = useReducedMotion();
  const count = trips.length;
  // Up to three distinct image keys from the matching trips for the little stacked motif.
  const keys = dedupe(trips.map((t) => t.imageKey)).slice(0, 3);
  const extra = count - keys.length;

  return (
    <button
      type="button"
      onClick={() => navigate(planHref({ seed: collection.seed, autostart: true }))}
      aria-label={`${collection.title}, ${count} trips`}
      className="group flex w-full flex-col gap-4 rounded-lg bg-bg p-4 text-left shadow-card transition-shadow hover:shadow-float focus-visible:ring-2"
    >
      <PhotoMotif keys={keys} extra={extra} reduce={reduce ?? false} />
      <div>
        <h3 className="font-display text-lg font-semibold text-ink">{collection.title}</h3>
        <p className="mt-0.5 text-sm text-ink-2">{collection.subtitle}</p>
      </div>
      <p className="mt-auto text-sm font-semibold text-azure-700">{count} trips</p>
    </button>
  );
}

/** A small overlapping stack of 2–3 photos; when more trips match, the last tile shows "+N". */
function PhotoMotif({ keys, extra, reduce }: { keys: string[]; extra: number; reduce: boolean }) {
  const scale = reduce ? undefined : 'transition-transform duration-300 group-hover:scale-[1.03]';
  return (
    <div className="flex items-center">
      {keys.map((key, i) => (
        <div
          key={key}
          className="relative h-16 w-16 overflow-hidden rounded-md border-2 border-bg shadow-card"
          style={i === 0 ? undefined : { marginLeft: '-1rem' }}
        >
          <Photo
            image={images.for(key)}
            imageKey={key}
            alt=""
            ratio="aspect-square"
            className={scale}
          />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="flex h-16 w-16 items-center justify-center rounded-md border-2 border-bg bg-azure-100 text-sm font-semibold text-azure-700 shadow-card"
          style={{ marginLeft: '-1rem' }}
          aria-hidden
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
