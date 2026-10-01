import { useRef } from 'react';
import { TopNav } from '@/components/landing/TopNav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { Section } from '@/components/landing/_shared';
import { Button } from '@/components/Button';
import { ExploreBackdrop } from '@/components/explore/ExploreBackdrop';
import { ExploreHero } from '@/components/explore/ExploreHero';
import { ExploreStats } from '@/components/explore/ExploreStats';
import { ExploreSpotlight } from '@/components/explore/ExploreSpotlight';
import { ExploreVibeTiles } from '@/components/explore/ExploreVibeTiles';
import { ExploreTripCard } from '@/components/explore/ExploreTripCard';
import { ExploreFilters } from '@/components/explore/ExploreFilters';
import { ExploreCollections } from '@/components/explore/ExploreCollections';
import { ExploreRouteMotif } from '@/components/explore/ExploreRouteMotif';
import { useExploreFilters } from '@/components/explore/useExploreFilters';
import { EXPLORE_TRIPS, type TripVibe } from '@/lib/content';
import { navigate, planHref } from '@/lib/router';

/**
 * `/explore`: the Explore / Trending trips hub, a filterable gallery of trips. Curated
 * content today (EXPLORE_TRIPS), shaped to become real saved-trip data in Phase 2.
 *
 * No dark hero, so the nav renders `alwaysSolid`. Tapping a card seeds the planner with that
 * trip's prompt and auto-starts.
 */
export function ExplorePage() {
  const { filtered, filterControlProps } = useExploreFilters(EXPLORE_TRIPS);

  // The spotlight features the most-planned trip this week.
  const spotlight = EXPLORE_TRIPS.reduce((top, t) =>
    t.plannedThisWeek > top.plannedThisWeek ? t : top,
  );

  // "Browse by vibe" tiles drive the same vibe facet as the filter chips. Picking one toggles
  // the vibe and scrolls down to the results.
  const resultsRef = useRef<HTMLDivElement>(null);
  const handleVibePick = (vibe: TripVibe) => {
    filterControlProps.onToggleVibe(vibe);
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  return (
    // Base is `surface-2` (#EEF3FA), the same as the home page. `surface` (#F7F9FC) was too
    // close to white for the white cards/bands (bg-bg) to lift off it.
    <div className="min-h-full bg-surface-2">
      <TopNav alwaysSolid />
      <main>
        {/* The hero gets its own <Section> so its max-w-site container aligns the copy and
            collage with the stats + grid below. The relative/overflow-hidden wrapper hosts
            ExploreBackdrop. */}
        <div className="relative overflow-hidden">
          <ExploreBackdrop />
          <Section className="pb-8 pt-16 sm:pt-24">
            <ExploreHero />
          </Section>
        </div>

        {/* Everything below the hero shares one Section: stats, filters, then results. */}
        <Section className="pt-0">
          <ExploreStats className="mb-12" />

          <ExploreSpotlight
            trip={spotlight}
            onPlan={() => navigate(planHref({ seed: spotlight.prompt, autostart: true }))}
          />

          <div className="mt-14">
            <ExploreVibeTiles onPick={handleVibePick} />
          </div>

          {/* Filters + results. scroll-mt-24 keeps the sticky nav from covering the top when a
              vibe tile scrolls here. */}
          <div ref={resultsRef} className="mt-14 scroll-mt-24">
            <ExploreFilters {...filterControlProps} />

            {/* Grid when anything matches; otherwise the empty state with a one-tap clear-all. */}
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
              Totals are illustrative “from” starting points for the whole trip and party shown.
              Every figure is a clearly-labelled estimate until live providers are connected. Tap
              a trip to tailor it to your dates, origin and budget; we’ll price the real thing
              honestly.
            </p>
          </div>
        </Section>

        {/* Themed collections below the results, on a white band. */}
        <Section className="border-t border-border bg-bg">
          <ExploreCollections />
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
        Try loosening a filter, or clear them all to see every trip.
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
      <div className="relative flex flex-col items-start gap-5 overflow-hidden rounded-xl bg-azure-50 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        {/* Decorative route lines behind the closing CTA. Content below carries `relative`
            so it stays above the motif. */}
        <ExploreRouteMotif className="absolute inset-0 h-full w-full text-azure-200 opacity-70" />
        <div className="relative">
          <h2 className="font-display text-2xl font-semibold text-ink">
            None of these quite it?
          </h2>
          <p className="mt-1.5 max-w-prose text-ink-2">
            Describe the trip you actually want and we’ll plan it from scratch, or browse the
            cheapest getaways on the board.
          </p>
        </div>
        <div className="relative flex shrink-0 flex-wrap gap-3">
          <Button size="lg" onClick={() => navigate(planHref())}>
            Plan my trip
          </Button>
          {/* Cross-link to /pricing so Explore is not a dead end. */}
          <Button size="lg" variant="secondary" onClick={() => navigate('/pricing')}>
            Cheapest trips
          </Button>
        </div>
      </div>
    </Section>
  );
}
