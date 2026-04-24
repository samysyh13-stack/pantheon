import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/game/engine/random';

describe('createRng', () => {
  it('is deterministic given the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seq = (rng: ReturnType<typeof createRng>) =>
      Array.from({ length: 10 }, () => rng.next());
    expect(seq(a)).toEqual(seq(b));
  });

  it('produces values in [0, 1)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int respects bounds', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('pick returns an element from the array', () => {
    const rng = createRng(123);
    const arr = ['a', 'b', 'c', 'd'] as const;
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it('pick throws on empty array', () => {
    const rng = createRng(0);
    expect(() => rng.pick([])).toThrow();
  });

  it('different seeds yield different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });
});
