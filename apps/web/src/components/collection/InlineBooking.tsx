import { cn } from '@/lib/cn';

/**
 * A quiet booking prompt at a chapter boundary. There are exactly two on the page.
 *
 * Deliberately not a filled button — these read as an offer, not a nag. With Book gone from
 * the bar, these two prompts and the real booking section at the end of the page are how the
 * panel is reached.
 */
export function InlineBooking({
  line,
  onBook,
  className,
}: {
  line: string;
  onBook: () => void;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1400px] px-5 sm:px-8', className)}>
      <div className="flex flex-col gap-4 border-y border-border py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10">
        <p className="font-serif text-xl italic text-ink-2 sm:text-2xl">{line}</p>
        <button
          type="button"
          onClick={onBook}
          className="self-start whitespace-nowrap border-b border-border pb-1 text-sm uppercase tracking-[0.18em] text-ink transition-colors hover:border-azure-500 focus-visible:ring-2 sm:self-auto"
        >
          Book a trip
        </button>
      </div>
    </div>
  );
}
