/**
 * Date helpers. All dates are `YYYY-MM-DD` (calendar) or ISO-8601 UTC (timestamps). Date math
 * is pure and deterministic — no `Date.now()` in planning paths (NFR-6).
 */

const MS_DAY = 86400000;

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

export function formatYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  return formatYmd(new Date(parseYmd(ymd).getTime() + days * MS_DAY));
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((parseYmd(checkOut).getTime() - parseYmd(checkIn).getTime()) / MS_DAY);
}

/** Day-of-month anchor for "early/mid/late" so a trip of `duration` nights fits the month. */
function partAnchor(part: "early" | "mid" | "late" | undefined): number {
  switch (part) {
    case "early":
      return 3;
    case "mid":
      return 14;
    case "late":
      return 23;
    default:
      return 12;
  }
}

export interface ResolvedDates {
  /** first day of the trip (check-in). */
  start: string;
  /** check-out / return day = start + nights. */
  end: string;
  /** number of nights (= number of itinerary days). */
  nights: number;
}

/**
 * Resolve concrete dates from a constraint. Exact dates win; otherwise anchor within the
 * month/part for the given year. `durationDays` is the number of nights (an "8-day trip" =
 * 8 nights, return on the following day), matching the Greek fixture (Aug 23 → Aug 31).
 */
export function resolveDates(opts: {
  exact?: { start: string; end: string };
  month?: number;
  part?: "early" | "mid" | "late";
  durationDays: number;
  year: number;
}): ResolvedDates {
  const nights = Math.max(1, opts.durationDays);
  if (opts.exact) {
    return { start: opts.exact.start, end: opts.exact.end, nights: nightsBetween(opts.exact.start, opts.exact.end) || nights };
  }
  const month = opts.month ?? 6;
  const day = partAnchor(opts.part);
  const start = formatYmd(new Date(Date.UTC(opts.year, month - 1, day)));
  const end = addDays(start, nights);
  return { start, end, nights };
}
