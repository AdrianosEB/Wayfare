# @wayfare/orchestrator-llm

The same nine-agent pipeline as [`@wayfare/orchestrator`](../orchestrator/README.md), but every
agent is a **real LLM agent** wired as a [LangGraph](https://langchain-ai.github.io/langgraphjs/)
state graph.

This is a **parallel implementation, not a replacement**. `@wayfare/orchestrator` stays exactly as
it is — the default and the fail-safe. With `WAYFARE_LLM_ORCHESTRATOR` unset, `createOrchestrator`
hands back the deterministic `Orchestrator` and **loading the site costs nothing**.

## Why a separate package

LangChain pulls a large dependency tree. Adding it to `@wayfare/orchestrator` would destroy what
makes that package good — zod-only, fast install, fast tests, trivially benchmarkable. The pure
core stays pure.

## The graph

```
  intake → persona → planQueries → search → verify → match
     → supervisor → select → reprice → critic
     → critic.passed ? END : widen ─┐
                ▲                    │
                └────────────────────┘   (back to planQueries, widened)
```

The conditional edge back to `planQueries` is **why this is a `StateGraph` and not a chain**: the
retry is a genuine cycle over mutating state (`pass`, `breadthMultiplier`), and everything
downstream recomputes against the wider market. A linear chain cannot express that.

> Node names carry an `Agent` suffix (`personaAgent`, `criticAgent`) because LangGraph forbids a
> node name from colliding with a state channel — `persona` and `critic` are both channels.

## The agents, and the tools each gets

> **The agent decides. The tool computes.**
>
> A model never does arithmetic, ranking, or combinatorial enumeration in its own head. It will
> eventually get it wrong, silently, and this product's entire claim is price honesty. Every tool
> below is a thin wrapper around a function already exported from `@wayfare/orchestrator` — none
> of that logic is reimplemented here.

| # | agent | what the LLM decides | tools it must call |
|---|---|---|---|
| 1 | `intake` | interpret the sentence, resolve ambiguity, infer what's unstated | — |
| 2 | `persona` | read free-text signals into weights, and explain the reasoning | — |
| 3 | `planQueries` | which kinds to shop, how to widen on retry, what hints matter | `build_query` |
| 4 | `search` | which queries to run, and when coverage is enough | `run_search` |
| 5 | `verify` | which entities look suspicious, what the cross-check means | `cross_check` |
| 6 | `match` | how to weigh trade-offs the persona implies but doesn't state | `score_options`, `compute_budget` |
| 7 | `supervisor` | which windows and branches are worth exploring, when to stop | `enumerate_itineraries`, `compute_total` |
| 8 | `select` | pick one finalist and justify the trade-off | — (reasons over #7's tool output) |
| 9 | `reprice` | interpret drift; is this still honestly bookable? | `fetch_current_price` |
| 10 | `critic` | grade the plan, name blockers, choose remedies | `compute_budget` |

Ten rows because `select` is split out of `supervisor` — the search and the choice are different
jobs, and separating them makes both promptable.

Every node has the same shape: **ask the model for a decision → run the tool for the numbers →
merge.** If the agent isn't allowlisted, a ceiling is spent, dry-run is on, or the model errors,
the decision also comes from `@wayfare/orchestrator`. The plan always lands.

## Structured output

Every agent uses the **existing** Zod schemas — no parallel types, and the contract stays shared
with the frontend:

| agent | schema |
|---|---|
| `intake` | `TripRequestSchema` |
| `persona` | `PersonaSchema` |
| `planQueries` | `z.array(SearchQuerySchema)` |
| `verify` | `z.array(VerifiedOptionSchema)` |
| `match` | `z.record(z.array(RankedOptionSchema))` |
| `supervisor` | `z.array(ItineraryCombinationSchema)` |
| `select` | `SelectionSchema` — `{ chosenIndex, rationale }` (new) |
| `reprice` | `ItineraryConfirmationSchema` |
| `critic` | `CriticReportSchema` |

An off-schema response surfaces as a `SchemaValidationError` — **never a silent coercion**.

## Environment variables

| var | default | meaning |
|---|---|---|
| `WAYFARE_LLM_ORCHESTRATOR` | *(unset — off)* | Master switch. Must be the literal `"true"`. Absent, empty, or malformed → disabled. **Never inferred from an API key being present.** |
| `WAYFARE_LLM_AGENTS` | all ten | Comma-separated allowlist. Any agent not listed falls back to the deterministic implementation — so `intake,persona,critic` keeps everything else free, and makes cost/quality ablations possible. |
| `WAYFARE_LLM_MAX_CALLS` | `30` | Hard ceiling on model calls per plan. On reaching it the remaining nodes complete deterministically and a trace event is emitted. **Never throws.** |
| `WAYFARE_LLM_MAX_TOKENS` | `120000` | Hard token ceiling per plan. Same degrade-don't-throw behaviour. |
| `WAYFARE_LLM_MAX_PASSES` | `2` | Retry budget — lower than the deterministic path's 3, because each pass is ~10 calls. |
| `WAYFARE_LLM_DRY_RUN` | `false` | Build and log every prompt and tool schema **without calling the API**. A complete, inspectable transcript at zero cost — this is how the prompts get developed. |

Both ceilings **degrade rather than throw**: a half-finished trip is a worse outcome than a fully
deterministic one, and an exception mid-graph produces exactly that.

## Cost accounting

Every agent emits `{ agent, inputTokens, outputTokens, toolCalls, ms }` through the existing
`Tracer`, and the result carries a `usage()` summary:

```ts
const plan = await orchestrator.plan(prompt, profile);
plan.usage;      // { calls, inputTokens, outputTokens, totalTokens, toolCalls, ms, capped, perAgent }
plan.rationale;  // the select agent's justification for the finalist
```

## Wiring

```ts
import { createOrchestrator } from "@wayfare/orchestrator-llm";

const orchestrator = createOrchestrator(providers, { onEvent });
```

Returns the LangGraph orchestrator when the flag is on **and** a key is present (or a model is
injected, or dry-run is on); otherwise the deterministic `Orchestrator`. Both satisfy the same
`Planner` interface.

`Planner` is declared here rather than in `@wayfare/shared` because its signature needs
`PlanResult` and `TravelerProfile`, which live in `@wayfare/orchestrator` — and `@wayfare/shared`
must not depend on `@wayfare/orchestrator`, which would invert the package graph.

The shared `SearchLimits` is threaded through, so the LLM path inherits the same per-provider
concurrency cap, in-flight coalescing, and TTL cache as the deterministic one. Not duplicated.

## Tests

```bash
pnpm --filter @wayfare/orchestrator-llm test
```

All ten run **offline with no `ANTHROPIC_API_KEY`**, against a stub chat model returning canned,
schema-valid responses:

1. full graph runs end to end → schema-valid `PlanResult`
2. critic failure triggers exactly one retry, and the second pass is widened
3. call ceiling honoured — past the cap, agents fall back deterministically
4. token ceiling honoured the same way
5. `WAYFARE_LLM_AGENTS=intake,critic` → exactly those two call the model
6. flag unset → factory returns the deterministic orchestrator, zero model calls
7. dry-run makes zero model calls and still emits a full transcript
8. an off-schema response surfaces as a validation error
9. **tool boundary** — every arithmetic result traces to a tool call, not to model text
10. the flag is never inferred from anything but an explicit `"true"`

## Non-goals

No prompt tuning beyond passing tests. No streaming from agents. No web app changes. No
fine-tuning. No new providers. No evaluation harness — that is its own PR.
