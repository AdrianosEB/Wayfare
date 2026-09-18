import { forwardRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { navigate, planHref } from '@/lib/router';

/**
 * The booking fields, shared by the modal panel and the in-page section near the foot of the
 * page, so the two can never drift apart.
 *
 * There is no date picker. What is booked here is a plan; the dates come out of the planning
 * conversation. A calendar would imply live availability this page has no source for, and
 * showing dates as bookable when they are not is the one thing the product promises not to
 * do. `when` is free text for that reason.
 */
export interface BookingFormProps {
  /** Distinguishes the two instances' input ids. */
  idPrefix: string;
  className?: string;
}

export const BookingForm = forwardRef<HTMLInputElement, BookingFormProps>(function BookingForm(
  { idPrefix, className },
  firstFieldRef,
) {
  const [seed, setSeed] = useState('');
  const [travellers, setTravellers] = useState('2');
  const [when, setWhen] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = seed.trim();
    if (!trimmed) return;
    const detail = [trimmed, `${travellers} travelling`, when.trim()].filter(Boolean).join(', ');
    navigate(planHref({ seed: detail, autostart: true }));
  };

  const field =
    'w-full rounded-sm border border-border bg-transparent px-3 py-2.5 text-ink placeholder:text-ink-3 focus-visible:border-azure-500 focus-visible:outline-none';

  return (
    <form onSubmit={submit} className={cn('flex flex-col gap-6', className)}>
      <label className="flex flex-col gap-2" htmlFor={`${idPrefix}-seed`}>
        <span className="text-sm font-medium text-ink">Where, or what kind of trip</span>
        <input
          id={`${idPrefix}-seed`}
          ref={firstFieldRef}
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          required
          placeholder="Relaxed week in the Greek islands"
          className={field}
        />
        <span className="text-xs text-ink-3">One sentence is enough.</span>
      </label>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <label className="flex flex-col gap-2" htmlFor={`${idPrefix}-travellers`}>
          <span className="text-sm font-medium text-ink">Travellers</span>
          <select
            id={`${idPrefix}-travellers`}
            value={travellers}
            onChange={(e) => setTravellers(e.target.value)}
            className={cn(field, 'bg-bg')}
          >
            {['1', '2', '3', '4', '5', '6', '7', '8+'].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2" htmlFor={`${idPrefix}-when`}>
          <span className="text-sm font-medium text-ink">When</span>
          <input
            id={`${idPrefix}-when`}
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            placeholder="Flexible"
            className={field}
          />
          <span className="text-xs text-ink-3">Free text — “flexible”, “March”.</span>
        </label>
      </div>

      <button
        type="submit"
        className="mt-1 self-start rounded-pill bg-azure-500 px-6 py-3 font-semibold text-white transition hover:bg-azure-600 focus-visible:ring-2"
      >
        Start planning →
      </button>

      <p className="max-w-prose text-xs leading-relaxed text-ink-3">
        This opens your plan in the planner, where every price shows its source and date.
        Nothing is charged and nothing is reserved at this step.
      </p>
    </form>
  );
});
