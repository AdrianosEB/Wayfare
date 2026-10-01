import Anthropic from "@anthropic-ai/sdk";
import { config, useAgent } from "./config.js";
import { createApp } from "./app.js";
import { InMemorySessionStore } from "./session/store.js";
import { createInMemoryAuthDeps } from "./auth/index.js";
import type { RouteDeps } from "./routes/session.js";

/**
 * Entry point. Boots the API on :3000 (API_CONTRACT.md). Runs the deterministic mock planner
 * unless ANTHROPIC_API_KEY is set, in which case the agent loop drives planning.
 */
const now = () => config.now;
// useAgent() is true for PLANNER_MODE=agent even without a key, so check for the key here and
// fall back to the deterministic planner rather than fail at request time.
const agentEnabled = useAgent(config) && Boolean(config.anthropicApiKey);

const deps: RouteDeps = {
  store: new InMemorySessionStore(now),
  auth: createInMemoryAuthDeps(now),
  now,
  year: Number(config.now.slice(0, 4)) || 2026,
  useAgent: agentEnabled,
  model: config.anthropicModel,
  ...(config.anthropicApiKey ? { anthropic: new Anthropic({ apiKey: config.anthropicApiKey }) } : {}),
};

const app = createApp(deps);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `Wayfare API on :${config.port}, planner: ${agentEnabled ? `agent (${config.anthropicModel})` : "deterministic (mock)"}`,
  );
});
