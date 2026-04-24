import { describe, it, expect } from 'vitest';
import {
  enforceBudget,
  MOBILE_BUDGET,
  DESKTOP_BUDGET,
  budgetFor,
  type FrameStats,
} from '../../src/utils/perf';
import { PRESETS } from '../../src/rendering/presets';

describe('enforceBudget', () => {
  const cleanMobile: FrameStats = {
    frameTimeMs: 25,
    drawCalls: 100,
    triangles: 100_000,
    textureMemBytes: 64 * 1024 * 1024,
  };

  it('returns empty when all metrics are within budget', () => {
    expect(enforceBudget(cleanMobile, MOBILE_BUDGET)).toEqual([]);
  });

  it('flags frame time violations', () => {
    const stats: FrameStats = { ...cleanMobile, frameTimeMs: 50 };
    const violations = enforceBudget(stats, MOBILE_BUDGET);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.metric).toBe('frameTimeMs');
  });

  it('flags multiple violations', () => {
    const stats: FrameStats = {
      frameTimeMs: 100,
      drawCalls: 500,
      triangles: 1_000_000,
      textureMemBytes: 256 * 1024 * 1024,
    };
    const violations = enforceBudget(stats, MOBILE_BUDGET);
    expect(violations).toHaveLength(4);
  });
});

describe('budgetFor', () => {
  it('returns mobile budget for 30 FPS preset', () => {
    expect(budgetFor(PRESETS.medium)).toBe(MOBILE_BUDGET);
    expect(budgetFor(PRESETS.low)).toBe(MOBILE_BUDGET);
    expect(budgetFor(PRESETS.battery)).toBe(MOBILE_BUDGET);
  });

  it('returns desktop budget for 60 FPS preset', () => {
    expect(budgetFor(PRESETS.ultra)).toBe(DESKTOP_BUDGET);
    expect(budgetFor(PRESETS.high)).toBe(DESKTOP_BUDGET);
  });
});
