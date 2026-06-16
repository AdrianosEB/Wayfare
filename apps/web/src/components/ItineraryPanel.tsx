import { motion, useReducedMotion } from 'framer-motion';
import type {
  Flight,
  ItineraryItem,
  Stay,
  Trip,
} from '@/types';
import { useSession } from '@/store/session';
import { cn } from '@/lib/cn';
import { formatDateRange } from '@/lib/format';
import { staggerContainer, staggerIn } from '@/lib/motion';
import { FlightCard } from './FlightCard';
import { StayCard } from './StayCard';
import { DayTimeline } from './DayTimeline';
import { AssumptionsReveal } from './AssumptionsReveal';
import { PlaneIcon, BedIcon, MapPinIcon, SparkleIcon } from './icons';

/**
 * Container for the whole plan (DESIGN_SYSTEM §4). Reads the authoritative `trip` when
 * present, otherwise the in-progress `workingTrip` so the itinerary fills in progressively
 * during streaming (flights → stay → days), skeleton→content, never a blank spinner.
 */
export function ItineraryPanel() {
  const trip = useSession((s) => s.trip);
  const working = useSession((s) => s.workingTrip);
  const phase = useSession((s) => s.phase);
  const assumptions = useSession((s) => s.assumptions);
  const changedKeys = useSession((s) => s.changedKeys);
  const focusedCategory = useSession((s) => s.focusedCategory);
  const version = useSession((s) => s.version);

  // Authoritative trip wins; during planning we render the partial working copy.
  const view = (trip ?? working) as Partial<Trip> | null;
  const itinerary = view?.itinerary;
  const planning = phase === 'planning';

  const flights = itinerary?.flights ?? [];
  const stays = itinerary?.stays ?? [];
  const days = itinerary?.days ?? [];

  // Listing ids rolled up under the budget line the user tapped (tap-to-trace).
  const focusRefs = new Set(
    focusedCategory
      ? (view?.budget?.lines.find((l) => l.category === focusedCategory)?.itemRefs ?? [])
      : [],
  );
  const isFocused = (listingId?: string) => !!listingId && focusRefs.has(listingId);

  const isFlightChanged = (f: Flight) =>
    changedKeys.has(f.id) || changedKeys.has(f.listing?.id ?? '');
  const isStayChanged = (s: Stay) =>
    changedKeys.has(s.name) || changedKeys.has(s.id) || changedKeys.has(s.listing?.id ?? '');
  const isItemChanged = (i: ItineraryItem) =>
    changedKeys.has(i.title) || changedKeys.has(i.id) || changedKeys.has(i.listing?.id ?? '');

  return (
    <motion.section
      aria-label="Your itinerary"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5"
    >
      <Header trip={view} planning={planning} />

      {/* Flights */}
      <Section title="Flights" icon={<PlaneIcon />}>
        {flights.length > 0 ? (
          <div className="flex flex-col gap-3">
            {flights.map((f) => (
              <Item key={f.id}>
                <FlightCard
                  flight={f}
                  changed={isFlightChanged(f)}
                  focused={isFocused(f.listing?.id)}
                  pulseKey={version}
                />
              </Item>
            ))}
          </div>
        ) : (
          <Skeleton lines={2} show={planning} label="Searching flights…" />
        )}
      </Section>

      {/* Stay */}
      <Section title="Stay" icon={<BedIcon />}>
        {stays.length > 0 ? (
          <div className="flex flex-col gap-3">
            {stays.map((s) => (
              <Item key={s.id}>
                <StayCard
                  stay={s}
                  changed={isStayChanged(s)}
                  focused={isFocused(s.listing?.id)}
                  pulseKey={version}
                />
              </Item>
            ))}
          </div>
        ) : (
          <Skeleton lines={1} show={planning} label="Comparing stays…" />
        )}
      </Section>

      {/* Day by day */}
      <Section title="Day by day" icon={<MapPinIcon />}>
        {days.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {days
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((d) => (
                <Item key={d.index}>
                  <DayTimeline
                    day={d}
                    isChanged={isItemChanged}
                    isFocused={(i) => isFocused(i.listing?.id)}
                  />
                </Item>
              ))}
          </div>
        ) : (
          <Skeleton lines={3} show={planning} label="Planning your days…" />
        )}
      </Section>

      {assumptions.length > 0 && <AssumptionsReveal assumptions={assumptions} />}
    </motion.section>
  );
}

function Header({ trip, planning }: { trip: Partial<Trip> | null; planning: boolean }) {
  const itinerary = trip?.itinerary;
  const summary = trip?.summary;
  const dest = itinerary?.destinationResolved ?? trip?.request?.destination?.value;
  const dates =
    itinerary?.startDate && itinerary?.endDate
      ? formatDateRange(itinerary.startDate, itinerary.endDate)
      : null;
  const party = partyLabel(trip);

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-primary-fg"
        style={{
          background:
            'linear-gradient(135deg, rgb(var(--c-primary)), rgb(var(--c-accent)))',
        }}
        aria-hidden
      >
        {dest ? dest.charAt(0).toUpperCase() : <SparkleIcon />}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-bold text-ink">
          {summary ?? (planning ? 'Assembling your trip…' : dest ?? 'Your trip')}
        </h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
          {dest && <span>{dest}</span>}
          {dates && <span className="text-faint">·</span>}
          {dates && <span className="tabular">{dates}</span>}
          {party && <span className="text-faint">·</span>}
          {party && <span>{party}</span>}
        </p>
      </div>
    </div>
  );
}

function partyLabel(trip: Partial<Trip> | null): string | null {
  const travelers = trip?.travelers;
  if (travelers && travelers.length > 0) {
    const adults = travelers.filter((t) => t.type === 'adult').length;
    const kids = travelers.filter((t) => t.type === 'child').length;
    return composeParty(adults, kids);
  }
  const ps = trip?.request?.partySize?.value;
  if (ps) return composeParty(ps.adults, ps.children ?? 0);
  return null;
}

function composeParty(adults: number, kids: number): string {
  if (adults === 1 && kids === 0) return 'Solo';
  if (adults === 2 && kids === 0) return 'For two';
  const parts = [`${adults} adult${adults === 1 ? '' : 's'}`];
  if (kids > 0) parts.push(`${kids} kid${kids === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
        <span className="text-sm text-muted">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div variants={reduce ? undefined : staggerIn}>{children}</motion.div>
  );
}

function Skeleton({
  lines,
  show,
  label,
}: {
  lines: number;
  show: boolean;
  label: string;
}) {
  return (
    <div
      className="flex flex-col gap-3"
      role="status"
      aria-label={show ? label : 'Not yet planned'}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={cn(
            'h-20 rounded-2xl border border-border bg-surface',
            show && 'animate-pulse',
          )}
        >
          <span className="sr-only">{label}</span>
        </div>
      ))}
    </div>
  );
}
