// PANTHÉON rim-only material (T-002 RS).
//
// Lighter-weight sibling of ToonMaterial: no banded diffuse, only a
// fresnel-driven rim highlight layered over a base color. Used for
// projectiles, pickups, and arena props where the full toon treatment
// costs more fragment time than it's worth.
//
// Uniforms (via props):
//   - `baseColor`    (Color)
//   - `rimColor`     (Color)
//   - `rimPower`     (number): fresnel exponent.
//   - `rimIntensity` (number): rim contribution multiplier.
//
// Contributes 1 shader variant (counted against the ≤ 12 cap).

import { useMemo } from 'react';
import CustomShaderMaterial from 'three-custom-shader-material';
import { Color, MeshBasicMaterial, Uniform } from 'three';
import type { ColorRepresentation } from 'three';

export interface RimMaterialProps {
  baseColor?: ColorRepresentation;
  rimColor?: ColorRepresentation;
  rimPower?: number;
  rimIntensity?: number;
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
uniform vec3  uBaseColor;
uniform vec3  uRimColor;
uniform float uRimPower;
uniform float uRimIntensity;

varying vec3 vWorldNormal;
varying vec3 vViewPosition2;

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 v = normalize(vViewPosition2);
  float rim = pow(clamp(1.0 - max(dot(n, v), 0.0), 0.0, 1.0), max(uRimPower, 0.1));
  vec3 color = uBaseColor + uRimColor * rim * uRimIntensity;
  csm_DiffuseColor = vec4(color, 1.0);
}
`;

export function RimMaterial(props: RimMaterialProps) {
  const {
    baseColor = 0xffffff,
    rimColor = 0xffffff,
    rimPower = 2.0,
    rimIntensity = 1.0,
  } = props;

  const uniforms = useMemo(
    () => ({
      uBaseColor: new Uniform(new Color(baseColor)),
      uRimColor: new Uniform(new Color(rimColor)),
      uRimPower: new Uniform(rimPower),
      uRimIntensity: new Uniform(rimIntensity),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial-only;
    // live updates flow through the direct mutation below.
    [],
  );

  uniforms.uBaseColor.value.set(baseColor);
  uniforms.uRimColor.value.set(rimColor);
  uniforms.uRimPower.value = rimPower;
  uniforms.uRimIntensity.value = rimIntensity;

  return (
    <CustomShaderMaterial
      baseMaterial={MeshBasicMaterial}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
    />
  );
}
