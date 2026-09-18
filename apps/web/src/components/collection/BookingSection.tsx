import { BookingForm } from './BookingForm';

/**
 * The real booking section near the foot of the page, so anyone who reads to the end lands
 * on it rather than having to scroll back up to the navbar.
 *
 * It is the same `BookingForm` the modal uses — one implementation, so the two can never
 * drift out of sync.
 */
export function BookingSection() {
  return (
    <section
      id="book"
      aria-labelledby="book-heading"
      className="mx-auto w-full max-w-[1400px] px-5 py-24 sm:px-8 sm:py-32"
    >
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.35em] text-ink-3">
            Book
          </p>
          <h2 id="book-heading" className="text-ink">
            <span className="block font-serif text-[clamp(2.4rem,5.2vw,4rem)] italic leading-[1.05]">
              Start with
            </span>
            <span className="mt-1 block font-display text-[clamp(1.9rem,4.2vw,3.1rem)] font-semibold uppercase leading-[1.06] tracking-[0.06em]">
              <span className="block">ONE</span>
              <span className="block">SENTENCE</span>
            </span>
          </h2>
        </div>
        <div className="lg:col-span-7">
          <BookingForm idPrefix="section" />
        </div>
      </div>
    </section>
  );
}
