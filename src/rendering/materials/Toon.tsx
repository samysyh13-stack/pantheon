// PANTHÉON stylized toon material (T-002 RS).
//
// Banded (cel) diffuse + rim light + subtle fresnel layer, implemented on
// top of `MeshStandardMaterial` via `three-custom-shader-material`. This
// is the workhorse character shader — one shared instance (with
// per-character color uniforms) covers all three v1 gods, so it contributes
// 1 of the ≤ 12 project-wide shader variants capped in
// /docs/ARCHITECTURE.md §9.
//
// Uniform interface (typed via the props below):
//   - `color`         (Color): base diffuse color.
//   - `rimColor`      (Color): rim light color.
//   - `rimIntensity`  (number): rim contribution [0..1+].
//   - `bandCount`     (number): # of tone steps in the banded diffuse.
//                               Higher = smoother; lower = harsher cel.
//   - `rimPower`      (number): fresnel exponent shaping the rim falloff.
//
// Fallback path: Low / Battery presets don't turn this material OFF, but
// they pair it with disabled bloom and disabled color grade. For those
// tiers, caller can drop `bandCount` to 2 and `rimIntensity` to ~0.2 to
// shave fragment cost. Further LOD swap (plain MeshToonMaterial) happens
// at the character-LOD layer in Phase 2.

import { useMemo } from 'react';
import CustomShaderMaterial from 'three-custom-shader-material';
import { Color, MeshStandardMaterial, Uniform } from 'three';
import type { ColorRepresentation } from 'three';

export interface ToonMaterialProps {
  color?: ColorRepresentation;
  rimColor?: ColorRepresentation;
  rimIntensity?: number;
  rimPower?: number;
  bandCount?: number;
  metalness?: number;
  roughness?: number;
}

const vertexShader = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vViewPosition2;

void main() {
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPosition2 = -mv.xyz;
}
`;

const fragmentShader = /* glsl */ `
uniform float uRimIntensity;
uniform float uRimPower;
uniform vec3  uRimColor;
uniform float uBandCount;

varying vec3 vWorldNormal;
varying vec3 vViewPosition2;

void main() {
  // Start from CSM's default baseMaterial output in csm_DiffuseColor.

  // 1) Banded diffuse: quantize the standard lambert-ish shading by
  //    feeding the current color brightness through floor(v * bands) / bands.
  float luma = dot(csm_DiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float bands = max(2.0, uBandCount);
  float banded = floor(luma * bands) / bands;
  // Pull the banded luma back into the color channels, preserving hue.
  float eps = 1e-4;
  vec3 banded_rgb = csm_DiffuseColor.rgb * (banded / max(luma, eps));

  // 2) Rim light: 1 - dot(normal, view). Power shapes the falloff.
  vec3 n = normalize(vWorldNormal);
  vec3 v = normalize(vViewPosition2);
  float rim = pow(clamp(1.0 - max(dot(n, v), 0.0), 0.0, 1.0), max(uRimPower, 0.1));
  vec3 rim_rgb = uRimColor * rim * uRimIntensity;

  csm_DiffuseColor = vec4(banded_rgb + rim_rgb, csm_DiffuseColor.a);
}
`;

export function ToonMaterial(props: ToonMaterialProps) {
  const {
    color = 0xffffff,
    rimColor = 0xffffff,
    rimIntensity = 0.6,
    rimPower = 2.2,
    bandCount = 3,
    metalness = 0.0,
    roughness = 0.7,
  } = props;

  const uniforms = useMemo(
    () => ({
      uRimIntensity: new Uniform(rimIntensity),
      uRimPower: new Uniform(rimPower),
      uRimColor: new Uniform(new Color(rimColor)),
      uBandCount: new Uniform(bandCount),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial-only;
    // live updates flow through the direct mutation below.
    [],
  );

  // Live-update uniforms when props change (avoid rebuilding the material).
  uniforms.uRimIntensity.value = rimIntensity;
  uniforms.uRimPower.value = rimPower;
  uniforms.uRimColor.value.set(rimColor);
  uniforms.uBandCount.value = bandCount;

  return (
    <CustomShaderMaterial
      baseMaterial={MeshStandardMaterial}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
      color={new Color(color)}
      metalness={metalness}
      roughness={roughness}
    />
  );
}
