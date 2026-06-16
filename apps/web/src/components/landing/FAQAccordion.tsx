import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDownIcon } from '@/components/icons';
import { FAQ } from '@/lib/content';
import { Section } from './_shared';

/**
 * FAQ — an accordion with real disclosure semantics (button headers with aria-expanded /
 * aria-controls), a smooth height animation, hairline dividers, and an azure chevron that
 * rotates. One panel open at a time.
 */
export function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section width="max-w-prose">
      <h2 className="text-center font-display text-3xl font-semibold text-ink">Questions, answered</h2>

      <div className="mt-8 divide-y divide-border border-y border-border">
        {FAQ.map((item, i) => (
          <FaqRow
            key={item.q}
            q={item.q}
            a={item.a}
            open={open === i}
            onToggle={() => setOpen((cur) => (cur === i ? null : i))}
          />
        ))}
      </div>
    </Section>
  );
}

function FaqRow({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  const reduce = useReducedMotion();
  const base = useId();
  const headerId = `${base}-h`;
  const panelId = `${base}-p`;

  return (
    <div>
      <h3>
        <button
          type="button"
          id={headerId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 py-5 text-left focus-visible:ring-2"
        >
          <span className="font-medium text-ink">{q}</span>
          <ChevronDownIcon
            className={`shrink-0 text-xl text-azure-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={headerId}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 pr-8 leading-relaxed text-ink-2">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
