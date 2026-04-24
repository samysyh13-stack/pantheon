// Seeded RNG for deterministic simulation (ADR-0006).
// Gameplay systems MUST use this, never Math.random().

export interface Rng {
  next: () => number; // [0, 1)
  int: (minInclusive: number, maxExclusive: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  seed: number;
}

// mulberry32 — small, fast, deterministic, good statistical properties
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => Math.floor(next() * (hi - lo)) + lo;
  const pick = <T>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error('pick: empty array');
    return arr[int(0, arr.length)]!;
  };
  return { next, int, pick, seed };
}
