---
name: wayfare-planner-dual-path
description: Why Wayfare's server has both a deterministic planner and an Anthropic agent loop
metadata:
  type: project
---

Wayfare's `apps/server` planning engine is **dual-path**, both driving the identical four
tools (`search_flights`, `search_stays`, `search_activities`, `compute_budget`) and emitting
the identical SSE protocol (`status`/`partial`/`assumption`/`message`/`complete`/`error`):

1. **Deterministic code planner** — the default + test engine. Runs scour→rank→assemble→cost
   purely in code over the seeded mock provider. Needs no API key, so the server boots and
   tests run offline. This is what satisfies NFR-6 (determinism) and fixture conformance.
2. **Anthropic tool-use loop** (`claude-opus-4-8`) — the production path per AGENT_DESIGN.md,
   used when `ANTHROPIC_API_KEY` is set. Bounded turns/tool calls.

**Why:** the brief mandates the Anthropic agent AND determinism AND "ANTHROPIC_API_KEY is the
only required env" AND fixture-matching. An LLM can't reproduce a fixture byte-for-shape
reliably, and tests can't call a live API. The deterministic planner resolves all of these;
the agent loop is the real product path. Both go through the same tools so swapping is invisible.

**How to apply:** keep the two planners behind one interface that streams the same events;
select by key presence / a PLANNER_MODE flag. Never let the agent invent prices — `compute_budget`
(deterministic code) is the only place totals are summed. See [[wayfare-fixtures-are-illustrative]].
