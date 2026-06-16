import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { StatusStep } from '@/types';
import type { StatusLine } from '@/store/session';
import { cn } from '@/lib/cn';
import {
  ActivityIcon,
  BedIcon,
  CheckIcon,
  ChevronDownIcon,
  MapPinIcon,
  PlaneIcon,
  SparkleIcon,
  TagIcon,
} from './icons';

/**
 * The agent "thinking out loud" (NFR-2): streamed status lines with a typing-style reveal.
 * While running, the latest line pulses; earlier lines sit quietly above it. When the run
 * completes the whole group collapses to a single "done" line, expandable to see the steps.
 */

const stepIcon: Record<StatusStep, typeof PlaneIcon> = {
  resolve: MapPinIcon,
  search_flights: PlaneIcon,
  search_stays: BedIcon,
  search_activities: ActivityIcon,
  compute_budget: TagIcon,
  assemble: SparkleIcon,
};

export interface AgentStatusGroupProps {
  statuses: StatusLine[];
  done: boolean;
}

export function AgentStatusGroup({ statuses, done }: AgentStatusGroupProps) {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  if (statuses.length === 0 && !done) {
    return <ThinkingLine label="Thinking…" />;
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-surface/60 px-3 py-2 ring-1 ring-border">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-2 text-left text-sm text-muted hover:text-ink"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-under-soft text-under">
            <CheckIcon className="text-[13px]" />
          </span>
          <span className="flex-1">
            Planned in {statuses.length} step{statuses.length === 1 ? '' : 's'}
          </span>
          <ChevronDownIcon
            className={cn('text-base transition-transform', expanded && 'rotate-180')}
          />
        </button>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.ul
              initial={reduce ? undefined : { height: 0, opacity: 0 }}
              animate={reduce ? undefined : { height: 'auto', opacity: 1 }}
              exit={reduce ? undefined : { height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {statuses.map((s, i) => (
                <li
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  className="flex items-center gap-2 py-1 pl-7 text-xs text-faint"
                >
                  <StepGlyph step={s.step} className="text-sm" />
                  {s.message}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {statuses.map((s, i) => {
        const isLatest = i === statuses.length - 1;
        return (
          <AgentStatusLine
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            step={s.step}
            message={s.message}
            active={isLatest}
          />
        );
      })}
    </div>
  );
}

export function AgentStatusLine({
  step,
  message,
  active,
}: {
  step: StatusStep;
  message: string;
  active: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
      animate={{ opacity: active ? 1 : 0.55, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2 text-sm text-muted"
    >
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          active ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-faint',
        )}
      >
        <StepGlyph step={step} className="text-sm" />
      </span>
      <span className={cn(active && 'text-ink')}>{message}</span>
      {active && <TypingDots />}
    </motion.div>
  );
}

function StepGlyph({ step, className }: { step: StatusStep; className?: string }) {
  const Icon = stepIcon[step] ?? SparkleIcon;
  return <Icon className={className} />;
}

function ThinkingLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-primary">
        <SparkleIcon className="text-sm" />
      </span>
      {label}
      <TypingDots />
    </div>
  );
}

function TypingDots() {
  const reduce = useReducedMotion();
  if (reduce) return <span className="text-faint">…</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-primary/70"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}
