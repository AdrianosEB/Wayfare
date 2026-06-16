import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

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
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  width?: string;
}) {
  return (
    <section id={id} className={cn('px-6 py-16 sm:py-24', className)}>
      <div className={cn('mx-auto', width)}>{children}</div>
    </section>
  );
}
