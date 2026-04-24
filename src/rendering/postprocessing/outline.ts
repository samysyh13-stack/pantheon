// PANTHÉON cel-shading outline (T-002 RS).
//
// A depth-based Sobel outline implemented as a custom `postprocessing.Effect`.
// Unlike `postprocessing`'s stock `OutlineEffect` — which operates on a
// `Selection` of objects and is meant for UI-style highlights — this pass
// draws edges for every on-screen silhouette using the depth buffer as
// input. That matches the cel-shading look described in
// /docs/DESIGN_DOCUMENT.md §3 and is what the per-preset effect composition
// in /docs/ARCHITECTURE.md §9 calls "Outline (Sobel)".
//
// Uniform interface:
//   - `uThickness` (float, px): sampling radius for the 3×3 Sobel kernel.
//     Driven by PresetConfig.outlineThicknessPx; the accessibility
//     High-Contrast mode scales it by +40% at wire-up (see composer.tsx).
//   - `uStrength`  (float): edge-brightness multiplier. Higher values
//     produce bolder ink lines.
//   - `uColor`     (vec3): line color. Dark neutral by default.
//
// Because this effect consumes the depth buffer, it declares
// `EffectAttribute.DEPTH`; the EffectMaterial prelude provides the
// `readDepth(vec2)` helper, so no manual packing logic is required.
//
// Performance: one fragment shader, eight depth reads per pixel plus the
// center. Fragment cost is O(1) per pixel; on mobile Low/Battery this pass
// remains active (per §9 table) with a 1 px thickness so the cel silhouette
// is preserved even when bloom/color-grade are off.

import { Effect, EffectAttribute } from 'postprocessing';
import { Color, Uniform } from 'three';

const fragmentShader = /* glsl */ `
uniform float uThickness;
uniform float uStrength;
uniform vec3  uColor;

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  // Sky/background: skip outline so the horizon stays clean.
  if (depth >= 0.9999) {
    outputColor = inputColor;
    return;
  }

  // Sobel kernel sample offsets (3×3). texelSize is 1/resolution.
  vec2 off = uThickness * texelSize;

  float tl = readDepth(uv + off * vec2(-1.0,  1.0));
  float t  = readDepth(uv + off * vec2( 0.0,  1.0));
  float tr = readDepth(uv + off * vec2( 1.0,  1.0));
  float l  = readDepth(uv + off * vec2(-1.0,  0.0));
  float r  = readDepth(uv + off * vec2( 1.0,  0.0));
  float bl = readDepth(uv + off * vec2(-1.0, -1.0));
  float b  = readDepth(uv + off * vec2( 0.0, -1.0));
  float br = readDepth(uv + off * vec2( 1.0, -1.0));

  // Sobel gradient magnitude on the depth field.
  float gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
  float gy = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);

  float edge = clamp(sqrt(gx * gx + gy * gy) * uStrength, 0.0, 1.0);

  // Lerp input toward line color on detected edges.
  outputColor = vec4(mix(inputColor.rgb, uColor, edge), inputColor.a);
}
`;

export interface OutlineConfig {
  thickness: number;
  strength?: number;
  color?: number; // hex, e.g. 0x0a0a0f
}

export function createOutlineEffect(thickness: number): Effect;
export function createOutlineEffect(config: OutlineConfig): Effect;
export function createOutlineEffect(arg: number | OutlineConfig): Effect {
  const config: Required<OutlineConfig> =
    typeof arg === 'number'
      ? { thickness: arg, strength: 40.0, color: 0x0a0a0f }
      : { thickness: arg.thickness, strength: arg.strength ?? 40.0, color: arg.color ?? 0x0a0a0f };

  const uniforms = new Map<string, Uniform>([
    ['uThickness', new Uniform(config.thickness)],
    ['uStrength', new Uniform(config.strength)],
    ['uColor', new Uniform(new Color(config.color))],
  ]);

  return new Effect('PanthSobelOutline', fragmentShader, {
    attributes: EffectAttribute.DEPTH,
    uniforms,
  });
}
