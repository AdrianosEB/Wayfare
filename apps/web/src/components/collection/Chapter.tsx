import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Frame } from './Frame';
import { SplitHeadline } from './SplitHeadline';
import { REVEAL_UNIT, type Align, type ChapterDef } from './chapters';
import { useChapterReveal } from './useChapterReveal';

/**
 * One chapter: a full-bleed photograph that expands into place as you scroll, with the
 * headline set in front of it over a scrim, and the smaller frames arriving one after
 * another.
 *
 * The section is two viewports tall and the stage inside it is `position: sticky`, so the
 * stage locks to the top and holds while the second viewport scrolls through. Scroll progress
 * drives a single timeline (see `useChapterReveal`) rather than the page simply moving past
 * the image — which is what made the earlier version feel like a slow drift.
 *
 * Sticky does the holding, not a JS pin, so with scripting blocked each chapter is still a
 * legible full-bleed panel with its text over it; it just arrives already assembled.
 */
/**
 * Layout per alignment. The scrim always darkens the side the text is on, and the small
 * frames always take the opposite side, so they never sit under the headline.
 */
const LAYOUT: Record<Align, { text: string; scrim: string; frames: string }> = {
  left: {
    text: 'mr-auto items-start',
    scrim: 'bg-gradient-to-r from-scrim/75 via-scrim/30 to-transparent',
    frames: 'justify-end',
  },
  center: {
    text: 'mx-auto items-center',
    // Centred text has no clear side, so the scrim comes from top and bottom instead.
    scrim: 'bg-gradient-to-b from-scrim/60 via-scrim/35 to-scrim/60',
    frames: 'justify-center',
  },
  right: {
    text: 'ml-auto items-end',
    scrim: 'bg-gradient-to-l from-scrim/75 via-scrim/30 to-transparent',
    frames: 'justify-start',
  },
};

export function Chapter({ chapter, eager = false }: { chapter: ChapterDef; eager?: boolean }) {
  const layout = LAYOUT[chapter.align];
  const sectionRef = useRef<HTMLElement>(null);
  const headingId = `chapter-${chapter.id}`;
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useChapterReveal(sectionRef, isDesktop, chapter.reveal);

  return (
    <section
      ref={sectionRef}
      id={chapter.id}
      aria-labelledby={headingId}
      // Two viewports: the stage locks for the first, and the reveal timeline runs across
      // that hold. Three made each chapter a long haul for one animation.
      className="relative lg:h-[200vh]"
    >
      <div className="relative min-h-[88vh] overflow-hidden lg:sticky lg:top-0 lg:h-screen lg:min-h-0">
        {/* The photograph, full-bleed. Expands from 1.18 to 1 across the chapter. */}
        <div data-reveal="image" className="absolute inset-0 will-change-transform">
          <Frame
            slot={chapter.large}
            eager={eager}
            sizes="100vw"
            className="h-full w-full"
          />
        </div>

        {/*
          Scrim. Kept deliberately light and, crucially, both gradients reach `transparent`.
          The previous pair bottomed out at /25 and /70 and multiplied over each other, so
          even the brightest photograph rendered as a flat blue-grey wash — and an image you
          cannot see cannot be seen to move, which is exactly how this read.
        */}
        <div className={cn('absolute inset-0', layout.scrim)} aria-hidden />
        <div
          className="absolute inset-0 bg-gradient-to-t from-scrim/45 via-transparent to-transparent"
          aria-hidden
        />

        {/* Text, in front of the image. */}
        {/*
          The text is vertically centred, but the small frames occupy a band across the
          bottom of the stage. Without reserving that band the centred chapters printed
          their headline straight through the frames. The padding shifts the optical centre
          up by the height of the strip plus its offset.
        */}
        <div className="relative flex h-full min-h-[88vh] items-center lg:min-h-0">
          <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 lg:pb-[26vh] lg:pt-0">
            <div className={cn('flex max-w-xl flex-col', layout.text)}>
              <p
                data-reveal="meta"
                className="mb-6 font-mono text-[11px] uppercase tracking-[0.35em] text-white/60"
              >
                Chapter {chapter.numeral}
              </p>
              <SplitHeadline
                id={headingId}
                script={chapter.script}
                caps={chapter.caps}
                unit={REVEAL_UNIT[chapter.reveal]}
                align={chapter.align}
              />
              <p
                data-reveal="body"
                className={cn(
                  'mt-7 max-w-md text-[15px] leading-relaxed text-white/80',
                  chapter.align === 'center' && 'text-center',
                  chapter.align === 'right' && 'text-right',
                )}
              >
                {chapter.body}
              </p>
            </div>
          </div>
        </div>

        {/* Small frames, arriving one at a time. */}
        <div className="absolute inset-x-0 bottom-6 sm:bottom-8 lg:bottom-12">
          <div
            className={cn(
              'mx-auto flex w-full max-w-[1400px] gap-3 px-5 sm:gap-4 sm:px-8',
              layout.frames,
            )}
          >
            {chapter.small.map((slot) => (
              <div
                key={
                  slot.kind === 'photo' ? slot.key : slot.kind === 'video' ? slot.name : slot.subject
                }
                data-reveal="step"
                className="w-[28%] max-w-[13rem] will-change-transform sm:w-[22%] lg:w-[15%]"
              >
                <Frame
                  slot={slot}
                  eager={eager}
                  sizes="(min-width: 1024px) 15vw, 28vw"
                  className="aspect-[3/4] w-full rounded-sm shadow-float"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
