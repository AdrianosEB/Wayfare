import { images } from '@/lib/images';
import { LQIP } from './lqip.generated';

/**
 * The six chapters of /collection.
 *
 * Every `photo` key resolves through `images.for()` to a real, curated photograph that
 * `scripts/build-lqip.sh` has verified returns HTTP 200. Every `video` is a real clip cut
 * from footage in this repo. A slot with no real asset is declared as a `gap` and renders
 * as an empty, labelled frame — never a gradient, a solid block, or a decorative substitute.
 */

export interface PhotoSlot {
  kind: 'photo';
  /** Key into the curated set in lib/images.ts. */
  key: string;
  alt: string;
}

export interface VideoSlot {
  kind: 'video';
  /** Basename under /collection — `<name>.mp4` + `<name>.webp` poster. */
  name: string;
  alt: string;
}

/** A slot we have no real asset for. Renders empty with a visible, labelled outline. */
export interface GapSlot {
  kind: 'gap';
  subject: string;
  orientation: 'landscape' | 'portrait' | 'square';
  minWidth: number;
}

export type Slot = PhotoSlot | VideoSlot | GapSlot;

/**
 * How a chapter's headline arrives. Each chapter gets its own, so the page does not repeat
 * the same trick six times — see `useChapterReveal` for what each one does.
 */
export type RevealStyle = 'rise' | 'words' | 'slide' | 'wipe' | 'scatter' | 'center-out';

/** Which side of the stage the text sits on. */
export type Align = 'left' | 'center' | 'right';

/** The unit each style animates. Drives how `SplitHeadline` breaks the text up. */
export const REVEAL_UNIT: Record<RevealStyle, 'letter' | 'word' | 'line'> = {
  rise: 'letter',
  words: 'word',
  slide: 'letter',
  wipe: 'line',
  scatter: 'letter',
  'center-out': 'letter',
};

export interface ChapterDef {
  id: string;
  /** Roman numeral shown beside the sticky title. */
  numeral: string;
  /** Two-tone headline: script word, then wide-tracked caps. Line breaks are manual. */
  script: string;
  caps: string[];
  /** Short standfirst. Product truth only — no invented claims, prices or availability. */
  body: string;
  reveal: RevealStyle;
  align: Align;
  large: Slot;
  small: Slot[];
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'arriving',
    numeral: 'I',
    script: 'The art',
    caps: ['OF', 'ARRIVING'],
    body: 'Tell us the trip you want. We plan it, price it, and keep it honest.',
    reveal: 'rise',
    align: 'left',
    // Not `greece`: the landing page's hero fallback and its Naxos card both use that photo,
    // and repeating it here made the two pages look like the same page.
    large: {
      kind: 'photo',
      key: 'aegean_port',
      alt: 'A Greek island harbour town, masts along the waterfront below the hillside',
    },
    small: [
      { kind: 'photo', key: 'sunset', alt: 'The sun low over open water' },
      { kind: 'photo', key: 'athens', alt: 'Ancient stonework above the city of Athens' },
    ],
  },
  {
    id: 'feeling',
    numeral: 'II',
    script: 'Choose',
    caps: ['A', 'FEELING'],
    body: 'Start from how you want the week to feel, not from a destination list.',
    reveal: 'words',
    align: 'center',
    large: {
      kind: 'photo',
      key: 'aegean_table',
      alt: 'A table laid for dinner beside the sea as the sun sets',
    },
    small: [
      { kind: 'photo', key: 'family', alt: 'A family playing in a green park' },
      { kind: 'photo', key: 'cyclades_alley', alt: 'A whitewashed alley hung with bougainvillea' },
      { kind: 'photo', key: 'group', alt: 'A group of friends travelling together' },
    ],
  },
  {
    id: 'islands',
    numeral: 'III',
    script: 'Islands',
    caps: ['AND', 'SLOW', 'MORNINGS'],
    body: 'Coastlines where the plan is a beach, a taverna, and nothing in particular.',
    reveal: 'slide',
    align: 'right',
    large: { kind: 'video', name: 'harbour-open', alt: 'Small boats drifting on clear turquoise water' },
    small: [
      { kind: 'photo', key: 'santorini', alt: 'Cliffside village above the Aegean' },
      { kind: 'photo', key: 'amalfi', alt: 'Terraced houses on the Amalfi coastline' },
      { kind: 'photo', key: 'beach', alt: 'An empty stretch of sunlit beach' },
    ],
  },
  {
    id: 'cities',
    numeral: 'IV',
    script: 'Cities',
    caps: ['WORTH', 'WALKING'],
    body: 'Short breaks built around the streets, not the checklist.',
    reveal: 'wipe',
    align: 'left',
    large: { kind: 'photo', key: 'lisbon', alt: 'A yellow tram on a narrow Lisbon street' },
    small: [
      { kind: 'photo', key: 'kyoto', alt: 'Kyoto rooftops at dusk' },
      { kind: 'photo', key: 'prague', alt: 'Prague spires above the old town' },
      { kind: 'photo', key: 'porto', alt: 'Porto rooftops above the river' },
    ],
  },
  {
    id: 'prices',
    numeral: 'V',
    script: 'Every price',
    caps: ['SOURCED', 'AND', 'DATED'],
    body:
      'Every price shows where it came from and when. Estimates are labelled as estimates. ' +
      'We never claim an estimate is a bookable, guaranteed price.',
    reveal: 'scatter',
    align: 'center',
    // A real photograph of the thing being priced — the stay — rather than the empty slot
    // this used to be. A planner screenshot would still be the stronger frame here, because
    // the chapter's claim is about the product; see the README's asset note.
    large: {
      kind: 'photo',
      key: 'aegean_terrace',
      alt: 'A stone terrace table looking out over the Aegean',
    },
    small: [
      { kind: 'photo', key: 'flight', alt: 'An aircraft wing above cloud' },
      { kind: 'photo', key: 'meal', alt: 'A shared meal on a table outdoors' },
      { kind: 'photo', key: 'museum', alt: 'A quiet gallery interior' },
    ],
  },
  {
    id: 'begin',
    numeral: 'VI',
    script: 'Begin',
    caps: ['ANYWHERE'],
    body: 'One sentence is enough to start. You can change everything after that.',
    reveal: 'center-out',
    align: 'right',
    large: { kind: 'photo', key: 'viewpoint', alt: 'A wide view over a valley from a high lookout' },
    small: [
      { kind: 'photo', key: 'hike', alt: 'A trail climbing through open country' },
      { kind: 'photo', key: 'nightlife', alt: 'Warm lights along an evening street' },
    ],
  },
];

/** Widths emitted into every `srcset`. */
export const SRCSET_WIDTHS = [640, 1280, 1920] as const;

/** Unsplash serves modern formats via `auto=format`, so one URL covers WebP and AVIF. */
export function photoSrc(key: string, width: number): string {
  const base = images.for(key);
  return base.replace(/([?&])w=\d+/, `$1w=${width}`);
}

export function photoSrcSet(key: string): string {
  return SRCSET_WIDTHS.map((w) => `${photoSrc(key, w)} ${w}w`).join(', ');
}

export function lqipFor(key: string): string | undefined {
  return LQIP[key];
}
