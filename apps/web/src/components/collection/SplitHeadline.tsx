import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Align } from './chapters';

/**
 * A chapter headline, split into the units its reveal animates — letters, words, or whole
 * lines. See `REVEAL_UNIT` in chapters.ts for which style wants which.
 *
 * Accessibility is the whole difficulty with split text. Broken into one element per
 * character, the accessible name becomes "T h e   a r t" and text selection produces the
 * same mess. So the real string goes on the heading as `aria-label` and every visual
 * fragment is `aria-hidden`: screen readers get one clean phrase, and the pieces are free
 * to animate.
 */

export type SplitUnit = 'letter' | 'word' | 'line';

const ALIGN_TEXT: Record<Align, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/** Words stay whole inside `inline-block` wrappers so a line never breaks mid-letter. */
function splitWords(text: string, unit: SplitUnit, keyPrefix: string): ReactNode[] {
  return text.split(' ').flatMap((word, wordIndex, all) => {
    const nodes: ReactNode[] = [
      <span
        key={`${keyPrefix}-w${wordIndex}`}
        {...(unit === 'word' ? { 'data-reveal': 'word' } : {})}
        className="inline-block whitespace-nowrap will-change-transform"
      >
        {unit === 'letter'
          ? [...word].map((char, charIndex) => (
              <span
                key={`${keyPrefix}-w${wordIndex}-c${charIndex}`}
                data-reveal="letter"
                className="inline-block will-change-transform"
              >
                {char}
              </span>
            ))
          : word}
      </span>,
    ];
    // A real space between words rather than a margin — margins collapse differently per
    // font and would drift the tracking.
    if (wordIndex < all.length - 1) {
      nodes.push(<span key={`${keyPrefix}-s${wordIndex}`}> </span>);
    }
    return nodes;
  });
}

/**
 * For the `wipe` style: each line rides inside its own clipping box.
 *
 * The mask needs vertical slack or descenders get sliced off — the padding is cancelled by
 * an equal negative margin, so the line box is unchanged and the rhythm of the headline
 * does not shift between styles.
 */
function Line({ children, masked }: { children: ReactNode; masked: boolean }) {
  if (!masked) return <span className="block">{children}</span>;
  return (
    <span className="block overflow-hidden pb-[0.14em] -mb-[0.14em]">
      <span data-reveal="line" className="block will-change-transform">
        {children}
      </span>
    </span>
  );
}

export function SplitHeadline({
  id,
  script,
  caps,
  unit,
  align,
}: {
  id: string;
  /** The serif italic phrase. */
  script: string;
  /** The wide-tracked caps lines, broken by hand — one word per line. */
  caps: string[];
  unit: SplitUnit;
  align: Align;
}) {
  const masked = unit === 'line';

  return (
    <h2 id={id} aria-label={`${script} ${caps.join(' ')}`} className={cn('text-white', ALIGN_TEXT[align])}>
      <span aria-hidden className="block font-serif text-[clamp(2.4rem,5.4vw,4.2rem)] italic leading-[1.03]">
        <Line masked={masked}>{splitWords(script, unit, 'script')}</Line>
      </span>
      <span
        aria-hidden
        className="mt-1 block font-display text-[clamp(1.9rem,4.4vw,3.2rem)] font-semibold uppercase leading-[1.05] tracking-[0.06em]"
      >
        {caps.map((word, i) => (
          <Line key={word} masked={masked}>
            {splitWords(word, unit, `caps${i}`)}
          </Line>
        ))}
      </span>
    </h2>
  );
}
