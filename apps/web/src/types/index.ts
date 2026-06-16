/**
 * The single import surface for wire types — the swap point.
 *
 * Today it re-exports the local mirror in `./wire`. When the backend publishes
 * `packages/shared`, change the one line below to:
 *
 *     export * from '@wayfare/shared';
 *
 * and delete `./wire`. Every component imports from `@/types`, so nothing else changes.
 */
export * from './wire';
