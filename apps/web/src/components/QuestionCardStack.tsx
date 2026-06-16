import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { AnswerValue, AnswersRequest, ClarifyQuestion } from '@/types';
import { cn } from '@/lib/cn';
import { cardIn, staggerContainer } from '@/lib/motion';
import {
  ChipSelect,
  CityAutocomplete,
  CurrencyInput,
  ShortText,
  SkipControl,
  Stepper,
} from './inputs';

/**
 * The batched clarifying questions (US-2.2): a card stack of ≤4, each with the
 * lowest-friction input and a visible Skip showing its default (US-2.3). Answerable in any
 * order; one "Plan it" CTA lights up once required questions are satisfied or skipped.
 */
export interface QuestionCardStackProps {
  questions: ClarifyQuestion[];
  busy?: boolean;
  onSubmit: (body: AnswersRequest) => void;
}

interface CardState {
  value?: AnswerValue;
  skipped: boolean;
}

export function QuestionCardStack({ questions, busy, onSubmit }: QuestionCardStackProps) {
  const reduce = useReducedMotion();
  const [state, setState] = useState<Record<string, CardState>>({});
  const [attempted, setAttempted] = useState(false);

  const update = (id: string, patch: Partial<CardState>) =>
    setState((s) => ({ ...s, [id]: { skipped: false, ...s[id], ...patch } }));

  const isAnswered = (q: ClarifyQuestion): boolean => {
    const cs = state[q.id];
    if (!cs || cs.skipped) return cs?.skipped ?? false;
    return hasValue(cs.value);
  };

  // A required (non-skippable) question must have a value; skippable ones are always OK
  // (untouched → skipped with their default on submit).
  const ready = useMemo(
    () => questions.every((q) => q.skippable || (state[q.id] && hasValue(state[q.id]?.value))),
    [questions, state],
  );

  const submit = () => {
    setAttempted(true);
    if (!ready) return;

    const answers: Record<string, AnswerValue> = {};
    const skipped: string[] = [];
    for (const q of questions) {
      const cs = state[q.id];
      if (cs && !cs.skipped && hasValue(cs.value)) {
        answers[q.id] = cs.value as AnswerValue;
      } else {
        // Skipped explicitly, or an untouched skippable question → take its default.
        skipped.push(q.id);
      }
    }
    onSubmit({ answers, skipped });
  };

  return (
    <motion.div
      variants={reduce ? undefined : staggerContainer}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'show'}
      className="flex flex-col gap-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {questions.map((q) => {
          const cs = state[q.id] ?? { skipped: false };
          const missing = attempted && !q.skippable && !isAnswered(q);
          return (
            <motion.div
              key={q.id}
              variants={reduce ? undefined : cardIn}
              className={cn(
                'flex flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-card transition',
                missing ? 'border-over/60' : 'border-border',
                cs.skipped && 'opacity-70',
              )}
            >
              <p className="text-sm font-semibold text-ink">{q.question}</p>

              {!cs.skipped && (
                <div className="min-h-[2.5rem]">
                  <QuestionInput
                    question={q}
                    value={cs.value}
                    onChange={(value) => update(q.id, { value, skipped: false })}
                  />
                </div>
              )}

              {q.skippable && (
                <SkipControl
                  skipped={cs.skipped}
                  skipDefault={q.skipDefault}
                  onToggle={(skipped) => update(q.id, { skipped, value: undefined })}
                />
              )}
              {missing && <span className="text-xs text-over">This one’s needed to plan.</span>}
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition',
            'focus-visible:ring-2 disabled:opacity-50',
            ready
              ? 'bg-primary text-primary-fg shadow-card hover:brightness-105 active:scale-95'
              : 'bg-surface-2 text-muted hover:text-ink',
          )}
        >
          {busy ? 'Planning…' : 'Plan it'}
        </button>
        {!ready && (
          <span className="text-xs text-faint">Answer or skip each card to start.</span>
        )}
      </div>
    </motion.div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: ClarifyQuestion;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
}) {
  switch (question.format) {
    case 'chips':
      return (
        <ChipSelect
          options={question.options ?? []}
          value={value as string | undefined}
          onChange={(v) => onChange(v)}
        />
      );
    case 'multiselect':
      return (
        <ChipSelect
          multi
          options={question.options ?? []}
          value={value as string[] | undefined}
          onChange={(v) => onChange(v)}
        />
      );
    case 'stepper':
      return (
        <Stepper
          value={value as Parameters<typeof Stepper>[0]['value']}
          onChange={(v) => onChange(v)}
        />
      );
    case 'city':
      return (
        <CityAutocomplete
          value={value as string | undefined}
          placeholder={question.placeholder}
          onChange={(v) => onChange(v)}
        />
      );
    case 'currency':
      return (
        <CurrencyInput
          value={value as Parameters<typeof CurrencyInput>[0]['value']}
          placeholder={question.placeholder}
          onChange={(v) => onChange(v)}
        />
      );
    case 'text':
    default:
      return (
        <ShortText
          value={value as string | undefined}
          placeholder={question.placeholder}
          onChange={(v) => onChange(v)}
        />
      );
  }
}

function hasValue(v: AnswerValue | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') {
    if ('adults' in v) return v.adults >= 1;
    if ('amount' in v) return v.amount > 0;
  }
  return true;
}
