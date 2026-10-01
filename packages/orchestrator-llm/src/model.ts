import type { z } from "zod";
import type { AgentName, LlmConfig } from "./config.js";

/**
 * Nodes talk to a `StructuredModel`, never to ChatAnthropic directly, so the test stub, dry-run
 * mode and per-agent fallback all work without a network. The real implementation wraps
 * `ChatAnthropic#withStructuredOutput` and is imported lazily, so the package loads with no API
 * key present.
 */

export interface StructuredCall<T> {
  agent: AgentName;
  system: string;
  user: string;
  /**
   * Input is left unconstrained. Several shared schemas use `.default([])`, so their Zod input
   * and output types differ, and a plain `ZodType<T>` would bind T to the pre-default shape.
   */
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /**
   * Optional laxer schema for the provider's structured-output binding, for when the strict
   * `schema` rejects a recoverable formatting slip. `repair` then normalises the shape and
   * `schema` still validates the result.
   */
  wireSchema?: z.ZodType<unknown, z.ZodTypeDef, unknown>;
  /** Normalise a wire-shaped object before strict validation. Must be pure and deterministic. */
  repair?: (raw: unknown) => unknown;
}

export interface StructuredResult<T> {
  value: T;
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredModel {
  invoke<T>(call: StructuredCall<T>): Promise<StructuredResult<T>>;
}

/** Dry-run transcript entry: one prompt as it would have been sent. */
export interface TranscriptEntry {
  agent: AgentName;
  system: string;
  user: string;
  /** JSON-Schema-ish shape name, so the transcript shows what was expected back. */
  schema: string;
  tools: string[];
}

/**
 * Records the prompt that would have been sent, then throws a sentinel so the calling node
 * falls back to its deterministic implementation. No API calls.
 */
export class DryRunModel implements StructuredModel {
  readonly transcript: TranscriptEntry[] = [];

  constructor(private readonly toolsByAgent: Partial<Record<AgentName, string[]>> = {}) {}

  async invoke<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
    this.transcript.push({
      agent: call.agent,
      system: call.system,
      user: call.user,
      schema: call.schema.description ?? call.schema.constructor.name,
      tools: this.toolsByAgent[call.agent] ?? [],
    });
    throw new DryRunSkip(call.agent);
  }
}

/** Sentinel, not an error: there is no model output, so use the deterministic path. */
export class DryRunSkip extends Error {
  constructor(readonly agent: AgentName) {
    super(`dry-run: skipped ${agent}`);
    this.name = "DryRunSkip";
  }
}

/** Raised when a model returns something the shared schema rejects. Never coerced away. */
export class SchemaValidationError extends Error {
  constructor(
    readonly agent: AgentName,
    readonly issues: unknown,
  ) {
    // Issues go in the message, not just on the instance, because callers log `String(err)`.
    super(
      `agent "${agent}" returned an off-schema response: ` +
        JSON.stringify(issues)?.slice(0, 600),
    );
    this.name = "SchemaValidationError";
  }
}

/**
 * Construction options for ChatAnthropic, exported so tests can assert on the request shape
 * without a network call.
 *
 * invocationKwargs is required: Claude Opus 4.7+ / Sonnet 5 reject sampling parameters, but
 * @langchain/anthropic (0.3.x) still sends its defaults (temperature 1, top_k/top_p -1) for
 * models it doesn't special-case by name. Every request then 400s ("`top_p` cannot be set to
 * -1") and decide() silently falls back to heuristics. Constructor nulls can't fix it
 * (`fields?.topP ?? -1`). invocationKwargs spreads last into the request body, and explicit
 * undefined removes the keys. Regression test in test/model.test.ts.
 */
export function anthropicChatOptions(config: LlmConfig, apiKey: string) {
  return {
    model: config.model,
    apiKey,
    maxTokens: 4096,
    invocationKwargs: { temperature: undefined, top_k: undefined, top_p: undefined },
  };
}

