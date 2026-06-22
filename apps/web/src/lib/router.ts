import { useEffect } from 'react';
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
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (to === current) return;
  window.history.pushState({}, '', to);
  emit();
  window.scrollTo(0, 0);
}

/**
 * Navigate to a marketing section by id (e.g. `how-it-works`). Sections only exist on the
 * landing (`/`), so from any other page we route home with the hash and let the landing scroll
 * on mount (see `useScrollToHash`). When already on the landing we scroll smoothly in place.
 */
export function navigateToSection(id: string): void {
  if (window.location.pathname === '/') {
    // Reflect the section in the URL (back button still works) then scroll smoothly.
    if (window.location.hash !== `#${id}`) {
      window.history.replaceState({}, '', `/#${id}`);
    }
    scrollToId(id, true);
    return;
  }
  navigate(`/#${id}`);
}

function scrollToId(id: string, smooth: boolean): void {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
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

/**
 * Landing-only: when the URL carries a `#section` (e.g. arriving from `/pricing` via a nav
 * section link), scroll that section into view after the page mounts. Reacts to the path so a
 * cross-page navigation that lands on `/#how-it-works` scrolls even though the component was
 * already mounted is not a concern here — the landing remounts on route change.
 */
export function useScrollToHash(): void {
  const path = usePathname();
  useEffect(() => {
    if (path !== '/') return;
    const id = window.location.hash.replace(/^#/, '');
    if (!id) return;
    // Defer to next frame so the target section has rendered/laid out.
    const raf = requestAnimationFrame(() => scrollToId(id, false));
    return () => cancelAnimationFrame(raf);
  }, [path]);
}
