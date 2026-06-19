import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './store/auth';
import './index.css';

/**
 * Mounts the app. We:
 *  1. Optionally start MSW fixture mocks (dev default; flip VITE_USE_MOCKS=0 to hit /api).
 *  2. Provide React Query for server reads (the SSE streams are driven imperatively in the
 *     session store via fetch + ReadableStream).
 * Light theme only (docs/design/TOKENS.md) — no theme bootstrap needed.
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function useMocks(): boolean {
  const flag = import.meta.env.VITE_USE_MOCKS;
  if (flag === '1' || flag === 'true') return true;
  if (flag === '0' || flag === 'false') return false;
  return import.meta.env.DEV; // default: on in dev, off in prod
}

async function bootstrap() {
  if (useMocks()) {
    const { startMocks } = await import('./mocks/browser');
    await startMocks();
  }

  // Resolve the auth session exactly once (GET /api/auth/me). Guest mode is the default, so
  // this never blocks rendering — it only personalizes the TopBar once it returns.
  void useAuth.getState().hydrate();

  // NOTE: StrictMode intentionally omitted. Its dev-only double-mount stalls Framer Motion's
  // staggered entrance orchestration (staggerChildren), leaving cards/itinerary items frozen
  // near opacity:0 — the "disappearing UI" bug. StrictMode is a no-op in production, so this
  // only affects dev; removing it makes dev match prod. (See lib/motion.ts stagger variants.)
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>,
  );
}

void bootstrap();
