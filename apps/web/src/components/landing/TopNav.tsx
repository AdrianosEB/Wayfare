import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/components/Button';
import { navigate, planHref } from '@/lib/router';
import { MARKETING } from '@/lib/content';

/**
 * Sticky marketing nav. Transparent over the hero at the very top; becomes white with a
 * hairline border once the page scrolls. Below `md` the links collapse into a hamburger
 * that reveals a slide-down menu.
 */

const LINKS: { label: string; href: string }[] = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Trip types', href: '#trip-types' },
  { label: 'Pricing', href: '#pricing' },
];

export function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // On a solid (white) bar the wordmark/links go dark; over the hero they stay light.
  const solid = scrolled || open;

  const goPlan = () => {
    setOpen(false);
    navigate(planHref());
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

        {/* Desktop links */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-pill px-3.5 py-2 text-sm font-medium transition focus-visible:ring-2',
                solid ? 'text-ink-2 hover:bg-surface hover:text-ink' : 'text-white/90 hover:bg-white/10 hover:text-white',
              )}
            >
              {l.label}
            </a>
          ))}
          <Button className="ml-2" onClick={goPlan}>
            {MARKETING.hero.cta}
          </Button>
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
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-base font-medium text-ink hover:bg-surface focus-visible:ring-2"
                >
                  {l.label}
                </a>
              ))}
              <Button className="mt-2 w-full" size="lg" onClick={goPlan}>
                {MARKETING.hero.cta}
              </Button>
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
