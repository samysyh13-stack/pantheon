// PANTHÉON LUT color grade (T-002 RS).
//
// Factory around `postprocessing`'s `LUT3DEffect`. The actual LUT texture is
// a Phase 2 asset authored via the T-104 arena-polish task; until then
// callers pass `null` (or omit the arg) and the composer gets a no-op
// passthrough — still a valid `Effect` so preset ordering stays stable.
//
// The /docs/ARCHITECTURE.md §9 table disables this pass for the Battery
// preset. The composer (see composer.tsx) reads `preset.colorGrade` and
// skips invoking this factory when false.

import { Effect, LUT3DEffect, BlendFunction } from 'postprocessing';
import { Uniform, type Texture } from 'three';

const passthroughFragmentShader = /* glsl */ `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = inputColor;
}
`;

export function createColorGradeEffect(lut?: Texture | null): Effect {
  if (lut) {
    return new LUT3DEffect(lut, {
      blendFunction: BlendFunction.SET,
      tetrahedralInterpolation: false,
    });
  }
  // No-op placeholder: lets the pass chain stay structurally identical
  // (and keeps the EffectPass ordering deterministic across presets) while
  // we wait on real LUT assets.
  return new Effect('PanthColorGradePassthrough', passthroughFragmentShader, {
    blendFunction: BlendFunction.SET,
    uniforms: new Map<string, Uniform>(),
  });
}
