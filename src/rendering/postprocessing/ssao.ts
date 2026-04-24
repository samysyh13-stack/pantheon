// PANTHÉON SSAO wrapper (T-002 RS).
//
// Screen-Space Ambient Occlusion, desktop-only per /docs/DESIGN_DOCUMENT.md
// §3 and /docs/ARCHITECTURE.md §9. The composer only instantiates this
// effect when `preset.ssao === true` (currently the Ultra tier only), so
// the mobile budget is never taxed by its normal buffer and sampling cost.
//
// The `SSAOEffect` constructor takes an optional camera and a normal
// buffer. We construct without either here — the composer passes the
// active camera via `mainCamera =` and provides a `NormalPass` texture
// when wiring the effect chain. That keeps this factory free of React
// coupling and testable in isolation.

import { SSAOEffect, BlendFunction } from 'postprocessing';
import type { Effect } from 'postprocessing';

export interface SSAOConfig {
  intensity?: number;
  radius?: number;
  bias?: number;
  samples?: number;
}

export function createSSAOEffect(config: SSAOConfig = {}): Effect {
  const effect = new SSAOEffect(undefined, undefined, {
    blendFunction: BlendFunction.MULTIPLY,
    samples: config.samples ?? 9,
    rings: 7,
    luminanceInfluence: 0.7,
    radius: config.radius ?? 0.1825,
    intensity: config.intensity ?? 1.0,
    bias: config.bias ?? 0.025,
    fade: 0.01,
    worldDistanceThreshold: 60,
    worldDistanceFalloff: 6,
    worldProximityThreshold: 6,
    worldProximityFalloff: 0.6,
  });
  return effect;
}
