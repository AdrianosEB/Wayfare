import type { Tracer } from "@wayfare/orchestrator";
import type { AgentName, LlmConfig } from "./config.js";

/**
 * LlmBudget — the spend gate every node checks before it is allowed to call a model.
 *
 * Both ceilings **degrade, never throw**. When either is reached the remaining nodes complete
 * deterministically and the plan still lands: a half-finished trip is a worse outcome than a
 * fully deterministic one, and an exception mid-graph would produce exactly that.
 */
export interface AgentUsage {
  agent: AgentName;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  ms: number;
  /** false when this node fell back to the deterministic implementation. */
  llm: boolean;
}

export interface UsageSummary {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  toolCalls: number;
  ms: number;
  /** true if a ceiling stopped further model calls partway through. */
  capped: boolean;
  cappedReason?: "max_calls" | "max_tokens";
  perAgent: AgentUsage[];
}

export class LlmBudget {
  #calls = 0;
  #inputTokens = 0;
  #outputTokens = 0;
  #toolCalls = 0;
  #ms = 0;
  #capped = false;
  #cappedReason?: "max_calls" | "max_tokens";
  readonly #perAgent: AgentUsage[] = [];

  constructor(
    private readonly config: LlmConfig,
    private readonly tracer: Tracer,
  ) {}

  /**
   * May `agent` call a model right now? False when the agent isn't in the allowlist, when
   * dry-run is on, or when either ceiling is spent. Emits a trace event the first time a
   * ceiling bites so the reason is visible in the plan's own audit trail.
   */
  allows(agent: AgentName): boolean {
    if (!this.config.agents.has(agent)) return false;
    if (this.#calls >= this.config.maxCalls) {
      this.#markCapped("max_calls", agent);
      return false;
    }
    if (this.#inputTokens + this.#outputTokens >= this.config.maxTokens) {
      this.#markCapped("max_tokens", agent);
      return false;
    }
    return true;
  }

  #markCapped(reason: "max_calls" | "max_tokens", agent: AgentName): void {
    if (this.#capped) return;
    this.#capped = true;
    this.#cappedReason = reason;
    this.tracer.emit("llm", "ceiling_reached", {
      reason,
      atAgent: agent,
      calls: this.#calls,
      tokens: this.#inputTokens + this.#outputTokens,
    });
  }

  record(usage: AgentUsage): void {
    if (usage.llm) this.#calls++;
    this.#inputTokens += usage.inputTokens;
    this.#outputTokens += usage.outputTokens;
    this.#toolCalls += usage.toolCalls;
    this.#ms += usage.ms;
    this.#perAgent.push(usage);
    this.tracer.emit("llm", "agent_usage", { ...usage });
  }

  summary(): UsageSummary {
    return {
      calls: this.#calls,
      inputTokens: this.#inputTokens,
      outputTokens: this.#outputTokens,
      totalTokens: this.#inputTokens + this.#outputTokens,
      toolCalls: this.#toolCalls,
      ms: this.#ms,
      capped: this.#capped,
      ...(this.#cappedReason ? { cappedReason: this.#cappedReason } : {}),
      perAgent: [...this.#perAgent],
    };
  }
}
