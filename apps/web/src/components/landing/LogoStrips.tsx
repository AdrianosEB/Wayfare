import { PARTNERS, PRESS, MARKETING } from '@/lib/content';
import { Section } from './_shared';

/**
 * Trust strips — greyscale partner text-logos with a caption, and an "As seen in" press row.
 * Static placeholder logos this pass (text rendered in a muted, grayscale style).
 */
export function PartnerLogoRow() {
  return (
    <Section className="border-t border-border">
      <p className="text-center text-sm text-ink-3">{MARKETING.partnersCaption}</p>
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {PARTNERS.map((name) => (
          <li
            key={name}
            className="font-display text-lg font-semibold text-ink-3/80 grayscale transition hover:text-ink-2"
          >
            {name}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function PressStrip() {
  return (
    <section className="px-6 pb-16 sm:pb-20">
      <div className="mx-auto max-w-site">
        <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-ink-3">
          As seen in
        </p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {PRESS.map((name) => (
            <li key={name} className="text-base font-semibold text-ink-3/70 grayscale">
              {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
