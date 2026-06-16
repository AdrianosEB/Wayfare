import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Photo } from '@/components/Photo';
import { PromptInput } from '@/components/PromptInput';
import { Chip } from '@/components/Chip';
import { images } from '@/lib/images';
import { navigate, planHref } from '@/lib/router';
import { MARKETING, EXAMPLE_PROMPTS } from '@/lib/content';

/**
 * Hero — full-bleed destination photo with a scrim for legibility, the display headline,
 * subhead, and a live prompt box that routes straight into the planner (autostart). The
 * three example prompts sit below as chips that seed the same flow. One primary action only.
 */
export function Hero() {
  const [value, setValue] = useState('');
  const reduce = useReducedMotion();

  const go = (seed: string) => {
    const trimmed = seed.trim();
    if (!trimmed) return;
    navigate(planHref({ seed: trimmed, autostart: true }));
  };

  const reveal = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay },
        };

  return (
    <section className="relative isolate -mt-16 flex min-h-[600px] items-center md:min-h-[88vh]">
      {/* Full-bleed photo (sits behind the transparent nav) + legibility scrim */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <Photo
          image={images.for('greece')}
          imageKey="greece"
          alt=""
          eager
          className="h-full w-full"
        />
        {/* darker on the left where the text sits, fading to clear on the right */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-scrim/80 via-scrim/45 to-transparent"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-scrim/35 to-transparent" aria-hidden />
      </div>

      <div className="mx-auto w-full max-w-site px-6 pb-20 pt-28">
        <div className="max-w-2xl">
          <motion.h1 {...reveal(0)} className="font-display text-display font-semibold text-white">
            {MARKETING.hero.headline}
          </motion.h1>
          <motion.p {...reveal(0.08)} className="mt-4 max-w-xl text-lg leading-relaxed text-white/90">
            {MARKETING.hero.subhead}
          </motion.p>

          <motion.div {...reveal(0.16)} className="mt-8 max-w-xl">
            <PromptInput
              variant="hero"
              value={value}
              onValueChange={setValue}
              onSubmit={go}
              placeholder={MARKETING.hero.promptPlaceholder}
            />
          </motion.div>

          <motion.ul {...reveal(0.24)} className="mt-4 flex flex-wrap gap-2" aria-label="Example trips">
            {EXAMPLE_PROMPTS.map((ex) => (
              <li key={ex.tag}>
                <Chip onClick={() => go(ex.prompt)} aria-label={`Plan: ${ex.label}`}>
                  {ex.label}
                </Chip>
              </li>
            ))}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
