import { useEffect, useRef } from 'react';
import type { RefinementRecord } from '@/types';
import { useSession } from '@/store/session';
import { cn } from '@/lib/cn';
import { formatDelta } from '@/lib/format';
import { MessageBubble } from './MessageBubble';
import { AgentStatusGroup } from './AgentStatusLine';
import { QuestionCardStack } from './QuestionCardStack';
import { SparkleIcon, ArrowRightIcon } from './icons';

/**
 * The conversation surface. Renders the flat message list — user/agent text, the batched
 * question cards, streamed status groups, and per-version summary recaps — and auto-scrolls
 * as new turns and status lines arrive.
 */
export function ChatThread() {
  const messages = useSession((s) => s.messages);
  const clarifyQuestions = useSession((s) => s.clarifyQuestions);
  const phase = useSession((s) => s.phase);
  const trip = useSession((s) => s.trip);
  const submitAnswers = useSession((s) => s.submitAnswers);
  const error = useSession((s) => s.error);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, phase]);

  const busy = phase === 'creating' || phase === 'planning';

  return (
    <div className="flex flex-col gap-4">
      {messages.map((m) => {
        switch (m.type) {
          case 'text':
            return (
              <MessageBubble key={m.id} role={m.role}>
                {m.text}
              </MessageBubble>
            );
          case 'questions':
            return (
              <QuestionCardStack
                key={m.id}
                questions={clarifyQuestions}
                busy={busy}
                onSubmit={submitAnswers}
              />
            );
          case 'statusGroup':
            return <AgentStatusGroup key={m.id} statuses={m.statuses} done={m.done} />;
          case 'summary':
            return (
              <SummaryCard
                key={m.id}
                refinement={m.refinement}
                summary={trip?.summary ?? ''}
              />
            );
          default:
            return null;
        }
      })}

      {error && (
        <div className="rounded-2xl border border-over/40 bg-over-soft px-4 py-3 text-sm text-over">
          {error}
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

function SummaryCard({
  refinement,
  summary,
}: {
  refinement?: RefinementRecord;
  summary: string;
}) {
  // Initial plan ready.
  if (!refinement) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary-soft/50 px-4 py-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg">
          <SparkleIcon className="text-sm" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Your trip is ready</p>
          {summary && <p className="text-sm text-muted">{summary}</p>}
        </div>
      </div>
    );
  }

  // RefinementRecord recap — what changed + budget delta (US-4.4).
  const currency = guessCurrency(refinement);
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-accent-soft/40 px-4 py-3">
      <p className="text-sm font-semibold text-ink">
        Done — {refinement.diff.length} change{refinement.diff.length === 1 ? '' : 's'}
      </p>
      <ul className="flex flex-col gap-1.5">
        {refinement.diff.map((d, i) => (
          <li
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="flex items-center gap-2 text-sm text-muted"
          >
            <ArrowRightIcon className="shrink-0 text-sm text-accent" />
            <span className="flex-1">{diffLabel(d)}</span>
            {typeof d.priceDelta === 'number' && d.priceDelta !== 0 && (
              <span
                className={cn(
                  'tabular text-xs font-semibold',
                  d.priceDelta < 0 ? 'text-under' : 'text-ink',
                )}
              >
                {formatDelta(d.priceDelta, currency)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {refinement.budgetDelta !== 0 && (
        <p className="tabular text-sm text-muted">
          Budget {refinement.budgetDelta > 0 ? 'up' : 'down'}{' '}
          <span
            className={cn(
              'font-semibold',
              refinement.budgetDelta < 0 ? 'text-under' : 'text-ink',
            )}
          >
            {formatDelta(refinement.budgetDelta, currency)}
          </span>
        </p>
      )}
    </div>
  );
}

function diffLabel(d: RefinementRecord['diff'][number]): string {
  const after = d.after as { name?: string; title?: string } | undefined;
  const before = d.before as { name?: string; title?: string } | undefined;
  const name = after?.name ?? after?.title;
  switch (d.op) {
    case 'add':
      return `Added: ${name ?? 'an item'}`;
    case 'remove':
      return `Removed: ${before?.name ?? before?.title ?? 'an item'}`;
    case 'replace':
      return name ? `Changed to ${name}` : 'Updated an item';
    default:
      return 'Updated';
  }
}

function guessCurrency(refinement: RefinementRecord): string {
  for (const d of refinement.diff) {
    const after = d.after as { price?: { currency?: string } } | undefined;
    if (after?.price?.currency) return after.price.currency;
  }
  return 'EUR';
}
