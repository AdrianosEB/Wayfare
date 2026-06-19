/**
 * The single import surface for wire types.
 *
 * Re-exports `@wayfare/shared` — the ONE source of truth for the I/O contract, shared
 * verbatim with the API server. Every component imports from `@/types`, never from a local
 * mirror. Do not redefine wire shapes here; if you need a field that doesn't exist, change
 * `packages/shared` + API_CONTRACT.md + the fixtures, not this file.
 */
export * from '@wayfare/shared';

/**
 * Auth wire types (AUTH_CONTRACT). Defined locally for now and re-exported here so the
 * `@/types` barrel stays the single import surface. When `@wayfare/shared` ships the
 * canonical auth shapes, delete `./auth` and add it to the re-export above — no callers change.
 */
export * from './auth';
