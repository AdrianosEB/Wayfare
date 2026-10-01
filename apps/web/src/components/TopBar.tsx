import { useSession } from '@/store/session';
import { navigate } from '@/lib/router';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/components/Button';
import { AuthControls } from '@/components/AuthControls';
import { PlusIcon } from '@/components/icons';

/**
 * Planner app chrome (SCREENS). Matches the marketing `TopNav` (same h-16 bar, container,
 * border and Explore link) so the nav doesn't change shape between `/explore` and `/plan`.
 * Stays a plain block `<header>`: the planner is a full-height flex shell, so a sticky bar
 * would break the column layout.
 */
export function TopBar() {
  const phase = useSession((s) => s.phase);
  const reset = useSession((s) => s.reset);
  const started = phase !== 'idle';

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-site items-center justify-between px-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-md focus-visible:ring-2"
          aria-label="Wayfare, back to home"
        >
          <Wordmark />
        </button>

        <nav className="flex items-center gap-1" aria-label="Primary">
          <button
            type="button"
            onClick={() => navigate('/explore')}
            className="inline-flex h-9 items-center rounded-pill px-3.5 text-sm font-medium text-ink transition hover:bg-surface focus-visible:ring-2"
          >
            Explore
          </button>
          {/* Secondary: the planner already has an azure CTA in the content area, and the
              design system allows only one primary azure CTA per view. */}
          {started && (
            <Button variant="secondary" onClick={reset} iconLeft={<PlusIcon />}>
              New trip
            </Button>
          )}
          <AuthControls className="ml-1" />
        </nav>
      </div>
    </header>
  );
}
