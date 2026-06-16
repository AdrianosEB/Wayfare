import type { Freshness, Money } from '@/types';

/**
 * Money & freshness formatting. All prices render with tabular figures (the `.tabular`
 * utility on the element) so budget columns align; this module only produces the strings.
 */

const currencySymbols: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  JPY: '¥',
};

/** "€2,410" — no decimals when the amount is whole, otherwise 2dp. */
export function formatMoney(money: Money, opts: { sign?: boolean } = {}): string {
  const { amount, currency } = money;
  return formatAmount(amount, currency, opts);
}

export function formatAmount(
  amount: number,
  currency: string,
  opts: { sign?: boolean } = {},
): string {
  const whole = Number.isInteger(amount);
  try {
    const formatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
      signDisplay: opts.sign ? 'exceptZero' : 'auto',
    }).format(amount);
    return formatted;
  } catch {
    // Unknown ISO code → fall back to a symbol map.
    const sym = currencySymbols[currency] ?? `${currency} `;
    const n = Math.abs(amount).toLocaleString(undefined, {
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    });
    const prefix = amount < 0 ? '−' : opts.sign ? '+' : '';
    return `${prefix}${sym}${n}`;
  }
}

/** A signed delta like "+€145" / "−€85" using a real minus glyph. */
export function formatDelta(amount: number, currency: string): string {
  return formatAmount(amount, currency, { sign: true });
}

export const currencySymbol = (currency: string): string =>
  currencySymbols[currency] ?? currency;

/**
 * Human freshness suffix for the SourceChip. The chip's primary text is always
 * `source.label` (e.g. "Estimated price", "Amadeus · 2h ago"); this only adds a relative
 * recency hint for live/cached prices and is never the string "mock".
 */
export function freshnessNote(freshness: Freshness, fetchedAt?: string): string | null {
  switch (freshness) {
    case 'live':
      return fetchedAt ? relativeTime(fetchedAt) : 'just now';
    case 'cached':
      return fetchedAt ? relativeTime(fetchedAt) : 'cached';
    case 'estimate':
    case 'mock':
      // No recency claim for non-real prices — the label already says what it is.
      return null;
  }
}

/** Short relative time like "2h ago", "just now", "3d ago". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.round((now - then) / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  return `${mo}mo ago`;
}

/** "Aug 23 → 31" style date ranges for itinerary headers. */
export function formatDateRange(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) return `${month(s)} ${s.getDate()} – ${e.getDate()}`;
  return `${month(s)} ${s.getDate()} – ${month(e)} ${e.getDate()}`;
}

/** "Sat, Aug 23" for day cards. */
export function formatDayDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "07:10" from an ISO instant (UTC, matching the fixtures' Z timestamps). */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  });
}

/** "350 m" / "1.2 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

/** Flight duration "5h 55m" from depart/arrive ISO. */
export function formatDuration(departISO: string, arriveISO: string): string {
  const ms = new Date(arriveISO).getTime() - new Date(departISO).getTime();
  if (Number.isNaN(ms) || ms <= 0) return '';
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Title-cases a budget category / vibe token: "near_beach" → "Near beach". */
export function humanize(token: string): string {
  const s = token.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
