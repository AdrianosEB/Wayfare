import { describe, expect, it } from "vitest";
import { ChatAnthropic } from "@langchain/anthropic";
import { z } from "zod";
import {
  LocalStructuredModel,
  SchemaValidationError,
  anthropicChatOptions,
  extractJsonObject,
} from "../src/model.js";
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
  localBaseUrl: undefined,
  localModel: "unused",
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

/* --------------------------------------------------------------------------- *
 * The local student seam. `training/` produces a model that mlx_lm.server can
 * serve; these cover the two things that path gets wrong in practice — a small
 * model wrapping its JSON in prose, and an off-schema answer that must degrade
 * rather than be coerced.
 * --------------------------------------------------------------------------- */

describe("extractJsonObject — a 1.5B student does not always return bare JSON", () => {
  it("reads a bare object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("reads an object out of a ```json fence", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("reads an object with prose either side", () => {
    expect(extractJsonObject('Sure! {"a":1} hope that helps')).toEqual({ a: 1 });
  });

  it("stops at the matching brace, ignoring trailing garbage", () => {
    // RESULTS.md records exactly this mode: valid JSON followed by `""}` or `"}"}`.
    expect(extractJsonObject('{"a":{"b":2}}""}')).toEqual({ a: { b: 2 } });
  });

  it("does not miscount braces inside strings or escapes", () => {
    expect(extractJsonObject('{"s":"a{b}c \\" }","n":1}')).toEqual({ s: 'a{b}c " }', n: 1 });
  });

  it("returns undefined when there is no balanced object", () => {
    expect(extractJsonObject('{"a":1')).toBeUndefined();
    expect(extractJsonObject("no json here")).toBeUndefined();
  });
});

describe("LocalStructuredModel", () => {
  const schema = z.object({ pace: z.enum(["relaxed", "moderate", "packed"]) }).strict();

  function modelReturning(content: string, usage?: unknown) {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fetchStub = (async (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) as Record<string, unknown> });
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content } }], usage }),
      };
    }) as unknown as typeof fetch;
    const original = globalThis.fetch;
    globalThis.fetch = fetchStub;
    const restore = () => {
      globalThis.fetch = original;
    };
    return { model: new LocalStructuredModel(cfg("local"), "http://localhost:8080/"), calls, restore };
  }

  const call = { agent: "persona" as const, system: "SYS", user: "USR", schema };

  it("posts to the OpenAI-compatible path and returns the parsed value", async () => {
    const { model, calls, restore } = modelReturning('{"pace":"relaxed"}', {
      prompt_tokens: 11,
      completion_tokens: 7,
    });
    try {
      const out = await model.invoke(call);
      expect(out.value).toEqual({ pace: "relaxed" });
      // provider-reported usage is preferred over an estimate
      expect(out.inputTokens).toBe(11);
      expect(out.outputTokens).toBe(7);
      // trailing slash on the base URL must not double up
      expect(calls[0]!.url).toBe("http://localhost:8080/v1/chat/completions");
      expect(calls[0]!.body.messages).toEqual([
        { role: "system", content: "SYS" },
        { role: "user", content: "USR" },
      ]);
    } finally {
      restore();
    }
  });

  it("decodes greedily — sampling only adds schema violations for a distilled student", async () => {
    const { model, calls, restore } = modelReturning('{"pace":"relaxed"}');
    try {
      await model.invoke(call);
      expect(calls[0]!.body.temperature).toBe(0);
    } finally {
      restore();
    }
  });

  it("throws SchemaValidationError on an off-schema answer rather than coercing", async () => {
    // The real failure this guards: `training/fused` emits pace as an array, and the caller
    // (decide()) must be able to fall back to the deterministic agent.
    const { model, restore } = modelReturning('{"pace":["family-friendly","relaxed"]}');
    try {
      await expect(model.invoke(call)).rejects.toThrow(SchemaValidationError);
    } finally {
      restore();
    }
  });

  it("throws when the response carries no JSON at all", async () => {
    const { model, restore } = modelReturning("I am afraid I cannot help with that.");
    try {
      await expect(model.invoke(call)).rejects.toThrow(SchemaValidationError);
    } finally {
      restore();
    }
  });
});
