import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

/**
 * Start MSW when mocks are enabled. Controlled by VITE_USE_MOCKS (defaults to on in dev,
 * off in prod) — see main.tsx. `onUnhandledRequest: 'bypass'` so anything we don't mock
 * (assets, the live API later) passes straight through to the network / Vite proxy.
 */
export async function startMocks(): Promise<void> {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}
