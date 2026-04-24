// PANTHÉON T-002 RS — preset table + detection tests.
//
// These tests guard the per-preset effect composition contract in
// /docs/ARCHITECTURE.md §9. Any future preset change should land with an
// ADR and a test update in tandem.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRESETS, detectPreset, resolvePreset } from '../../src/rendering/presets';
import type { PresetConfig } from '../../src/rendering/presets';

const TIERS = ['ultra', 'high', 'medium', 'low', 'battery'] as const;

type NavOverrides = {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  userAgent?: string;
};

describe('PRESETS table consistency', () => {
  it('has all 5 concrete tiers', () => {
    for (const tier of TIERS) {
      expect(PRESETS[tier]).toBeDefined();
    }
  });

  it('populates every PresetConfig field on every tier', () => {
    const expectedKeys: readonly (keyof PresetConfig)[] = [
      'antialias',
      'shadows',
      'shadowMapSize',
      'outlineThicknessPx',
      'bloom',
      'ssao',
      'colorGrade',
      'particleDensity',
      'dpr',
      'targetFps',
      'tonemap',
      'environment',
    ];
    for (const tier of TIERS) {
      const cfg = PRESETS[tier];
      for (const key of expectedKeys) {
        expect(cfg[key]).toBeDefined();
      }
      // dpr is a tuple [min, max]
      expect(cfg.dpr).toHaveLength(2);
      expect(cfg.dpr[0]).toBeLessThanOrEqual(cfg.dpr[1]);
    }
  });

  it('outline thickness is 1 or 2 px per §9 table', () => {
    expect(PRESETS.ultra.outlineThicknessPx).toBe(2);
    expect(PRESETS.high.outlineThicknessPx).toBe(2);
    expect(PRESETS.medium.outlineThicknessPx).toBe(1);
    expect(PRESETS.low.outlineThicknessPx).toBe(1);
    expect(PRESETS.battery.outlineThicknessPx).toBe(1);
  });

  it('shadow map sizes follow §9 table', () => {
    expect(PRESETS.ultra.shadowMapSize).toBe(4096);
    expect(PRESETS.high.shadowMapSize).toBe(2048);
    expect(PRESETS.medium.shadowMapSize).toBe(1024);
    expect(PRESETS.low.shadowMapSize).toBe(512);
    expect(PRESETS.battery.shadowMapSize).toBe(512);
  });

  it('target FPS is the mobile 30 / desktop 60 banding', () => {
    expect(PRESETS.ultra.targetFps).toBe(60);
    expect(PRESETS.high.targetFps).toBe(60);
    expect(PRESETS.medium.targetFps).toBe(30);
    expect(PRESETS.low.targetFps).toBe(30);
    expect(PRESETS.battery.targetFps).toBe(30);
  });
});

describe('Effect gating per §9 table', () => {
  it('ssao is enabled ONLY on ultra', () => {
    expect(PRESETS.ultra.ssao).toBe(true);
    expect(PRESETS.high.ssao).toBe(false);
    expect(PRESETS.medium.ssao).toBe(false);
    expect(PRESETS.low.ssao).toBe(false);
    expect(PRESETS.battery.ssao).toBe(false);
  });

  it('bloom is enabled on ultra/high/medium, disabled on low/battery', () => {
    expect(PRESETS.ultra.bloom).toBe(true);
    expect(PRESETS.high.bloom).toBe(true);
    expect(PRESETS.medium.bloom).toBe(true);
    expect(PRESETS.low.bloom).toBe(false);
    expect(PRESETS.battery.bloom).toBe(false);
  });

  it('color grade is on except battery', () => {
    expect(PRESETS.ultra.colorGrade).toBe(true);
    expect(PRESETS.high.colorGrade).toBe(true);
    expect(PRESETS.medium.colorGrade).toBe(true);
    expect(PRESETS.low.colorGrade).toBe(true);
    expect(PRESETS.battery.colorGrade).toBe(false);
  });

  it('tone map is ACES for ultra/high/medium, Linear for low/battery', () => {
    expect(PRESETS.ultra.tonemap).toBe('aces');
    expect(PRESETS.high.tonemap).toBe('aces');
    expect(PRESETS.medium.tonemap).toBe('aces');
    expect(PRESETS.low.tonemap).toBe('linear');
    expect(PRESETS.battery.tonemap).toBe('linear');
  });
});

