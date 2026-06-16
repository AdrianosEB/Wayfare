import { hashStr } from "./rng.js";

/**
 * Deterministic opaque ids. Clients must not parse them (API_CONTRACT.md). We derive ids
 * from a stable seed so the same plan reproduces the same ids run-to-run (NFR-6), which keeps
 * refinement diffs and itemRefs stable.
 */

const base36 = (n: number) => (n >>> 0).toString(36);

/** A deterministic id like `sess_a1b2c3`, derived from its seed parts. */
export function makeId(prefix: string, ...seed: Array<string | number>): string {
  return `${prefix}_${base36(hashStr(seed.join("|")))}`;
}
