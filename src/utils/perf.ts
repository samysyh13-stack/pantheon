// Performance budget helpers. PO subagent (T-006) elaborates in Phase 1.

import type { PresetConfig } from '../rendering/presets';

export interface FrameStats {
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  textureMemBytes: number;
}

export interface BudgetViolation {
  metric: keyof FrameStats;
  value: number;
  budget: number;
}

export const MOBILE_BUDGET = {
  frameTimeMs: 33.3,
  drawCalls: 150,
  triangles: 150_000,
  textureMemBytes: 128 * 1024 * 1024,
} as const;

export const DESKTOP_BUDGET = {
  frameTimeMs: 16.6,
  drawCalls: 400,
  triangles: 500_000,
  textureMemBytes: 256 * 1024 * 1024,
} as const;

export function budgetFor(preset: PresetConfig): typeof MOBILE_BUDGET | typeof DESKTOP_BUDGET {
  return preset.targetFps === 60 ? DESKTOP_BUDGET : MOBILE_BUDGET;
}

export function enforceBudget(
  stats: FrameStats,
  budget: typeof MOBILE_BUDGET | typeof DESKTOP_BUDGET,
): BudgetViolation[] {
  const out: BudgetViolation[] = [];
  for (const k of Object.keys(budget) as (keyof typeof budget)[]) {
    if (stats[k] > budget[k]) {
      out.push({ metric: k, value: stats[k], budget: budget[k] });
    }
  }
  return out;
}
