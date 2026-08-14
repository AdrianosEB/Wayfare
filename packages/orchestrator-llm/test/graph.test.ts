import { describe, it, expect } from "vitest";
import { PlanResultSchema, Orchestrator } from "@wayfare/orchestrator";
import {
  createOrchestrator,
  LlmOrchestrator,
  DryRunModel,
  SchemaValidationError,
  AGENT_NAMES,
  readConfig,
  parseAgents,
  TOOL_NAMES,
  type LlmConfig,
  type LlmPlanResult,
} from "../src/index.js";
import { StubModel, primeStub, PROFILE, PROMPT, providers } from "./stub.js";

/**
 * The whole suite runs offline with no ANTHROPIC_API_KEY. Every model interaction goes through
 * StubModel; the only "real" work is the deterministic tools from @wayfare/orchestrator.
 */

function config(over: Partial<LlmConfig> = {}): LlmConfig {
  return {
    enabled: true,
    agents: new Set(AGENT_NAMES),
    maxCalls: 30,
    maxTokens: 120_000,
    dryRun: false,
    maxPasses: 2,
    model: "claude-opus-4-8",
    ...over,
  };
}

async function run(over: Partial<LlmConfig> = {}, stub = primeStub(new StubModel())) {
  const orch = new LlmOrchestrator({ providers: providers(), model: stub, config: config(over) });
  const plan = (await orch.plan(PROMPT, PROFILE)) as LlmPlanResult;
  return { plan, stub };
}

describe("LangGraph orchestrator", () => {
  it("(1) runs the full graph end to end and yields a schema-valid PlanResult", async () => {
    const { plan } = await run();
    expect(() => PlanResultSchema.parse(stripExtras(plan))).not.toThrow();
    expect(plan.itinerary).toBeDefined();
    expect(plan.budget.total).toBeGreaterThan(0);
  });

  it("(2) retries exactly once on critic failure, and the second pass is widened", async () => {
    const stub = primeStub(new StubModel());
    // force the critic to fail so the conditional edge loops back through `widen`
    stub.canned.set("critic", {
      passed: false,
      issues: [
        { severity: "blocker", code: "forced", message: "forced failure", remedy: "broaden_search" },
      ],
    });
    const { plan } = await run({}, stub);

    expect(plan.passes).toBe(2); // one retry, capped by maxPasses: 2
    const retries = plan.trace.filter((e) => e.agent === "llm" && e.event === "retry");
    expect(retries).toHaveLength(1);
    expect(Number(retries[0]?.detail?.breadthMultiplier)).toBeGreaterThan(1);
  });

  it("(3) honours the call ceiling — past the cap, agents fall back deterministically", async () => {
    const { plan, stub } = await run({ maxCalls: 2 });
    expect(stub.calls.length).toBe(2);
    expect(plan.usage.calls).toBe(2);
    expect(plan.usage.capped).toBe(true);
    expect(plan.usage.cappedReason).toBe("max_calls");
    // degraded, not thrown: a full plan still lands
    expect(plan.itinerary).toBeDefined();
  });

  it("(4) honours the token ceiling the same way", async () => {
    const { plan, stub } = await run({ maxTokens: 300 });
    // 150 tokens per stub call → the 3rd call is refused
    expect(stub.calls.length).toBe(2);
    expect(plan.usage.capped).toBe(true);
    expect(plan.usage.cappedReason).toBe("max_tokens");
    expect(plan.budget.total).toBeGreaterThan(0);
  });

  it("(5) WAYFARE_LLM_AGENTS=intake,critic → exactly those two call the model", async () => {
    const agents = parseAgents("intake,critic");
    const { stub } = await run({ agents });
    expect(new Set(stub.calls)).toEqual(new Set(["intake", "critic"]));
    expect(stub.calls.length).toBeLessThanOrEqual(3); // critic may run twice if it retries
  });

  it("(6) flag unset → factory returns the deterministic orchestrator, zero model calls", async () => {
    const stub = new StubModel();
    const planner = createOrchestrator(providers(), { env: {}, model: stub });
    expect(planner).toBeInstanceOf(Orchestrator);
    const plan = await planner.plan(PROMPT, PROFILE);
    expect(stub.calls).toHaveLength(0);
    expect(() => PlanResultSchema.parse(plan)).not.toThrow();
  });

  it("(7) dry-run makes zero model calls but emits a full transcript", async () => {
    const dry = new DryRunModel();
    const orch = new LlmOrchestrator({
      providers: providers(),
      model: dry,
      config: config({ dryRun: true }),
    });
    const plan = (await orch.plan(PROMPT, PROFILE)) as LlmPlanResult;

    expect(plan.usage.calls).toBe(0); // nothing billed
    expect(dry.transcript.length).toBeGreaterThanOrEqual(AGENT_NAMES.length);
    for (const entry of dry.transcript) {
      expect(entry.system.length).toBeGreaterThan(0);
      expect(entry.user.length).toBeGreaterThan(0);
    }
    expect(plan.itinerary).toBeDefined(); // still a complete plan
  });

  it("(8) an off-schema response surfaces as a validation error, never a silent coercion", async () => {
    const stub = primeStub(new StubModel());
    stub.offSchema.add("intake");
    const orch = new LlmOrchestrator({ providers: providers(), model: stub, config: config() });
    await expect(orch.plan(PROMPT, PROFILE)).rejects.toBeInstanceOf(SchemaValidationError);
  });

  it("(9) tool boundary — every arithmetic result traces to a tool call, not to model text", async () => {
    const calls: string[] = [];
    const orch = new LlmOrchestrator({
      providers: providers(),
      model: primeStub(new StubModel()),
      config: config(),
      onEvent: (e) => {
        if (e.agent === "tool") calls.push(e.event);
      },
    });
    const plan = (await orch.plan(PROMPT, PROFILE)) as LlmPlanResult;

    // the three computations that produce every number in the output
    expect(calls).toContain("run_search"); // prices came from providers
    expect(calls).toContain("cross_check"); // spreads/verdicts came from verify()
    expect(calls).toContain("score_options"); // ranking came from rankByKind()
    expect(calls).toContain("enumerate_itineraries"); // combinations came from the supervisor
    expect(calls).toContain("compute_budget"); // the total came from buildBudget()
    expect(calls).toContain("fetch_current_price"); // reprice came from repriceItinerary()
    expect(calls.every((c) => (TOOL_NAMES as readonly string[]).includes(c))).toBe(true);

    // and the budget really is the sum of its lines — computed, not narrated
    const sum = plan.budget.lines.reduce((a, l) => a + l.amount, 0);
    expect(plan.budget.total).toBe(sum);
  });

  it("(10) config parsing refuses to infer the flag from anything but an explicit \"true\"", () => {
    expect(readConfig({}).enabled).toBe(false);
    expect(readConfig({ ANTHROPIC_API_KEY: "sk-live" }).enabled).toBe(false);
    expect(readConfig({ WAYFARE_LLM_ORCHESTRATOR: "1" }).enabled).toBe(false);
    expect(readConfig({ WAYFARE_LLM_ORCHESTRATOR: "TRUE" }).enabled).toBe(false);
    expect(readConfig({ WAYFARE_LLM_ORCHESTRATOR: "true" }).enabled).toBe(true);
    expect(readConfig({}).maxPasses).toBe(2);
  });
});

/** PlanResult is the shared contract; the LLM path adds usage/rationale on top. */
function stripExtras(plan: LlmPlanResult) {
  const { usage: _u, rationale: _r, ...rest } = plan;
  return rest;
}
