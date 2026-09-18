import { useEffect, useRef, useState } from 'react';
import { TopNav } from '@/components/landing/TopNav';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { PromptInput } from '@/components/PromptInput';
import { Section } from '@/components/landing/_shared';
import { Price } from '@/components/Price';
import {
  fetchOrchestratorHealth,
  startOrchestration,
  streamOrchestration,
  type AgentUsage,
  type BookingIntent,
  type OrchestratorHealth,
  type PlanResultView,
  type TraceLine,
} from '@/lib/orchestrate';

/**
 * `/agent` — the verify-and-book pipeline, made visible.
 *
 * The orchestration backend (nine agents in `packages/orchestrator`, driven by
 * `apps/server/src/routes/orchestrate.ts`) has existed for a long time and nothing in the web
 * app called it. This page is that missing surface: it starts a job, streams the agents' own
 * trace as they work, and shows the booking intents the pipeline stages at the end.
 *
 * The progress wording is not invented here — `labelFor()` in the route already maps each
 * agent to a human sentence, so this page renders the server's own vocabulary rather than
 * guessing at one.
 *
 * Nothing on this page books anything. The booking agent emits intents with
 * `status: "requires_approval"` and explicitly never executes them; the UI has to carry that
 * same line, so every intent is labelled as staged and awaiting the traveller.
 */
