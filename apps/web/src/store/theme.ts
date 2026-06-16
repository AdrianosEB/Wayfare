import { useSyncExternalStore } from 'react';

/**
 * Theme: 'light' | 'dark', persisted, defaulting to the system preference.
 * Toggling flips the `.dark` class on <html>, which drives all CSS-var tokens.
 */
export type Theme = 'light' | 'dark';

const KEY = 'wayfare:theme';

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function stored(): Theme | null {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : null;
}

function current(): Theme {
  return stored() ?? systemTheme();
}

function apply(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

const listeners = new Set<() => void>();

export function initTheme(): void {
  apply(current());
  // Follow system changes only while the user hasn't made an explicit choice.
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!stored()) {
      apply(systemTheme());
      listeners.forEach((l) => l());
    }
  });
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme);
  apply(theme);
  listeners.forEach((l) => l());
}

export function toggleTheme(): void {
  setTheme(current() === 'dark' ? 'light' : 'dark');
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reactive current theme for components (e.g. the toggle button icon). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => 'light');
}
