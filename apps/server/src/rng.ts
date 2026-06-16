/**
 * Deterministic hashing + PRNG. Every mock number is seeded by hash(destination, dates,
 * party, slot) so the same request always yields the same plan (NFR-6).
 */

/** FNV-1a 32-bit hash of a string → unsigned int. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Combine arbitrary seed parts into a single hash. */
export function seedOf(...parts: Array<string | number>): number {
  return hashStr(parts.join("|"));
}

/** mulberry32 PRNG — fast, deterministic, decent distribution. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small seeded generator with convenience helpers. */
export class Rng {
  private next: () => number;
  constructor(...seed: Array<string | number>) {
    this.next = mulberry32(seedOf(...seed));
  }
  /** float in [0, 1). */
  float(): number {
    return this.next();
  }
  /** integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  /** float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  /** pick one element. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("Rng.pick on empty array");
    return arr[Math.floor(this.next() * arr.length)] as T;
  }
  /** true with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}
