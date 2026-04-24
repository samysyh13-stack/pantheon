import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  damp,
  smoothstep,
  vec2Length,
  normalize2,
  deadzone,
} from '../../src/utils/math';

describe('clamp', () => {
  it('returns v when in range', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
  it('clamps low', () => {
    expect(clamp(-1, 0, 1)).toBe(0);
  });
  it('clamps high', () => {
    expect(clamp(2, 0, 1)).toBe(1);
  });
});

describe('lerp', () => {
  it('returns a at t=0', () => {
    expect(lerp(3, 7, 0)).toBe(3);
  });
  it('returns b at t=1', () => {
    expect(lerp(3, 7, 1)).toBe(7);
  });
  it('midpoint at t=0.5', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
});

describe('damp', () => {
  it('is stable when current equals target', () => {
    expect(damp(5, 5, 1, 0.016)).toBeCloseTo(5, 5);
  });
  it('approaches target over time', () => {
    const r = damp(0, 1, 5, 0.016);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(1);
  });
});

describe('smoothstep', () => {
  it('returns 0 at edge0', () => {
    expect(smoothstep(0, 1, 0)).toBe(0);
  });
  it('returns 1 at edge1', () => {
    expect(smoothstep(0, 1, 1)).toBe(1);
  });
  it('returns 0.5 at midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });
});

describe('vec2Length', () => {
  it('3-4-5 triangle', () => {
    expect(vec2Length(3, 4)).toBe(5);
  });
  it('zero vector', () => {
    expect(vec2Length(0, 0)).toBe(0);
  });
});

describe('normalize2', () => {
  it('returns zero vector for zero input', () => {
    expect(normalize2(0, 0)).toEqual([0, 0]);
  });
  it('normalizes to unit length', () => {
    const [x, y] = normalize2(3, 4);
    expect(Math.hypot(x, y)).toBeCloseTo(1, 5);
  });
});

describe('deadzone', () => {
  it('zero inside deadzone', () => {
    expect(deadzone(0.1, 0.2)).toBe(0);
    expect(deadzone(-0.15, 0.2)).toBe(0);
  });
  it('preserves sign', () => {
    expect(Math.sign(deadzone(-0.5, 0.1))).toBe(-1);
    expect(Math.sign(deadzone(0.5, 0.1))).toBe(1);
  });
  it('remaps to full range at 1.0', () => {
    expect(deadzone(1, 0.2)).toBeCloseTo(1, 5);
    expect(deadzone(-1, 0.2)).toBeCloseTo(-1, 5);
  });
});
