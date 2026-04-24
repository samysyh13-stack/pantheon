// PANTHÉON environment loader (T-002 RS).
//
// Tiered environment:
//   - Mobile Low / Battery: a procedural two-color gradient hemisphere
//     (no HDRI download, no network dependency). Colors match ADR-0012's
//     neutral overcast direction — silver-white overhead, cool stone
//     below. Fits the ≤ 25 MB critical-path download budget in
//     /docs/ARCHITECTURE.md §4.
//   - Medium / High / Ultra: drei's `<Environment preset="warehouse">`,
//     the lightest neutral-indoor HDRI in the drei preset set (no
//     pronounced sun — stays faithful to ADR-0012).
//
// A real arena HDRI will land in Phase 2 (T-104 arena polish), replacing
// the drei preset with a custom asset served from R2. Until then, the
// preset covers the visual contract without blowing the 25 MB budget.

import { Environment } from '@react-three/drei';
import { BackSide, Color } from 'three';

import type { PresetConfig } from './presets';

export interface GameEnvironmentProps {
  preset: PresetConfig;
}

// A tiny BackSide hemisphere gradient. Two-color vertical ramp sky.
function GradientSky() {
  const vertexShader = /* glsl */ `
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;
  const fragmentShader = /* glsl */ `
    uniform vec3 uTop;
    uniform vec3 uBottom;
    varying vec3 vWorldPos;
    void main() {
      float h = clamp(normalize(vWorldPos).y * 0.5 + 0.5, 0.0, 1.0);
      vec3 c = mix(uBottom, uTop, h);
      gl_FragColor = vec4(c, 1.0);
    }
  `;

  return (
    <mesh scale={[-500, 500, 500]}>
      <sphereGeometry args={[1, 24, 16]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTop: { value: new Color(0.82, 0.84, 0.86) },
          uBottom: { value: new Color(0.43, 0.46, 0.48) },
        }}
        depthWrite={false}
        side={BackSide}
      />
    </mesh>
  );
}

export function GameEnvironment({ preset }: GameEnvironmentProps) {
  if (preset.environment === 'gradient') {
    return (
      <>
        <GradientSky />
        {/* Minimal ambient so lit objects aren't pitch black on Low/Battery. */}
        <ambientLight intensity={0.7} />
        <hemisphereLight args={[0xdadde0, 0x5a5e62, 0.6]} />
      </>
    );
  }
  return <Environment preset="warehouse" background={false} environmentIntensity={0.9} />;
}
