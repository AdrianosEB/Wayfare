import { usePathname } from '@/lib/router';
import { Planner } from '@/components/Planner';
import { Landing } from '@/components/landing/Landing';
import { PricingPage } from '@/components/pricing/PricingPage';
import { ExplorePage } from '@/components/explore/ExplorePage';

/**
 * Top-level route switch (lib/router.ts — tiny history-API router, no router dep):
 *   `/`            → marketing landing
 *   `/explore`     → filterable Explore / Trending trips hub
 *   `/pricing`     → cheapest-trips showcase
 *   `/plan/:type?` → in-app planner
 */
export default function App() {
  const path = usePathname();
  if (path === '/plan' || path.startsWith('/plan/')) return <Planner />;
  if (path === '/explore') return <ExplorePage />;
  if (path === '/pricing') return <PricingPage />;
  return <Landing />;
}
