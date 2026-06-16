import type { BudgetCategory, Budget } from '@/types';

/** Per-category presentation. `bar` is a Tailwind bg- token for the stacked budget bar. */
export const CATEGORY_META: Record<
  BudgetCategory,
  { label: string; bar: string; chip: string }
> = {
  flights: { label: 'Flights', bar: 'bg-primary', chip: 'text-primary' },
  stay: { label: 'Stay', bar: 'bg-accent', chip: 'text-accent' },
  activities: { label: 'Activities', bar: 'bg-under', chip: 'text-under' },
  transit: { label: 'Transit', bar: 'bg-ontarget', chip: 'text-ontarget' },
  food: { label: 'Food', bar: 'bg-primary/60', chip: 'text-primary' },
  buffer: { label: 'Buffer', bar: 'bg-faint', chip: 'text-faint' },
};

export const CATEGORY_ORDER: BudgetCategory[] = [
  'flights',
  'stay',
  'activities',
  'transit',
  'food',
  'buffer',
];

/** Maps a budget status to its semantic token + plain-language label (color is never the
 *  only signal — text/icon accompany it, per the a11y target). */
export function statusMeta(status: Budget['status']) {
  switch (status) {
    case 'under':
      return { token: 'under', label: 'Under budget', tone: 'text-under', soft: 'bg-under-soft' } as const;
    case 'on_target':
      return { token: 'ontarget', label: 'On target', tone: 'text-ontarget', soft: 'bg-ontarget-soft' } as const;
    case 'over':
      return { token: 'over', label: 'Over budget', tone: 'text-over', soft: 'bg-over-soft' } as const;
  }
}
