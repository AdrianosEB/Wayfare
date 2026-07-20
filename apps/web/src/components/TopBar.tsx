import { useSession } from '@/store/session';
import { navigate } from '@/lib/router';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/components/Button';
import { AuthControls } from '@/components/AuthControls';
import { PlusIcon } from '@/components/icons';

/**
 * Planner app chrome (SCREENS). Mirrors the marketing `TopNav` so the nav doesn't change
 * shape when you cross from `/explore` into `/plan`: same h-16 bar, same max-w-site inner
 * container, same hairline border, same Explore link. Only the primary action differs —
 * the marketing "Plan my trip" CTA is replaced by the planner's "New trip" reset, which
 * appears once a trip has started.
 *
 * Always renders the solid (light-bar) variant of TopNav's styling, and stays a plain
 * block `<header>` — the planner is a full-height flex shell, so a sticky bar here would
 * break the column layout.
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
          aria-label="Wayfare — back to home"
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
          {/* Secondary, not primary: the planner already has an azure CTA in the content area
              (send / refine), and the design system allows only one primary azure CTA per view.
              This keeps TopNav's button proportions without stacking azure. */}
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
