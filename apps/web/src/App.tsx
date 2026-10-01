import { MotionConfig } from 'framer-motion';
import { usePathname } from '@/lib/router';
import { Planner } from '@/components/Planner';
import { Landing } from '@/components/landing/Landing';
import { PricingPage } from '@/components/pricing/PricingPage';
import { ExplorePage } from '@/components/explore/ExplorePage';
import { CollectionPage } from '@/components/collection/CollectionPage';
import { AgentPage } from '@/components/agent/AgentPage';

/**
 * Top-level route switch (lib/router.ts is a small history-API router, no router dep):
 *   `/`            → the scroll narrative: scrubbed harbour hero → six chapters → booking
 *   `/collection`  → the same page, kept so existing links still resolve
 *   `/landing`     → the previous section-by-section marketing page (still intact)
 *   `/explore`     → filterable Explore / Trending trips hub
 *   `/agent`       → the verify-and-book agent pipeline, live
 *   `/pricing`     → cheapest-trips showcase
 *   `/plan/:type?` → in-app planner
 */
function Route() {
  const path = usePathname();
  if (path === '/plan' || path.startsWith('/plan/')) return <Planner />;
  if (path === '/explore') return <ExplorePage />;
  if (path === '/pricing') return <PricingPage />;
  if (path === '/agent') return <AgentPage />;
  // The old marketing landing is not deleted, just no longer the front door.
  if (path === '/landing') return <Landing />;
  // `/` and `/collection` are the same page; `/` is the front door.
  return <CollectionPage />;
}

export default function App() {
  /*
   * `reducedMotion="user"` drops transform/layout animations for reduced-motion users but
   * keeps opacity, which is the degradation MOTION.md §5 describes.
   */
  return (
    <MotionConfig reducedMotion="user">
      <Route />
    </MotionConfig>
  );
}
