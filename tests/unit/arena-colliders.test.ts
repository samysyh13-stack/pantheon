import { describe, it, expect } from 'vitest';
import {
  ARENA_LAYOUT,
  SHRINES,
  STANDING_STONES,
  PICKUP_SPAWN_POSITIONS,
  SPAWN_POINTS,
} from '../../src/game/arenas/sacredGrove';

describe('ARENA_LAYOUT', () => {
  it('has ordered nested radii', () => {
    expect(ARENA_LAYOUT.daisRadius).toBeLessThan(ARENA_LAYOUT.innerRingRadius);
    expect(ARENA_LAYOUT.innerRingRadius).toBeLessThan(ARENA_LAYOUT.outerRingRadius);
    expect(ARENA_LAYOUT.outerRingRadius).toBeLessThan(ARENA_LAYOUT.stormRadius);
  });
  it('ground size contains storm boundary', () => {
    expect(ARENA_LAYOUT.groundSize).toBeGreaterThanOrEqual(ARENA_LAYOUT.stormRadius * 2);
  });
});

describe('SHRINES', () => {
  it('has exactly 4 entries', () => {
    expect(SHRINES).toHaveLength(4);
  });
  it('are placed at cardinal compass points, 10 m from center', () => {
    const magnitudes = SHRINES.map((s) => Math.hypot(s.position.x, s.position.z));
    magnitudes.forEach((m) => expect(m).toBeCloseTo(ARENA_LAYOUT.innerRingRadius, 5));
  });
  it('all have the breakable HP tag set to 300', () => {
    SHRINES.forEach((s) => expect(s.hp).toBe(300));
  });
  it('names are unique', () => {
    const names = new Set(SHRINES.map((s) => s.name));
    expect(names.size).toBe(SHRINES.length);
  });
});

describe('STANDING_STONES', () => {
  it('has exactly 4 entries', () => {
    expect(STANDING_STONES).toHaveLength(4);
  });
  it('are placed at 45° offsets, 15 m from center', () => {
    const magnitudes = STANDING_STONES.map((s) => Math.hypot(s.position.x, s.position.z));
    magnitudes.forEach((m) => expect(m).toBeCloseTo(ARENA_LAYOUT.outerRingRadius, 3));
  });
  it('are unbreakable (no hp set)', () => {
    STANDING_STONES.forEach((s) => expect(s.hp).toBeUndefined());
  });
  it('positions include all four diagonal quadrants', () => {
    const quadrants = new Set<string>();
    for (const s of STANDING_STONES) {
      const sx = Math.sign(s.position.x);
      const sz = Math.sign(s.position.z);
      quadrants.add(`${sx},${sz}`);
    }
    expect(quadrants.size).toBe(4);
  });
});

describe('PICKUP_SPAWN_POSITIONS', () => {
  it('has 4 spawn points within the playable area', () => {
    expect(PICKUP_SPAWN_POSITIONS).toHaveLength(4);
    for (const p of PICKUP_SPAWN_POSITIONS) {
      expect(Math.hypot(p.x, p.z)).toBeLessThan(ARENA_LAYOUT.stormRadius);
    }
  });
});

describe('SPAWN_POINTS', () => {
  it('places P0 and P1 on opposite ends of the arena', () => {
    expect(SPAWN_POINTS.p0.x).toBeCloseTo(0, 5);
    expect(SPAWN_POINTS.p1.x).toBeCloseTo(0, 5);
    expect(SPAWN_POINTS.p0.z).toBeCloseTo(-SPAWN_POINTS.p1.z, 5);
  });
  it('both spawn inside the playable area', () => {
    expect(Math.abs(SPAWN_POINTS.p0.z)).toBeLessThan(ARENA_LAYOUT.stormRadius);
    expect(Math.abs(SPAWN_POINTS.p1.z)).toBeLessThan(ARENA_LAYOUT.stormRadius);
  });
});
