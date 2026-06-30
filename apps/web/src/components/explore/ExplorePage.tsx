import { TopNav } from '@/components/landing/TopNav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { Section } from '@/components/landing/_shared';
import { Button } from '@/components/Button';
import { ExploreHero } from '@/components/explore/ExploreHero';
import { ExploreTripCard } from '@/components/explore/ExploreTripCard';
import { ExploreFilters } from '@/components/explore/ExploreFilters';
import { useExploreFilters } from '@/components/explore/useExploreFilters';
import { EXPLORE_TRIPS } from '@/lib/content';
import { navigate, planHref } from '@/lib/router';

/**
 * `/explore` — the Explore / Trending trips hub. A filterable, photo-rich gallery of the trips
 * other travellers are planning right now: richer than the `/pricing` budget showcase (budget
 * split, trending signal, season, provenance) and folding in the "what others have done" social
 * proof. Curated content today (EXPLORE_TRIPS), shaped to become real saved-trip data in Phase
 * 2 — swap the array, keep the page.
 *
 * Mirrors the landing TopNav + SiteFooter chrome and the azure/white system. No dark hero, so
 * the nav renders `alwaysSolid`. Everything is visible by default; only the cards' hover lift
 * is animated. Tapping a card seeds the planner with that trip's prompt and auto-starts.
 */
export function ExplorePage() {
  const { filtered, filterControlProps } = useExploreFilters(EXPLORE_TRIPS);

  return (
    <div className="min-h-full bg-bg">
      <TopNav alwaysSolid />
      <main>
        <ExploreHero />

        <Section className="pt-0">
          <ExploreFilters {...filterControlProps} />

          {filtered.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((trip) => (
                <ExploreTripCard
                  key={trip.id}
                  trip={trip}
                  onPlan={() => navigate(planHref({ seed: trip.prompt, autostart: true }))}
                />
              ))}
            </div>
          ) : (
            <EmptyState onClear={filterControlProps.clearAll} />
          )}

          <p className="mt-8 max-w-prose text-sm text-ink-3">
            Totals are illustrative “from” starting points for the whole trip and party shown —
            every figure is a clearly-labelled estimate until live providers are connected. Tap a
            trip to tailor it to your dates, origin and budget; we’ll price the real thing
            honestly.
          </p>
        </Section>

        <ExploreCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <p className="font-display text-lg font-semibold text-ink">No trips match those filters.</p>
      <p className="max-w-sm text-sm text-ink-2">
        Try loosening a filter — or clear them all to see every trip.
      </p>
      <Button variant="secondary" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

function ExploreCTA() {
  return (
    <Section className="pt-0">
      <div className="flex flex-col items-start gap-5 rounded-xl bg-azure-50 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">
            None of these quite it?
          </h2>
          <p className="mt-1.5 max-w-prose text-ink-2">
            Describe the trip you actually want and we’ll plan it from scratch — or browse the
            cheapest getaways on the board.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Button size="lg" onClick={() => navigate(planHref())}>
            Plan my trip
          </Button>
          <Button size="lg" variant="secondary" onClick={() => navigate('/pricing')}>
            Cheapest trips
          </Button>
        </div>
      </div>
    </Section>
  );
}
