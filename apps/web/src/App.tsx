import { usePathname } from '@/lib/router';
import { Planner } from '@/components/Planner';
import { Landing } from '@/components/landing/Landing';

/**
 * Top-level route switch (lib/router.ts — tiny history-API router, no router dep):
 *   `/`            → marketing landing
 *   `/plan/:type?` → in-app planner
 */
export default function App() {
  const path = usePathname();
  const isPlan = path === '/plan' || path.startsWith('/plan/');
  return isPlan ? <Planner /> : <Landing />;
}
