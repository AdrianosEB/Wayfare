import { useSession } from '@/store/session';
import { navigate } from '@/lib/router';
import { Wordmark } from './Wordmark';
import { AuthControls } from './AuthControls';
import { PlusIcon } from './icons';

/** Planner app chrome (SCREENS): slim top bar — Wayfare mark · "New trip". */
export function TopBar() {
  const phase = useSession((s) => s.phase);
  const reset = useSession((s) => s.reset);
  const started = phase !== 'idle';

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="rounded-md focus-visible:ring-2"
        aria-label="Wayfare — back to home"
      >
        <Wordmark />
      </button>

      <div className="flex items-center gap-2">
        {started && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-bg px-3 py-1.5 text-xs font-medium text-ink-2 transition hover:bg-surface hover:text-ink focus-visible:ring-2"
          >
            <PlusIcon className="text-sm" />
            New trip
          </button>
        )}
        <AuthControls />
      </div>
    </header>
  );
}
