import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { pulseChanged } from '@/lib/motion';
import { SparkleIcon } from './icons';

/**
 * Marks what a refinement changed (US-4.4). `ChangedBadge` is the little "Updated" tag;
 * `DiffHighlight` wraps a card/item with an accent outline + a one-shot pulse when it's in
 * the current refinement's changed set. Honors prefers-reduced-motion (outline only).
 */

export function ChangedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5',
        'text-[11px] font-semibold text-accent',
        className,
      )}
    >
      <SparkleIcon className="text-[12px]" />
      Updated
    </span>
  );
}

export interface DiffHighlightProps {
  changed: boolean;
  children: ReactNode;
  className?: string;
  /** Tap-to-trace from a budget line: a calm primary ring (no pulse). */
  focused?: boolean;
  /** Re-trigger the pulse when this key changes (e.g. the refinement version). */
  pulseKey?: string | number;
}

export function DiffHighlight({
  changed,
  children,
  className,
  focused,
  pulseKey,
}: DiffHighlightProps) {
  const reduce = useReducedMotion();

  if (!changed) {
    return (
      <div
        className={cn(
          'rounded-2xl ring-2 ring-transparent transition-shadow',
          focused && 'ring-primary/50',
          className,
        )}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      key={pulseKey}
      variants={reduce ? undefined : pulseChanged}
      initial="idle"
      animate={reduce ? undefined : 'pulse'}
      className={cn('rounded-2xl ring-2 ring-accent/60', focused && 'ring-primary/60', className)}
    >
      {children}
    </motion.div>
  );
}
