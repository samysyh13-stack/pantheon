// PANTHÉON — Anansi Eight-Strand Dome ultimate VFX (T-102 RS).
//
// Visual composition (per /docs/DESIGN_DOCUMENT.md §6.1 Ultimate and
// T-100 CB kit):
//   - Placement telegraph: a radius ring on the ground that grows from
//     0 → 5 m over 0.5 s (exact number per T-100 CB kit; default 0.5 s
//     if T-100 hasn't landed yet).
//   - Dome: <DomeBoundary> at 5 m radius, translucent gold web-weave.
//   - Inside-dome ambient mist: thin <MistLayer> (non-emissive Points).
//
// Lifecycle phases:
//   'telegraph'    — ring growing from 0 → 5 m; the dome isn't rendered yet.
//   'active'       — dome + mist active. Full 5 m radius. Emissive rim.
//   'retracting'   — dome opacity fades to 0 over ~300 ms.
//   'spent'        — all VFX unmounted.
//
// The ability LOGIC (damage, slow, Anansi's inside-buff) is the Phase 2
// combat system's job (T-101 / T-105). This component is presentational.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
  Uniform,
  Vector3,
} from 'three';

import { useAppStore } from '../../../../state/store';
import { DomeBoundary, MistLayer } from '../../../../vfx';

export type EightStrandDomePhase = 'telegraph' | 'active' | 'retracting' | 'spent';

export interface EightStrandDomeProps {
  /** Dome center world position. */
  center: readonly [number, number, number];
  /** Final radius (m). Default 5 (DESIGN §6.1). */
  radius?: number;
  /** Placement telegraph duration (ms). Default 500 (T-100 pending). */
  telegraphMs?: number;
  /** Ground Y for ring placement. Default 0. */
  groundY?: number;
  /** Seed for deterministic mist placement. */
  seed?: number;
  /** Current phase. */
  phase: EightStrandDomePhase;
  /** Fired when the retract animation finishes. */
  onRetracted?: () => void;
}

const ANANSI_GOLD = 0xd4a24a;
const ANANSI_HIGHLIGHT = 0xffd48a;

// Telegraph ring shader — a grows-out radius ring with a glowing edge.
const RING_VERTEX = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RING_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uProgress;
varying vec2 vUv;
void main() {
  // Distance from center (UV 0..1, centered at 0.5).
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  // Draw the band at r ≈ uProgress with a thin edge.
  float band = smoothstep(0.98, 1.0, r) * smoothstep(0.0, 0.02, 1.0 - r);
  float alpha = band * 0.9;
  gl_FragColor = vec4(uColor, alpha);
}
`;

function TelegraphRing({
  center,
  radius,
  color,
  progress01,
  groundY,
}: {
  center: readonly [number, number, number];
  radius: number;
  color: number;
  progress01: number;
  groundY: number;
}) {
  const mat = useMemo(() => {
    const c = new Color(color);
    const m = new ShaderMaterial({
      uniforms: {
        uColor: new Uniform(new Vector3(c.r, c.g, c.b)),
        uProgress: new Uniform(progress01),
      },
      vertexShader: RING_VERTEX,
      fragmentShader: RING_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    m.name = 'eight-strand-telegraph-ring';
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- constant init
  }, []);

  // Live update progress uniform (growth animation is in the scale of the mesh).
  useEffect(() => {
    mat.uniforms.uProgress!.value = progress01;
  }, [mat, progress01]);

  useEffect(() => () => mat.dispose(), [mat]);

  // Scale the mesh up from 0 → `radius` over telegraph time.
  const currentRadius = radius * progress01;
  // Minimum renderable radius to avoid NaN geometry the first frame.
  const effectiveRadius = Math.max(0.01, currentRadius);

  return (
    <mesh
      position={[center[0], groundY + 0.01, center[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={4}
    >
      <ringGeometry args={[effectiveRadius * 0.95, effectiveRadius, 48]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/**
 * Full dome VFX. Driven by `phase` externally. Internally handles the
 * telegraph scale-in animation (0.5 s default) and the retract fade-out
 * animation (300 ms).
 */
export function EightStrandDome(props: EightStrandDomeProps) {
  const {
    center,
    radius = 5,
    telegraphMs = 500,
    groundY = 0,
    seed = 0,
    phase,
    onRetracted,
  } = props;

  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);

  const elapsedMsRef = useRef(0);
  const lastPhaseRef = useRef<EightStrandDomePhase>(phase);
  const [telegraphProgress, setTelegraphProgress] = useState(0);
  const [retractProgress, setRetractProgress] = useState(0);

  useEffect(() => {
    if (lastPhaseRef.current !== phase) {
      elapsedMsRef.current = 0;
      lastPhaseRef.current = phase;
      if (phase === 'telegraph') setTelegraphProgress(0);
      if (phase === 'retracting') setRetractProgress(0);
    }
  }, [phase]);

  useFrame((_, dt) => {
    elapsedMsRef.current += dt * 1000;
    const effectiveTelegraph = reducedMotion ? telegraphMs * 2 : telegraphMs;
    if (phase === 'telegraph') {
      const t = Math.min(1, elapsedMsRef.current / effectiveTelegraph);
      setTelegraphProgress(t);
    } else if (phase === 'retracting') {
      const t = Math.min(1, elapsedMsRef.current / 300);
      setRetractProgress(t);
      if (t >= 1) onRetracted?.();
    }
  });

  if (phase === 'spent') return null;

  // Base opacity fades out during retraction.
  const activeOpacity = reducedMotion ? 0.45 : 0.6;
  const opacity =
    phase === 'retracting' ? activeOpacity * (1 - retractProgress) : activeOpacity;

  const showDome = phase === 'active' || phase === 'retracting';

  return (
    <>
      {/* Placement telegraph ring — only during 'telegraph' phase. */}
      {phase === 'telegraph' ? (
        <TelegraphRing
          center={center}
          radius={radius}
          color={ANANSI_HIGHLIGHT}
          progress01={telegraphProgress}
          groundY={groundY}
        />
      ) : null}

      {/* Main dome — only while active or retracting. */}
      {showDome ? (
        <>
          <DomeBoundary
            center={[center[0], center[1] + radius * 0.05, center[2]]}
            radius={radius}
            color={ANANSI_GOLD}
            opacity={opacity}
            scrollSpeed={reducedMotion ? 0.06 : 0.12}
            gridFrequency={16}
          />
          <MistLayer
            center={[center[0], center[1], center[2]]}
            radius={radius * 0.85}
            color={0x8a6a2a}
            count={48}
            seed={seed + 7}
          />
        </>
      ) : null}
    </>
  );
}
