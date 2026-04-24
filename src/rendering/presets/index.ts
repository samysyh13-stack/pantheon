import type { GraphicsPreset } from '../../state/store';

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

  if (!isMobile) {
    if (cores >= 8 && mem >= 16) return 'ultra';
    if (cores >= 6 && mem >= 8) return 'high';
    return 'medium';
  }

  // mobile
  if (cores >= 6 && mem >= 6) return 'high';
  if (cores >= 4 && mem >= 4) return 'medium';
  return 'low';
  void battery; // battery-preset heuristic wired in Phase 4 polish
}

export function resolvePreset(p: GraphicsPreset): Exclude<GraphicsPreset, 'auto'> {
  return p === 'auto' ? detectPreset() : p;
}
