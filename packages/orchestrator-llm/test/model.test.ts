import { describe, expect, it } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { anthropicChatOptions } from "../src/model.js";
import type { LlmConfig } from "../src/config.js";

/**
 * Regression: @langchain/anthropic 0.3.x sends its default sampling parameters (temperature 1,
 * top_k -1, top_p -1) for models it doesn't special-case by name. Claude Opus 4.7+ and Sonnet 5
 * reject sampling parameters outright, so every request 400'd ("`top_p` cannot be set to -1") —
 * and because decide() degrades on model errors, the whole LLM path silently fell back to the
 * deterministic heuristics. Found when a 25-example teacher pass produced 25 fallbacks.
 *
 * The fix rides on invocationKwargs spreading LAST into the request body, with explicit
 * undefined deleting each key. This test drives the REAL ChatAnthropic (no network — request
 * construction only) so a langchain upgrade that changes either behavior fails loudly here
 * instead of silently degrading production to heuristics again.
 */

const cfg = (model: string): LlmConfig => ({
  enabled: true,
  agents: new Set(["persona"]),
  maxCalls: 1,
  maxTokens: 1000,
  dryRun: false,
  maxPasses: 1,
  model,
});

/** What actually goes on the wire: JSON serialisation drops undefined-valued keys. */
function wireParams(model: string): Record<string, unknown> {
  const chat = new ChatAnthropic(anthropicChatOptions(cfg(model), "sk-test-not-a-real-key"));
  return JSON.parse(JSON.stringify(chat.invocationParams())) as Record<string, unknown>;
}

describe("anthropicChatOptions — sampling params must never reach the wire", () => {
  // Models langchain 0.3.34 does NOT special-case (the original bug), plus one it does:
  // the invariant must hold regardless of which side of langchain's allowlist a model is on.
  for (const model of ["claude-opus-4-8", "claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5"]) {
    it(`sends no temperature/top_k/top_p for ${model}`, () => {
      const params = wireParams(model);
      expect(params).not.toHaveProperty("temperature");
      expect(params).not.toHaveProperty("top_k");
      expect(params).not.toHaveProperty("top_p");
    });
  }

  it("still sends the fields requests actually need", () => {
    const params = wireParams("claude-sonnet-5");
    expect(params.model).toBe("claude-sonnet-5");
    expect(params.max_tokens).toBe(4096);
  });
});
