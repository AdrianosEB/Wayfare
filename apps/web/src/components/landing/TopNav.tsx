import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/components/Button';
import { AuthControls } from '@/components/AuthControls';
import { navigate, planHref } from '@/lib/router';
import { MARKETING } from '@/lib/content';

/**
 * Sticky marketing nav. Transparent over the hero at the very top; becomes white with a
 * hairline border once the page scrolls. Below `md` it collapses into a hamburger that
 * reveals a slide-down menu.
 *
 * Minimal by design: the logo, a single "Explore" jump-link to the trips hub, the "Plan my
 * trip" CTA, and auth. The rest of the marketing content (how it works, trip types) is still
 * explored by scrolling the page — Explore is the one destination worth a tab.
 *
 * Pages without a dark full-bleed hero behind the nav (e.g. `/pricing`) must pass
 * `alwaysSolid` — otherwise the transparent-at-top state renders white text on the white
 * page background and the bar reads as invisible until you scroll down.
 */

export function TopNav({ alwaysSolid = false }: { alwaysSolid?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (alwaysSolid) return;
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [alwaysSolid]);

  // On a solid (white) bar the wordmark/links go dark; over the hero they stay light.
  const solid = alwaysSolid || scrolled || open;

  const goPlan = () => {
    setOpen(false);
    navigate(planHref());
  };

  const goExplore = () => {
    setOpen(false);
    navigate('/explore');
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 transition-colors duration-200',
        solid ? 'border-b border-border bg-bg/95 backdrop-blur' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-site items-center justify-between px-6">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="rounded-md focus-visible:ring-2"
          aria-label="Wayfare home"
        >
          <Wordmark onLight={!solid} />
        </a>

        {/* Desktop: one Explore jump-link, then the CTA + auth. */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          <button
            type="button"
            onClick={goExplore}
            className={cn(
              'inline-flex h-9 items-center rounded-pill px-3.5 text-sm font-medium transition focus-visible:ring-2',
              solid ? 'text-ink hover:bg-surface' : 'text-white hover:bg-white/10',
            )}
          >
            Explore
          </button>
          <Button onClick={goPlan}>
            {MARKETING.hero.cta}
          </Button>
          <AuthControls onLight={!solid} className="ml-1" />
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-pill transition focus-visible:ring-2 md:hidden',
            solid ? 'text-ink hover:bg-surface' : 'text-white hover:bg-white/10',
          )}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <Burger open={open} />
        </button>
      </div>

      {/* Mobile slide-down menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-border bg-bg md:hidden"
          >
            <nav className="mx-auto flex max-w-site flex-col gap-1 px-6 py-4" aria-label="Mobile">
              <Button className="w-full" size="lg" onClick={goPlan}>
                {MARKETING.hero.cta}
              </Button>
              <button
                type="button"
                onClick={goExplore}
                className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-pill text-sm font-medium text-ink transition hover:bg-surface focus-visible:ring-2"
              >
                Explore trips
              </button>
              <div className="mt-2 flex items-center justify-center border-t border-border pt-3">
                <AuthControls />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Burger({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      {open ? (
        <path d="M6 6l12 12M18 6 6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}