/**
 * `ChatAnthropic` is imported dynamically so that importing this package never pulls the SDK or
 * requires a key.
 */
export class AnthropicStructuredModel implements StructuredModel {
  #chat: unknown;

  constructor(
    private readonly config: LlmConfig,
    private readonly apiKey: string,
  ) {}

  async #model(): Promise<{
    withStructuredOutput: (schema: unknown, opts?: unknown) => {
      invoke: (msgs: unknown) => Promise<unknown>;
    };
  }> {
    if (!this.#chat) {
      const { ChatAnthropic } = await import("@langchain/anthropic");
      this.#chat = new ChatAnthropic(anthropicChatOptions(this.config, this.apiKey));
    }
    return this.#chat as never;
  }

  async invoke<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
    const chat = await this.#model();
    // The wire schema, when a caller supplies one, is only what the provider's parser is given.
    // The strict `call.schema` below is still the contract.
    const structured = chat.withStructuredOutput(call.wireSchema ?? call.schema, {
      name: call.agent,
    });
    const raw = await structured.invoke([
      { role: "system", content: call.system },
      { role: "user", content: call.user },
    ]);

    // Validate against the shared schema ourselves too, so an off-schema response surfaces as a
    // validation failure. `repair` may only move a misplaced value, never invent one.
    const parsed = call.schema.safeParse(call.repair ? call.repair(raw) : raw);
    if (!parsed.success) throw new SchemaValidationError(call.agent, parsed.error.issues);

    // LangChain's structured-output path does not surface usage on the parsed value; charge a
    // conservative estimate so the ceilings still bite. Exact accounting arrives with streaming.
    const inputTokens = Math.ceil((call.system.length + call.user.length) / 4);
    const outputTokens = Math.ceil(JSON.stringify(parsed.data).length / 4);
    return { value: parsed.data, inputTokens, outputTokens };
  }
}

// Local student

/**
 * Extracts the first complete JSON object from a completion. The 1.5B student sometimes wraps
 * its JSON in a ```json fence or adds a sentence either side, so this scans for the first
 * balanced `{...}`, tracking strings and escapes. Returns undefined if there is none.
 */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

/**
 * The locally distilled student, served over an OpenAI-compatible endpoint (`mlx_lm.server`).
 *
 * `system` and `user` are sent verbatim. `gen-persona-data.ts` built the training set from the
 * exact prompt the production node sends, so anything else puts the student off its training
 * distribution.
 *
 * mlx_lm has no equivalent of Anthropic's tool-schema forcing, so the response is parsed as
 * bare JSON and validated against the same shared schema the Anthropic path uses.
 */
export class LocalStructuredModel implements StructuredModel {
  constructor(
    private readonly config: LlmConfig,
    private readonly baseUrl: string,
  ) {}

  async invoke<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
    const url = `${this.baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.localModel,
        messages: [
          { role: "system", content: call.system },
          { role: "user", content: call.user },
        ],
        // Greedy: the student was distilled toward one target per input, so sampling only adds
        // schema violations. Deterministic decoding also keeps plans reproducible.
        temperature: 0,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      throw new Error(`local model ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }

    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    const raw = extractJsonObject(content);

    // Same contract as the Anthropic path: wireSchema (if any) is the laxer provider-facing
    // shape, `repair` may only move a value, and `call.schema` remains what downstream sees.
    const wire = call.wireSchema ?? call.schema;
    const onWire = wire.safeParse(raw);
    const candidate = onWire.success ? onWire.data : raw;
    const parsed = call.schema.safeParse(call.repair ? call.repair(candidate) : candidate);
    if (!parsed.success) throw new SchemaValidationError(call.agent, parsed.error.issues);

    return {
      value: parsed.data,
      inputTokens:
        body.usage?.prompt_tokens ?? Math.ceil((call.system.length + call.user.length) / 4),
      outputTokens: body.usage?.completion_tokens ?? Math.ceil(content.length / 4),
    };
  }
}
