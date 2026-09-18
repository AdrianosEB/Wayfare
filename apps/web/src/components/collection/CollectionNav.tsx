import { useEffect, useState, type RefObject } from 'react';
import { cn } from '@/lib/cn';
import { Wordmark } from '@/components/Wordmark';
import { AuthControls } from '@/components/AuthControls';
import { navigate, planHref } from '@/lib/router';
import { MARKETING } from '@/lib/content';

/** Height of the fixed bar, in px — the line the sentinel has to cross. */
const BAR_HEIGHT_PX = 64;

/**
 * Fixed bar, present at every breakpoint.
 *
 * This is the site nav, not a bespoke one: it uses the same <Wordmark> and <AuthControls> as
 * TopNav, so the home page carries the familiar Explore / Plan my trip / Log in / Sign up
 * controls. They are light over the footage and go dark once you scroll past the hero.
 *
 * Every control in the bar is the same 36px height, so the row has one baseline instead of
 * the 36/44/38 mix it had when "Plan my trip" and "Sign up" were both full-size primaries.
 *
 * Booking is not in the bar. It is reached from the two chapter-boundary prompts and the real
 * booking section at the end of the page.
 *
 * Only the background and border animate when you pass the first chapter — the bar never
 * changes its positioning, height or layout, so nothing below it shifts and the logo and
 * buttons never move under the cursor mid-click.
 */
export function CollectionNav({
  contentRef,
}: {
  /** Wrapper around everything after the hero. Solid whenever any of it is under the bar. */
  contentRef: RefObject<HTMLElement>;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /*
   * Observe the whole post-hero content block, not a thin sentinel at the hero's end.
   *
   * IntersectionObserver only notifies when `isIntersecting` actually changes. A 1px
   * sentinel goes from "below the viewport" to "above the viewport" — false to false — so
   * jumping past it (an anchor link, a restored scroll position) fires no callback at all
   * and the bar stays stuck in its previous state. The content block spans the rest of the
   * page, so it is intersecting for every scroll position after the hero and cannot be
   * skipped over.
   *
   * The negative top margin pulls the root's edge down to the underside of the bar, so the
   * state flips exactly when content reaches it.
   */
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(Boolean(entry?.isIntersecting)),
      { rootMargin: `-${BAR_HEIGHT_PX}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [contentRef]);

  /** Shared geometry: one height for every control in the bar. */
  const control = 'inline-flex h-9 items-center rounded-pill text-sm font-medium transition focus-visible:ring-2';

  /*
   * Explore is a lighter blue than the ink it used to share with the rest of the bar.
   * On the light state that is azure-600 rather than azure-700 — brighter, and still 4.7:1
   * on this background, so lightening it does not cost legibility.
   */
  const linkClass = cn(
    control,
    'px-3.5',
    scrolled ? 'text-azure-600 hover:bg-azure-50' : 'text-azure-100 hover:bg-white/10',
  );

  const go = (href: string) => () => {
    setMenuOpen(false);
    navigate(href);
  };

  return (
    <header
      className={cn(
        // Only colour and blur transition. Position, height and layout never change, so
        // nothing below the bar shifts and the buttons never move under the cursor.
        'fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-500',
        scrolled || menuOpen
          ? 'border-b border-border bg-surface-2/85 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-5 sm:px-8">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="rounded-md focus-visible:ring-2"
          aria-label="Wayfare home"
        >
          <Wordmark onLight={!scrolled} />
        </a>

        <div className="flex items-center gap-1.5">
          <nav className="hidden items-center gap-1.5 md:flex" aria-label="Primary">
            <button type="button" onClick={go('/explore')} className={linkClass}>
              Explore
            </button>

            {/*
              The primary action, in the lighter blue: a pale azure fill with azure-700 text
              instead of white-on-azure-500. It reads as the softer blue asked for and, at
              4.9:1, is actually more legible than the white-on-saturated pill it replaces.
            */}
            <button
              type="button"
              onClick={go(planHref())}
              className={cn(
                control,
                'border px-4 font-semibold',
                scrolled
                  ? 'border-azure-200 bg-azure-100 text-azure-700 hover:bg-azure-200'
                  : 'border-white/30 bg-azure-100/90 text-azure-700 hover:bg-azure-100',
              )}
            >
              {MARKETING.hero.cta}
            </button>

            <AuthControls onLight={!scrolled} />
          </nav>

          {/* Below md the primary nav collapses in here. */}
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-pill transition focus-visible:ring-2 md:hidden',
              scrolled ? 'text-ink hover:bg-surface' : 'text-white hover:bg-white/10',
            )}
          >
            <Burger open={menuOpen} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="site-menu"
          aria-label="Primary"
          className="border-t border-border bg-surface-2/95 backdrop-blur-md md:hidden"
        >
          <ul className="mx-auto max-w-[1400px] px-5 py-3 sm:px-8">
            <li>
              <button
                type="button"
                onClick={go('/explore')}
                className="flex h-11 w-full items-center text-sm font-medium text-azure-600"
              >
                Explore
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={go(planHref())}
                className="flex h-11 w-full items-center text-sm font-semibold text-azure-700"
              >
                {MARKETING.hero.cta}
              </button>
            </li>
            <li className="pt-2">
              <AuthControls />
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

/** Two bars that cross into an X — same affordance TopNav uses. */
function Burger({ open }: { open: boolean }) {
  return (
    <span aria-hidden className="relative block h-3.5 w-4">
      <span
        className={cn(
          'absolute left-0 block h-[1.5px] w-4 bg-current transition-transform duration-200',
          open ? 'top-[6px] rotate-45' : 'top-0.5',
        )}
      />
      <span
        className={cn(
          'absolute left-0 block h-[1.5px] w-4 bg-current transition-transform duration-200',
          open ? 'top-[6px] -rotate-45' : 'top-[11px]',
        )}
      />
    </span>
  );
}