describe('resolvePreset', () => {
  it('returns the given concrete preset unchanged', () => {
    for (const tier of TIERS) {
      expect(resolvePreset(tier)).toBe(tier);
    }
  });

  it("returns one of the 5 concrete presets for 'auto'", () => {
    const resolved = resolvePreset('auto');
    expect(TIERS).toContain(resolved);
  });
});

/**
 * Stubs navigator fields for `detectPreset` scenarios. Returns a restore
 * thunk so per-test cleanup is explicit.
 */
function stubNavigator(overrides: NavOverrides): () => void {
  const nav = navigator as Navigator & {
    hardwareConcurrency: number;
    deviceMemory?: number;
  };
  const originals = {
    hardwareConcurrency: nav.hardwareConcurrency,
    deviceMemory: nav.deviceMemory,
    userAgent: nav.userAgent,
  };
  if (overrides.hardwareConcurrency !== undefined) {
    Object.defineProperty(nav, 'hardwareConcurrency', {
      value: overrides.hardwareConcurrency,
      configurable: true,
    });
  }
  if (overrides.deviceMemory !== undefined) {
    Object.defineProperty(nav, 'deviceMemory', {
      value: overrides.deviceMemory,
      configurable: true,
    });
  }
  if (overrides.userAgent !== undefined) {
    Object.defineProperty(nav, 'userAgent', {
      value: overrides.userAgent,
      configurable: true,
    });
  }
  return () => {
    Object.defineProperty(nav, 'hardwareConcurrency', {
      value: originals.hardwareConcurrency,
      configurable: true,
    });
    if (originals.deviceMemory === undefined) {
      // Best-effort cleanup: if we added the field, remove it.
      delete (nav as { deviceMemory?: number }).deviceMemory;
    } else {
      Object.defineProperty(nav, 'deviceMemory', {
        value: originals.deviceMemory,
        configurable: true,
      });
    }
    Object.defineProperty(nav, 'userAgent', {
      value: originals.userAgent,
      configurable: true,
    });
  };
}

describe('detectPreset', () => {
  let restore: () => void = () => {};

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    restore();
  });

  it("high-end desktop (8 cores, 16 GB) → 'ultra'", () => {
    restore = stubNavigator({
      hardwareConcurrency: 8,
      deviceMemory: 16,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/134',
    });
    expect(detectPreset()).toBe('ultra');
  });

  it("mid desktop (6 cores, 8 GB) → 'high'", () => {
    restore = stubNavigator({
      hardwareConcurrency: 6,
      deviceMemory: 8,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/17',
    });
    expect(detectPreset()).toBe('high');
  });

  it("low-end desktop (4 cores, 4 GB) → 'medium'", () => {
    restore = stubNavigator({
      hardwareConcurrency: 4,
      deviceMemory: 4,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/125',
    });
    expect(detectPreset()).toBe('medium');
  });

  it("high-end mobile (6 cores, 6 GB, Android UA) → 'high'", () => {
    restore = stubNavigator({
      hardwareConcurrency: 6,
      deviceMemory: 6,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36',
    });
    expect(detectPreset()).toBe('high');
  });

  it("mid mobile (4 cores, 4 GB, iPhone UA) → 'medium'", () => {
    restore = stubNavigator({
      hardwareConcurrency: 4,
      deviceMemory: 4,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    expect(detectPreset()).toBe('medium');
  });

  it("weak mobile (2 cores, 2 GB, Android UA) → 'low'", () => {
    restore = stubNavigator({
      hardwareConcurrency: 2,
      deviceMemory: 2,
      userAgent: 'Mozilla/5.0 (Linux; Android 12; low-end) Mobile Safari/537.36',
    });
    expect(detectPreset()).toBe('low');
  });
});
