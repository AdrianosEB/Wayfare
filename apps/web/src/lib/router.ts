import { useSyncExternalStore } from 'react';

/**
 * Tiny history-API router — no router dependency (the design stack is React + Vite + Zustand
 * + React Query only). Two routes:
 *   `/`            → marketing landing
 *   `/plan/:type?` → in-app planner (optional trip-type seeds the prompt)
 *
 * Navigation can carry a prompt seed via the query string so the landing hero / trip cards
 * route straight into the planner: `/plan?seed=<prompt>&go=1` (go=1 auto-starts planning).
 */

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export function navigate(to: string): void {
  const current = window.location.pathname + window.location.search;
  if (to === current) return;
  window.history.pushState({}, '', to);
  emit();
  window.scrollTo(0, 0);
}

/** Build a `/plan` URL that seeds the planner prompt. */
export function planHref(opts: { type?: string; seed?: string; autostart?: boolean } = {}): string {
  const base = opts.type ? `/plan/${opts.type}` : '/plan';
  const params = new URLSearchParams();
  if (opts.seed) params.set('seed', opts.seed);
  if (opts.autostart) params.set('go', '1');
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', emit);
}

function subscribe(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getPath = () => window.location.pathname;

/** Reactive pathname (e.g. `/`, `/plan`, `/plan/family`). */
export function usePathname(): string {
  return useSyncExternalStore(subscribe, getPath, () => '/');
}
