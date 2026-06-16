/**
 * @wayfare/shared — the single source of truth for the Wayfare wire contract.
 *
 * TypeScript types + Zod schemas that serialize to exactly the JSON in API_CONTRACT.md and
 * docs/fixtures/. Imported verbatim by both the API server (which produces these shapes)
 * and the web client (which renders them). Do not invent or rename wire fields here without
 * first changing API_CONTRACT.md + the fixtures.
 */
export * from "./common.js";
export * from "./listing.js";
export * from "./request.js";
export * from "./refinement.js";
export * from "./budget.js";
export * from "./trip.js";
export * from "./session.js";
export * from "./api.js";
export * from "./sse.js";