export function AgentPage() {
  const [prompt, setPrompt] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [trace, setTrace] = useState<TraceLine[]>([]);
  const [result, setResult] = useState<PlanResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [health, setHealth] = useState<OrchestratorHealth | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.title = 'Agent — Wayfare';
    return () => abortRef.current?.abort();
  }, []);

  // Which runtime is actually serving the agents. Read once; purely informational.
  useEffect(() => {
    const controller = new AbortController();
    void fetchOrchestratorHealth(controller.signal).then(setHealth);
    return () => controller.abort();
  }, []);

  const run = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || running) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setTrace([]);
    setResult(null);
    setError(null);

    try {
      const job = await startOrchestration(trimmed, controller.signal);
      setJobId(job.jobId);

      for await (const message of streamOrchestration(job.jobId, controller.signal)) {
        if (message.event === 'trace') {
          // `agent_usage` is per-agent bookkeeping, surfaced in the model panel from
          // `usage.perAgent`. Showing it in the timeline buries the actual steps.
          if (message.data.event === 'agent_usage') continue;
          setTrace((lines) => [...lines, message.data]);
        } else if (message.event === 'complete') {
          setResult(message.data);
        } else {
          setError(message.data.message);
        }
      }
    } catch (err) {
      // An abort is this component tearing down, not a failure worth showing.
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!controller.signal.aborted) setRunning(false);
    }
  };

  const intents = result?.bookingIntents ?? [];

  return (
    <div className="min-h-full bg-bg">
      {/* No full-bleed hero behind the bar here, so the nav must be solid from the top. */}
      <TopNav alwaysSolid />
      <main>
        <Section>
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.3em] text-ink-3">
            Agent orchestration
          </p>
          <h1 className="font-display text-display font-semibold text-ink">
            Watch the agents work.
          </h1>
          <p className="mt-4 max-w-prose text-lg leading-relaxed text-ink-2">
            Nine agents read your request, learn your style, search sources in parallel,
            cross-check every price at its source, then stage the bookings for you to approve.
            This is the pipeline running live — not a summary of it.
          </p>

          {health && <RuntimeBanner health={health} />}

          <div className="mt-8 max-w-xl">
            <PromptInput
              variant="hero"
              value={prompt}
              onValueChange={setPrompt}
              onSubmit={run}
              placeholder='e.g. "relaxed 8 days in Greece for two, ~€2,500"'
            />
          </div>

          {jobId && (
            <p className="mt-3 font-mono text-xs text-ink-3">
              job {jobId}
              {running ? ' · running' : result ? ' · complete' : ''}
            </p>
          )}
        </Section>

        {(trace.length > 0 || running) && (
          <Section className="bg-surface">
            <h2 className="font-display text-3xl font-semibold text-ink">What each agent did</h2>
            <ol className="mt-8 space-y-3">
              {trace.map((line, i) => (
                <li
                  key={`${line.at}-${i}`}
                  className="flex flex-col gap-1 rounded-md bg-bg p-4 shadow-card sm:flex-row sm:items-baseline sm:gap-4"
                >
                  <span className="min-w-[7rem] font-mono text-[11px] uppercase tracking-[0.18em] text-azure-700">
                    {line.agent}
                  </span>
                  <span className="flex-1 text-ink">{line.message ?? line.event}</span>
                  <span className="font-mono text-[11px] text-ink-3">{line.event}</span>
                </li>
              ))}
              {running && (
                <li className="flex items-center gap-3 rounded-md bg-bg p-4 shadow-card">
                  <span className="h-2 w-2 animate-pulse rounded-pill bg-azure-500" aria-hidden />
                  <span className="text-ink-2">Working…</span>
                </li>
              )}
            </ol>
          </Section>
        )}

        {error && (
          <Section>
            <div className="rounded-md border border-over/40 bg-over-soft p-5">
              <p className="font-medium text-ink">The orchestration stopped.</p>
              <p className="mt-1 font-mono text-sm text-ink-2">{error}</p>
              <p className="mt-3 text-sm text-ink-2">
                The agent pipeline needs the API server. Run <code>pnpm dev:server</code> and
                start this page with <code>VITE_USE_MOCKS=0</code>, or use{' '}
                <code>pnpm serve</code> to run both from one origin.
              </p>
            </div>
          </Section>
        )}

        {result?.usage && <ModelPanel usage={result.usage} health={health} />}

        {result && (
          <Section>
            <h2 className="font-display text-3xl font-semibold text-ink">Staged for your approval</h2>
            <p className="mt-2 max-w-prose text-ink-2">
              The booking agent prepares each step and stops. Nothing here has been booked,
              charged, or reserved — every intent is waiting on you.
            </p>

            {intents.length === 0 ? (
              <p className="mt-8 text-ink-2">
                This run produced no booking intents. The critic may have held the plan back —
                the trace above says why.
              </p>
            ) : (
              <ul className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
                {intents.map((intent, i) => (
                  <IntentCard key={`${intent.entity.key}-${i}`} intent={intent} />
                ))}
              </ul>
            )}
          </Section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function IntentCard({ intent }: { intent: BookingIntent }) {
  const isCall = intent.channel === 'phone_call';
  return (
    <li className="flex flex-col gap-4 rounded-lg bg-bg p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink">{intent.entity.name}</h3>
          <p className="mt-0.5 text-sm text-ink-2">
            {intent.entity.kind}
            {intent.entity.locality ? ` · ${intent.entity.locality}` : ''}
          </p>
        </div>
        {/* The literal status from the schema, shown as-is rather than softened. */}
        <span className="whitespace-nowrap rounded-pill bg-azure-50 px-3 py-1 text-xs font-semibold text-azure-700">
          Requires approval
        </span>
      </div>

      {/* Price + provenance as one unit — the amount never appears without its source label. */}
      <Price listing={intent.listing} size="lg" align="start" />

      <p className="text-sm leading-relaxed text-ink-2">{intent.note}</p>

      {intent.callScript.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
            What to ask
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            {intent.callScript.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {intent.target && (
        <a
          href={intent.target}
          target={isCall ? undefined : '_blank'}
          rel={isCall ? undefined : 'noreferrer noopener'}
          className="mt-auto self-start rounded-pill bg-azure-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-azure-600 focus-visible:ring-2"
        >
          {isCall ? 'Call to confirm →' : 'Open to review →'}
        </a>
      )}
    </li>
  );
}

/**
 * Says which runtime is answering, before you run anything. Without this the page looks
 * identical whether the agents are on a local fine-tune, on Anthropic, or fully deterministic.
 */
function RuntimeBanner({ health }: { health: OrchestratorHealth }) {
  if (!health.llm) {
    return (
      <p className="mt-6 max-w-prose text-sm text-ink-3">
        All nine agents are running their deterministic implementations — no model is being
        called. Set <code>WAYFARE_LLM_ORCHESTRATOR=true</code> to put an agent on a model.
      </p>
    );
  }

  const local = health.runtime === 'local';
  return (
    <div className="mt-6 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-pill bg-azure-50 px-4 py-2 text-sm text-azure-700">
      <span className="font-semibold">
        {local ? 'Local fine-tune' : 'Anthropic'}
      </span>
      <span className="font-mono text-xs">{health.model}</span>
      <span className="text-azure-700/70">
        serving {health.agents.join(', ')}
        {health.agents.length === 1 ? ' — every other agent stays deterministic' : ''}
      </span>
    </div>
  );
}

/**
 * Where the thinking actually happened, per agent.
 *
 * This is the point of the panel: `training/` distils the persona agent into a local student,
 * and until now there was no way to see whether that student ran. An agent with `llm: false`
 * fell back to its deterministic implementation — which is the designed behaviour when the
 * model's answer misses the schema, not a failure to hide.
 */
function ModelPanel({
  usage,
  health,
}: {
  usage: NonNullable<PlanResultView['usage']>;
  health: OrchestratorHealth | null;
}) {
  // A plan can run several passes, so an agent appears once per pass. Fold them together:
  // listing "search, verify, … , search, verify, …" reads like a bug, and two model calls by
  // the same agent are one line whose tokens and time add up.
  const byAgent = new Map<string, AgentUsage>();
  for (const a of usage.perAgent) {
    const prev = byAgent.get(a.agent);
    byAgent.set(
      a.agent,
      prev
        ? {
            ...prev,
            inputTokens: prev.inputTokens + a.inputTokens,
            outputTokens: prev.outputTokens + a.outputTokens,
            toolCalls: prev.toolCalls + a.toolCalls,
            ms: prev.ms + a.ms,
            // one model call anywhere means this agent reached the model on this plan
            llm: prev.llm || a.llm,
          }
        : a,
    );
  }
  const folded = [...byAgent.values()];
  const onModel = folded.filter((a) => a.llm);
  const deterministic = folded.filter((a) => !a.llm);
  const runtimeName =
    health?.runtime === 'local' ? `the local fine-tune (${health.model})` : 'the model';

  return (
    <Section className="bg-surface">
      <h2 className="font-display text-3xl font-semibold text-ink">Where the thinking happened</h2>
      <p className="mt-2 max-w-prose text-ink-2">
        {onModel.length === 0 ? (
          <>Every agent ran its deterministic implementation on this plan.</>
        ) : (
          <>
            {onModel.length === 1 ? 'One agent' : `${onModel.length} agents`} ran on{' '}
            {runtimeName}. The rest are deterministic code — the pipeline only spends a model
            where a model earns its place.
          </>
        )}
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Model calls" value={String(usage.calls)} />
        <Stat label="Tokens in" value={usage.inputTokens.toLocaleString()} />
        <Stat label="Tokens out" value={usage.outputTokens.toLocaleString()} />
        <Stat label="Model time" value={`${(usage.ms / 1000).toFixed(1)}s`} />
      </dl>

      {onModel.length > 0 && (
        <ul className="mt-8 space-y-3">
          {onModel.map((a) => (
            <li
              key={a.agent}
              className="flex flex-col gap-1 rounded-md bg-bg p-4 shadow-card sm:flex-row sm:items-baseline sm:gap-4"
            >
              <span className="min-w-[7rem] font-mono text-[11px] uppercase tracking-[0.18em] text-azure-700">
                {a.agent}
              </span>
              <span className="flex-1 text-ink">
                {a.inputTokens.toLocaleString()} in → {a.outputTokens.toLocaleString()} out
              </span>
              <span className="font-mono text-[11px] text-ink-3">
                {(a.ms / 1000).toFixed(2)}s
              </span>
            </li>
          ))}
        </ul>
      )}

      {deterministic.length > 0 && (
        <p className="mt-6 text-sm text-ink-3">
          Deterministic this run: {deterministic.map((a) => a.agent).join(', ')}.
        </p>
      )}

      {usage.capped && (
        <p className="mt-4 text-sm text-over">
          The token or call ceiling was reached, so later agents fell back to deterministic code.
        </p>
      )}
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-3">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-ink">{value}</dd>
    </div>
  );
}
