import type { z } from "zod";
import type { AgentName, LlmConfig } from "./config.js";

/**
 * The model seam.
 *
 * Every node talks to a `StructuredModel`, never to ChatAnthropic directly. That keeps three
 * things possible without any network: the stub used by the whole test suite, dry-run mode, and
 * per-agent fallback. The real implementation is a thin wrapper over
 * `ChatAnthropic#withStructuredOutput`, which is imported lazily so the package can be loaded,
 * type-checked, and tested with no API key present.
 */

export interface StructuredCall<T> {
  agent: AgentName;
  system: string;
  user: string;
  /**
   * Input is left unconstrained on purpose. Several shared schemas use `.default([])`, so their
   * Zod *input* and *output* types differ; binding `T` to a plain `ZodType<T>` would unify T
   * with the input side and hand every caller the pre-default shape.
   */
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
}

export interface StructuredResult<T> {
  value: T;
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredModel {
  invoke<T>(call: StructuredCall<T>): Promise<StructuredResult<T>>;
}

/** One prompt as it would have been sent — the dry-run transcript entry. */
export interface TranscriptEntry {
  agent: AgentName;
  system: string;
  user: string;
  /** JSON-Schema-ish shape name, so the transcript shows what was expected back. */
  schema: string;
  tools: string[];
}

/**
 * Dry-run model: records the exact prompt that *would* have been sent, then throws a sentinel
 * so the calling node falls back to its deterministic implementation. Zero API calls, complete
 * inspectable transcript — this is how the prompts get developed.
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

/** Sentinel: not an error condition, just "no model output — use the deterministic path". */
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
    super(`agent "${agent}" returned an off-schema response`);
    this.name = "SchemaValidationError";
  }
}

/**
 * Construction options for the underlying ChatAnthropic. Exported so the test suite can assert
 * on the *request shape* these options produce without a network call.
 *
 * The invocationKwargs line is load-bearing: Claude Opus 4.7+ / Sonnet 5 reject sampling
 * parameters, but @langchain/anthropic (0.3.x) still sends its defaults (temperature 1,
 * top_k/top_p -1) for models it doesn't special-case by name — every request 400s
 * ("`top_p` cannot be set to -1") and, because decide() degrades on model errors, the whole
 * LLM path silently fell back to heuristics. Constructor nulls can't fix it
 * (`fields?.topP ?? -1`); invocationKwargs spreads last into the request body, and explicit
 * undefined removes the keys entirely. Covered by a regression test in test/model.test.ts.
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
 * The real model. `ChatAnthropic` is imported dynamically so that merely importing this package
 * — which the tests and the deterministic path both do — never pulls the SDK or requires a key.
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
    const structured = chat.withStructuredOutput(call.schema, { name: call.agent });
    const raw = await structured.invoke([
      { role: "system", content: call.system },
      { role: "user", content: call.user },
    ]);

    // Validate against the shared schema ourselves too: an off-schema response must surface as
    // a validation failure, never a silent coercion.
    const parsed = call.schema.safeParse(raw);
    if (!parsed.success) throw new SchemaValidationError(call.agent, parsed.error.issues);

    // LangChain's structured-output path does not surface usage on the parsed value; charge a
    // conservative estimate so the ceilings still bite. Exact accounting arrives with streaming.
    const inputTokens = Math.ceil((call.system.length + call.user.length) / 4);
    const outputTokens = Math.ceil(JSON.stringify(parsed.data).length / 4);
    return { value: parsed.data, inputTokens, outputTokens };
  }
}
