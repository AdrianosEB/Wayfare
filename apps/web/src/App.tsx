import { usePathname } from '@/lib/router';
import { Planner } from '@/components/Planner';
import { Landing } from '@/components/landing/Landing';
import { PricingPage } from '@/components/pricing/PricingPage';

/**
 * Top-level route switch (lib/router.ts — tiny history-API router, no router dep):
 *   `/`            → marketing landing
 *   `/pricing`     → cheapest-trips showcase
 *   `/plan/:type?` → in-app planner
 */
export default function App() {
  const path = usePathname();
  if (path === '/plan' || path.startsWith('/plan/')) return <Planner />;
  if (path === '/pricing') return <PricingPage />;
  return <Landing />;
}
