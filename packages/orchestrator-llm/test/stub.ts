import type { z } from "zod";
import {
  intake,
  derivePersona,
  planQueries,
  Tracer,
  mockProviderRegistry,
  type TravelerProfile,
} from "@wayfare/orchestrator";
import type { AgentName } from "../src/config.js";
import type { StructuredCall, StructuredModel, StructuredResult } from "../src/model.js";

/**
 * StubModel — a chat model that never touches the network.
 *
 * It returns canned, schema-valid responses derived from the deterministic implementations, so
 * the whole graph can run end to end with no key. Every call is recorded, which is what the
 * ceiling, allowlist, and tool-boundary tests assert against.
 */
export class StubModel implements StructuredModel {
  readonly calls: AgentName[] = [];
  /** agents that should return something the schema rejects, to test validation surfacing. */
  offSchema = new Set<AgentName>();
  /** canned per-agent overrides. */
  readonly canned = new Map<AgentName, unknown>();

  constructor(
    private readonly inputTokens = 100,
    private readonly outputTokens = 50,
  ) {}

  async invoke<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
    this.calls.push(call.agent);

    if (this.offSchema.has(call.agent)) {
      const parsed = (call.schema as z.ZodTypeAny).safeParse({ __bogus: true });
      if (!parsed.success) {
        const { SchemaValidationError } = await import("../src/model.js");
        throw new SchemaValidationError(call.agent, parsed.error.issues);
      }
    }

    const canned = this.canned.get(call.agent);
    if (canned !== undefined) {
      return {
        value: (call.schema as z.ZodTypeAny).parse(canned) as T,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
      };
    }

    // No canned value: signal "no opinion" with an empty/neutral response the nodes treat as
    // a fallback trigger. Nodes are written so an empty array means "use the tool output".
    const empty = (call.schema as z.ZodTypeAny).safeParse([]);
    if (empty.success) {
      return { value: empty.data as T, inputTokens: this.inputTokens, outputTokens: this.outputTokens };
    }
    throw new Error(`stub has no canned response for ${call.agent}`);
  }
}

export const PROFILE: TravelerProfile = {
  id: "u_test",
  homeCity: "London",
  signals: ["foodie on a budget", "wants to be central"],
  budget: { amount: 1800, currency: "EUR", type: "soft" },
  partySize: { adults: 2 },
  mustHaves: [],
  avoid: [],
};

export const PROMPT = "5 day foodie trip to Naxos in September, budget around €1800 for two";

/** Canned responses good enough for every agent, built from the deterministic implementations. */
export function primeStub(stub: StubModel): StubModel {
  const tracer = new Tracer();
  const { request, destination } = intake(PROMPT, PROFILE, tracer);
  const persona = derivePersona(PROFILE, request, tracer);

  stub.canned.set("intake", request);
  stub.canned.set("persona", persona);
  stub.canned.set(
    "planQueries",
    planQueries(request, persona, { destination, breadthMultiplier: 1 }),
  );
  stub.canned.set("select", { chosenIndex: 0, rationale: "Cheapest verified option in budget." });
  return stub;
}

export const providers = () => mockProviderRegistry();
