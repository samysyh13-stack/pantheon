// PANTHÉON preset table — authoritative per-tier rendering configuration.
//
// NOTE (T-002 RS): the preset rows below are the single source of truth for
// the rendering pipeline. `src/rendering/postprocessing/composer.tsx` and
// `src/rendering/Canvas.tsx` read from here to assemble the effect stack and
// renderer configuration. Changes propagate without touching those files.
//
// The per-tier values map one-to-one onto /docs/ARCHITECTURE.md §9's effect
// composition table. Keep the table in sync with the docs; any numeric
// change that affects gameplay perception (outline thickness, bloom on/off,
// SSAO) should land via an ADR if it alters the agreed visual contract.

import type { GraphicsPreset } from '../../state/store';

export type Tonemap = 'aces' | 'linear';

export interface PresetConfig {
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: 512 | 1024 | 2048 | 4096;
  outlineThicknessPx: number;
  bloom: boolean;
  ssao: boolean;
  colorGrade: boolean;
  particleDensity: number;
  dpr: [number, number];
  targetFps: 30 | 60;
  // T-002 RS additions — required by the composer to honor §9:
  tonemap: Tonemap;
  // Environment tier: 'gradient' = procedural 2-color hemisphere (no HDRI);
  // 'hdri' = drei <Environment preset="warehouse"> neutral overcast (ADR-0012).
  environment: 'gradient' | 'hdri';
}

export const PRESETS: Record<Exclude<GraphicsPreset, 'auto'>, PresetConfig> = {
  ultra: {
    antialias: true,
    shadows: true,
    shadowMapSize: 4096,
    outlineThicknessPx: 2,
    bloom: true,
    ssao: true,
    colorGrade: true,
    particleDensity: 1.0,
    dpr: [1, 2],
    targetFps: 60,
    tonemap: 'aces',
    environment: 'hdri',
  },
  high: {
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    outlineThicknessPx: 2,
    bloom: true,
    ssao: false,
    colorGrade: true,
    particleDensity: 0.85,
    dpr: [1, 2],
    targetFps: 60,
    tonemap: 'aces',
    environment: 'hdri',
  },
  medium: {
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    outlineThicknessPx: 1,
    bloom: true,
    ssao: false,
    colorGrade: true,
    particleDensity: 0.6,
    dpr: [1, 1.5],
    targetFps: 30,
    tonemap: 'aces',
    environment: 'hdri',
  },
  low: {
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    outlineThicknessPx: 1,
    bloom: false,
    ssao: false,
    colorGrade: true,
    particleDensity: 0.35,
    dpr: [1, 1.25],
    targetFps: 30,
    tonemap: 'linear',
    environment: 'gradient',
  },
  battery: {
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    outlineThicknessPx: 1,
    bloom: false,
    ssao: false,
    colorGrade: false,
    particleDensity: 0.25,
    dpr: [1, 1],
    targetFps: 30,
    tonemap: 'linear',
    environment: 'gradient',
  },
};

export function detectPreset(): Exclude<GraphicsPreset, 'auto'> {
  if (typeof navigator === 'undefined') return 'medium';

  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  const battery = (
    navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> }
  ).getBattery;

  // Phase 1 Fix 4: never auto-pick Low/Battery. The outline post-process at
  // 1 px can render near-invisible on small mobile displays under the Low
  // preset's other reductions; Medium is the reliable visibility floor.
  // Players can still manually select Low/Battery via Settings > Graphics.
  if (!isMobile) {
    if (cores >= 8 && mem >= 16) return 'ultra';
    if (cores >= 6 && mem >= 8) return 'high';
    return 'medium';
  }

  // Mobile tier table. Auto-floor is 'medium'; a low-end device the heuristic
  // would have routed to 'low' now gets 'medium' with a console warning so
  // devs know why FPS may be struggling.
  if (cores >= 6 && mem >= 6) return 'high';
  if (cores >= 4 && mem >= 4) return 'medium';
  // eslint-disable-next-line no-console
  console.warn(
    '[presets] hardware heuristic would have picked Low; forcing Medium floor for outline visibility. Users on genuine low-end can manually select Low in Settings > Graphics.',
  );
  return 'medium';
  void battery; // battery-preset heuristic wired in Phase 4 polish
}

export function resolvePreset(p: GraphicsPreset): Exclude<GraphicsPreset, 'auto'> {
  return p === 'auto' ? detectPreset() : p;
}
