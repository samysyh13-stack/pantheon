// PANTHÉON bloom wrapper (T-002 RS).
//
// Thin factory around `postprocessing`'s `BloomEffect`. Bloom is gated on
// emissive output in /docs/DESIGN_DOCUMENT.md §3 — we achieve that gating
// via a luminance threshold rather than a separate emissive buffer. Any
// PBR-like material with an emissive channel above the threshold will
// bloom; others will not. Characters and arena props should keep their
// non-emissive base colors below this threshold to stay out of the bloom
// contribution.
//
// The /docs/ARCHITECTURE.md §9 table turns bloom OFF on Low and Battery
// presets — the composer (see composer.tsx) reads `preset.bloom` and
// skips invoking this factory for those tiers.
//
// Reduced Motion accessibility: per /docs/DESIGN_DOCUMENT.md §13, bloom
// flashes are suppressed on hits when reducedMotion is true. That applies
// to dynamic intensity modulation (a Phase 2 combat-feel concern); the
// *baseline* bloom remains on so the world retains its painterly glow.
// The composer clamps `intensity` down to a reduced value when reduced
// motion is on, keeping the pass active but visually calmer.

import { BloomEffect, BlendFunction, KernelSize } from 'postprocessing';
import type { Effect } from 'postprocessing';

export interface BloomConfig {
  threshold: number;
  intensity: number;
  radius?: number;
}

export function createBloomEffect(config: BloomConfig): Effect {
  const radius = config.radius ?? 0.72;
  const effect = new BloomEffect({
    blendFunction: BlendFunction.SCREEN,
    luminanceThreshold: config.threshold,
    luminanceSmoothing: 0.08,
    intensity: config.intensity,
    mipmapBlur: true,
    radius,
    levels: 6,
    kernelSize: KernelSize.MEDIUM,
  });
  return effect;
}
