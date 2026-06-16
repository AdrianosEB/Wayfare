import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initTheme } from './store/theme';
import './index.css';

/**
 * Mounts the app. We:
 *  1. Apply the theme before first paint (no flash).
 *  2. Optionally start MSW fixture mocks (dev default; flip VITE_USE_MOCKS=0 to hit /api).
 *  3. Provide React Query for server reads (the SSE streams are driven imperatively in the
 *     session store via fetch + ReadableStream).
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
  initTheme();

  if (useMocks()) {
    const { startMocks } = await import('./mocks/browser');
    await startMocks();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
