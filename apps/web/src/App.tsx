import { useSession } from '@/store/session';
import { TopBar } from '@/components/TopBar';
import { EmptyState } from '@/components/EmptyState';
import { ChatThread } from '@/components/ChatThread';
import { RefineComposer } from '@/components/RefineComposer';
import { ItineraryPanel } from '@/components/ItineraryPanel';
import { BudgetPanel } from '@/components/BudgetPanel';
import { MobileBudgetBar } from '@/components/MobileBudgetBar';
import { SparkleIcon } from '@/components/icons';

/**
 * App shell + responsive layout (DESIGN_SYSTEM §Responsive).
 *  - Empty state: centered hero.
 *  - Desktop (lg+): split view — chat ~40% left, plan + docked budget ~60% right.
 *  - Mobile: plan on top, chat below, budget as a sticky bottom bar (MobileBudgetBar).
 */
export default function App() {
  const phase = useSession((s) => s.phase);
  const trip = useSession((s) => s.trip);
  const working = useSession((s) => s.workingTrip);

  const started = phase !== 'idle';
  const hasPlan = !!(trip || working?.itinerary) || phase === 'planning';
  const canRefine = phase === 'ready' || phase === 'refining';

  return (
    <div className="flex h-full flex-col bg-sand">
      <TopBar />

      {!started ? (
        <main className="flex-1 overflow-y-auto">
          <EmptyState />
        </main>
      ) : (
        <main className="min-h-0 flex-1">
          {/* Desktop split */}
          <div className="hidden h-full lg:grid lg:grid-cols-5">
            <section className="col-span-2 flex min-h-0 flex-col border-r border-border">
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <ChatThread />
              </div>
              {canRefine && (
                <div className="shrink-0 border-t border-border bg-sand/80 px-5 py-4 backdrop-blur">
                  <RefineComposer />
                </div>
              )}
            </section>

            <section className="col-span-3 min-h-0 overflow-y-auto bg-sand px-6 py-6">
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

function PlanPlaceholder() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/40 p-8 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <SparkleIcon className="text-2xl" />
      </span>
      <p className="text-sm font-semibold text-ink">Your plan will appear here</p>
      <p className="mt-1 max-w-xs text-sm text-muted">
        Answer or skip the questions on the left and Wayfare will start assembling your trip —
        flights, stay and days, with the budget adding up live.
      </p>
    </div>
  );
}
