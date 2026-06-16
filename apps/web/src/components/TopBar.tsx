import { useSession } from '@/store/session';
import { toggleTheme, useTheme } from '@/store/theme';
import { cn } from '@/lib/cn';
import { MoonIcon, SunIcon, PlusIcon } from './icons';

/** App chrome: wordmark + value prop, theme toggle, and "New trip" once a session exists. */
export function TopBar() {
  const theme = useTheme();
  const phase = useSession((s) => s.phase);
  const reset = useSession((s) => s.reset);
  const started = phase !== 'idle';

  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2.5">
        <Logo />
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-ink">Wayfare</p>
          <p className="hidden text-[11px] text-faint sm:block">
            A trip planned for you from one sentence
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {started && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:text-ink focus-visible:ring-2"
          >
            <PlusIcon className="text-sm" />
            New trip
          </button>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted transition hover:text-ink focus-visible:ring-2"
        >
          {theme === 'dark' ? <SunIcon className="text-lg" /> : <MoonIcon className="text-lg" />}
        </button>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl text-primary-fg',
      )}
      style={{ background: 'linear-gradient(135deg, rgb(var(--c-primary)), rgb(var(--c-accent)))' }}
      aria-hidden
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="10" r="5" />
        <path d="M12 15v6" />
        <circle cx="12" cy="10" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
