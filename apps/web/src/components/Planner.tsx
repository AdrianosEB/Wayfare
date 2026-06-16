import { useEffect, useRef } from 'react';
import { useSession } from '@/store/session';
import { tripTypeByKey } from '@/lib/content';
import { TopBar } from './TopBar';
import { EmptyState } from './EmptyState';
import { ChatThread } from './ChatThread';
import { RefineComposer } from './RefineComposer';
import { ItineraryPanel } from './ItineraryPanel';
import { BudgetPanel } from './BudgetPanel';
import { MobileBudgetBar } from './MobileBudgetBar';
import { SparkleIcon } from './icons';

/**
 * The in-app planner (docs/design/SCREENS.md) + responsive shell.
 *  - Empty state: centered hero prompt.
 *  - Desktop (lg+): split — chat ~40% left, plan + docked azure budget ~60% right.
 *  - Mobile: plan on top, chat below, budget as a sticky bottom bar (MobileBudgetBar).
 *
 * Seeding: a `/plan/:type` route or `?seed=…&go=1` query (from the landing hero / trip cards)
 * pre-fills or auto-starts the prompt on first mount.
 */
export function Planner() {
  const phase = useSession((s) => s.phase);
  const trip = useSession((s) => s.trip);
  const working = useSession((s) => s.workingTrip);
  const submitPrompt = useSession((s) => s.submitPrompt);

  const seed = useRef(readSeed());
  const seededOnce = useRef(false);

  useEffect(() => {
    if (seededOnce.current) return;
    seededOnce.current = true;
    const s = seed.current;
    if (s?.autostart && s.prompt && useSession.getState().phase === 'idle') {
      void submitPrompt(s.prompt);
    }
  }, [submitPrompt]);

  const started = phase !== 'idle';
  const hasPlan = !!(trip || working?.itinerary) || phase === 'planning';
  const canRefine = phase === 'ready' || phase === 'refining';
  const initialPrompt = seed.current && !seed.current.autostart ? seed.current.prompt : undefined;

  return (
    <div className="flex h-full flex-col bg-bg">
      <TopBar />

      {!started ? (
        <main className="flex-1 overflow-y-auto">
          <EmptyState initialPrompt={initialPrompt} />
        </main>
      ) : (
        <main className="min-h-0 flex-1">
          {/* Desktop split */}
          <div className="mx-auto hidden h-full max-w-app lg:grid lg:grid-cols-5">
            <section className="col-span-2 flex min-h-0 flex-col border-r border-border">
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <ChatThread />
              </div>
              {canRefine && (
                <div className="shrink-0 border-t border-border bg-bg/80 px-5 py-4 backdrop-blur">
                  <RefineComposer />
                </div>
              )}
            </section>

            <section className="col-span-3 min-h-0 overflow-y-auto px-6 py-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
                <div className="min-w-0 flex-1">
                  {hasPlan ? <ItineraryPanel /> : <PlanPlaceholder />}
                </div>
                <aside className="xl:w-80 xl:shrink-0">
                  <div className="xl:sticky xl:top-6">
                    <BudgetPanel />
                  </div>
                </aside>
              </div>
            </section>
          </div>

          {/* Mobile stacked */}
          <div className="flex h-full flex-col lg:hidden">
            <div className="flex-1 overflow-y-auto px-4 pb-28 pt-4">
              <div className="mb-6">
                {hasPlan ? <ItineraryPanel /> : <PlanPlaceholder />}
              </div>
              <ChatThread />
              {canRefine && (
                <div className="mt-4">
                  <RefineComposer />
                </div>
              )}
            </div>
          </div>

          <MobileBudgetBar />
        </main>
      )}
    </div>
  );
}

interface Seed {
  prompt: string;
  autostart: boolean;
}

/** Read the planner seed from the URL: `/plan/:type` preset, or `?seed=…&go=1`. */
function readSeed(): Seed | null {
  if (typeof window === 'undefined') return null;
  const { pathname, search } = window.location;
  const params = new URLSearchParams(search);

  const typeMatch = pathname.match(/^\/plan\/([^/?]+)/);
  if (typeMatch?.[1]) {
    const preset = tripTypeByKey(decodeURIComponent(typeMatch[1]));
    if (preset) return { prompt: preset.prompt, autostart: false };
  }

  const seed = params.get('seed');
  if (seed) return { prompt: seed, autostart: params.get('go') === '1' };
  return null;
}

function PlanPlaceholder() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface/50 p-8 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-azure-50 text-azure-500">
        <SparkleIcon className="text-2xl" />
      </span>
      <p className="text-sm font-semibold text-ink">Your plan will appear here</p>
      <p className="mt-1 max-w-xs text-sm text-ink-2">
        Answer or skip the questions on the left and Wayfare will start assembling your trip —
        flights, stay and days, with the budget adding up live.
      </p>
    </div>
  );
}
