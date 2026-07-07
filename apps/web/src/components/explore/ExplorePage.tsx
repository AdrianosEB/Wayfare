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
import { useExploreFilters } from '@/components/explore/useExploreFilters';
import { EXPLORE_TRIPS, type TripVibe } from '@/lib/content';
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

  // The spotlight features the single most-planned trip this week (the top social-proof story).
  const spotlight = EXPLORE_TRIPS.reduce((top, t) =>
    t.plannedThisWeek > top.plannedThisWeek ? t : top,
  );

  // "Browse by vibe" tiles drive the same vibe facet as the filter chips. Picking one toggles
  // the vibe and scrolls down to the (now-filtered) results so the interaction feels live.
  const resultsRef = useRef<HTMLDivElement>(null);
  const handleVibePick = (vibe: TripVibe) => {
    filterControlProps.onToggleVibe(vibe);
    requestAnimationFrame(() =>
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  return (
    // Page composition, top to bottom: hero Section → stats → filters → grid → CTA.
    // Base is `bg-surface` (a barely-cool off-white) rather than stark white, so the white
    // cards/bands (bg-bg) lift off the page with their shadows instead of blending in.
    <div className="min-h-full bg-surface">
      <TopNav alwaysSolid />
      <main>
        {/* The hero gets its OWN <Section> so its centered max-w-site container aligns the
            copy/collage with the stats + grid below. ExploreHero renders no Section of its own
            (it can't, or the widths wouldn't line up), so alignment is this wrapper's job.
            The relative/overflow-hidden wrapper hosts ExploreBackdrop — a soft azure wash +
            blurred blobs behind the starting screen so the page doesn't open on stark white. */}
        <div className="relative overflow-hidden">
          <ExploreBackdrop />
          <Section className="pb-8 pt-16 sm:pt-24">
            <ExploreHero />
          </Section>
        </div>

        {/* Everything below the hero shares one Section (one aligned column): the derived stats
            band, the filter bar, and then the results. */}
        <Section className="pt-0">
          <ExploreStats className="mb-12" />

          {/* Editorial focal point: the hottest trip, blown up as a magazine-style feature so the
              page leads with something rich instead of jumping straight to a uniform grid. */}
          <ExploreSpotlight
            trip={spotlight}
            onPlan={() => navigate(planHref({ seed: spotlight.prompt, autostart: true }))}
          />

          <div className="mt-14">
            <ExploreVibeTiles onPick={handleVibePick} />
          </div>

          {/* Filters + results. scroll-mt-24 keeps the sticky nav from covering the top when a
              vibe tile scrolls us here. */}
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
              Totals are illustrative “from” starting points for the whole trip and party shown —
              every figure is a clearly-labelled estimate until live providers are connected. Tap
              a trip to tailor it to your dates, origin and budget; we’ll price the real thing
              honestly.
            </p>
          </div>
        </Section>

        {/* Another way in below the results: themed, data-derived collections. */}
        <Section className="pt-0">
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
          {/* Keep /pricing cross-linked: Explore (trending) and Pricing (budget showcase) are
              sibling discovery surfaces — a browser who bounces off Explore should land on the
              cheap-trips board, not a dead end. */}
          <Button size="lg" variant="secondary" onClick={() => navigate('/pricing')}>
            Cheapest trips
          </Button>
        </div>
      </div>
    </Section>
  );
}
