import { hashStr } from "./rng.js";

/**
 * Opaque ids derived from a stable seed, so the same plan gets the same ids on every run
 * (NFR-6) and refinement diffs and itemRefs stay stable. Clients must not parse them
 * (API_CONTRACT.md).
 */

const base36 = (n: number) => (n >>> 0).toString(36);

/** An id like `sess_a1b2c3`, derived from its seed parts. */
export function makeId(prefix: string, ...seed: Array<string | number>): string {
  return `${prefix}_${base36(hashStr(seed.join("|")))}`;
}
