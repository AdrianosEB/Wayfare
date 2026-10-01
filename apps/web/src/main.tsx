import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './store/auth';
import './index.css';

/**
 * Mounts the app. MSW fixture mocks start first when enabled (dev default; set
 * VITE_USE_MOCKS=0 to hit /api). React Query handles server reads; the SSE streams are
 * driven from the session store.
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

  // Resolve the auth session once (GET /api/auth/me). It does not block rendering; it only
  // personalizes the TopBar once it returns.
  void useAuth.getState().hydrate();

  // StrictMode is omitted. Its dev-only double-mount stalls Framer Motion's `staggerChildren`
  // orchestration and leaves cards/itinerary items frozen near opacity 0. See lib/motion.ts.
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>,
  );
}

void bootstrap();
