import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { revealContainer, revealItem, revealViewport } from '@/lib/motion';

/**
 * Small shared helpers for the marketing landing sections — price formatting and the
 * standard section wrapper that enforces the 64px-mobile / 96px-desktop vertical rhythm
 * inside a centered `max-w-site` container.
 */

const SYMBOL: Record<string, string> = { EUR: '€', GBP: '£', USD: '$' };

/** Symbol-first, grouped, no decimals — e.g. `€2,410`. Pair with the `.tnum` class. */
export function formatFrom(amount: number, currency: string): string {
  const symbol = SYMBOL[currency] ?? '';
  return `${symbol}${Math.round(amount).toLocaleString('en-US')}`;
}

/** Centered marketing section with consistent rhythm. */
export function Section({
  id,
  className,
  children,
  width = 'max-w-site',
  glow = false,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  width?: string;
  /** Paint a soft azure wash behind the section. For white sections that read flat. */
  glow?: boolean;
}) {
  return (
    <section id={id} className={cn('relative isolate px-6 py-16 sm:py-24', className)}>
      {glow && (
        <div className="section-glow pointer-events-none absolute inset-0 -z-10" aria-hidden />
      )}
      <div className={cn('mx-auto', width)}>{children}</div>
    </section>
  );
}

/**
 * A single element that rises into place when scrolled to. For section headings and other
 * one-off blocks; use `RevealGroup` when several children should stagger.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={revealItem}
      initial="hidden"
      whileInView="show"
      viewport={revealViewport}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggers its children in. Children must be `motion` elements carrying
 * `variants={revealItem}` — variant state propagates through context, so ordinary wrapper
 * elements in between are fine.
 */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={revealContainer}
      initial="hidden"
      whileInView="show"
      viewport={revealViewport}
      className={className}
    >
      {children}
    </motion.div>
  );
}
