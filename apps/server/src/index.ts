import Anthropic from "@anthropic-ai/sdk";
import { config, useAgent } from "./config.js";
import { createApp } from "./app.js";
import { InMemorySessionStore } from "./session/store.js";
import type { RouteDeps } from "./routes/session.js";

/**
 * Entry point. Boots the API on :3000 (API_CONTRACT.md). The deterministic mock planner is the
 * default run mode (no key needed); when ANTHROPIC_API_KEY is set the live agent loop drives
 * planning. Keys live only here, server-side (NFR-4).
 */
const now = () => config.now;
const agentEnabled = useAgent(config) && Boolean(config.anthropicApiKey);

const deps: RouteDeps = {
  store: new InMemorySessionStore(now),
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
    `Wayfare API on :${config.port} — planner: ${agentEnabled ? `agent (${config.anthropicModel})` : "deterministic (mock)"}`,
  );
});
