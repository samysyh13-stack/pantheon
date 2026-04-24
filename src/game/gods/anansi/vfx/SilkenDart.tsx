// PANTHÉON — Anansi SilkenDart projectile VFX (T-102 RS).
//
// Visual composition (per /docs/DESIGN_DOCUMENT.md §6.1 and T-100 CB kit):
//   - Moving head: small golden disc, billboarded, EMISSIVE (triggers bloom).
//   - Trailing strand: a <WebStrand> from `head - forward*1.5 m` to `head`,
//     updated each frame. Strand fades over ~0.4 s using the ribbon's
//     built-in head-to-tail alpha falloff.
//   - On impact: spawn a golden <HitSpark> burst + a <WebSlickDecal> at
//     the impact ground point (1 s fade).
//
// The projectile's LOGICAL motion / collision detection is the Phase 2
// combat system's job (T-101 / T-105 territory; DO NOT TOUCH). This
// component is presentational — the caller feeds world positions.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Mesh, ShaderMaterial, Uniform, Vector3 } from 'three';

import { useAppStore } from '../../../../state/store';
import { HitSpark, WebStrand, WebSlickDecal } from '../../../../vfx';

/**
 * Projectile lifecycle state. A caller can drive phase transitions via
 * props; alternatively, the caller can mount/unmount the component
 * around the lifetime of the projectile.
 */
export type SilkenDartPhase = 'flying' | 'impacted' | 'spent';

export interface SilkenDartProps {
  /** Current head world position. */
  headPosition: readonly [number, number, number];
  /** Current travel direction (unit vector). Used for trail tail. */
  forward: readonly [number, number, number];
  /** Phase of the projectile. Defaults to 'flying'. */
  phase?: SilkenDartPhase;
  /**
   * Where the dart hit, when phase is 'impacted'. Used for HitSpark +
   * WebSlickDecal placement.
   */
  impactPosition?: readonly [number, number, number];
  /** Ground Y for decal placement. Defaults to 0. */
  groundY?: number;
  /** Called after all post-impact VFX finish. Parent unmounts us then. */
  onSpent?: () => void;
  /** Deterministic seed. */
  seed?: number;
}

// Default trail length: 1.5 m back from the head (DESIGN §6.1 +
// T-102 brief "1.5 m long").
const TRAIL_LENGTH_METERS = 1.5;

// Anansi kit colors: gold #D4A24A / highlight #ffd48a (DESIGN §6.1).
const ANANSI_GOLD = 0xd4a24a;
const ANANSI_HIGHLIGHT = 0xffd48a;

/**
 * Simple emissive disc shader for the projectile head. Isolated so we
 * don't share the particle-atlas shader (the head is a single mesh, not
 * a pool). Counted as part of the RibbonStrip variant budget since it's
 * a trivial basic-emissive material — we reuse a shared ShaderMaterial
 * constructor.
 */
const HEAD_VERTEX = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec4 worldCenter = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 offset = (camRight * position.x + camUp * position.y);
  vec4 worldPos = vec4(worldCenter.xyz + offset, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const HEAD_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uEmissive;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float falloff = smoothstep(1.0, 0.2, r);
  float a = falloff;
  gl_FragColor = vec4(uColor * (uEmissive + 0.5), a);
}
`;

function SilkenDartHead({
  position,
  color = ANANSI_HIGHLIGHT,
  emissive = 1.8,
  size = 0.35,
}: {
  position: readonly [number, number, number];
  color?: number;
  emissive?: number;
  size?: number;
}) {
  const meshRef = useRef<Mesh | null>(null);

  const mat = useMemo(() => {
    const c = new Color(color);
    const m = new ShaderMaterial({
      uniforms: {
        uColor: new Uniform(new Vector3(c.r, c.g, c.b)),
        uEmissive: new Uniform(emissive),
      },
      vertexShader: HEAD_VERTEX,
      fragmentShader: HEAD_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
    });
    m.name = 'silken-dart-head';
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- constant
  }, []);

  useEffect(() => () => mat.dispose(), [mat]);

  return (
    <mesh ref={meshRef} position={[position[0], position[1], position[2]]} renderOrder={12}>
      <planeGeometry args={[size, size]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

export function SilkenDart(props: SilkenDartProps) {
  const {
    headPosition,
    forward,
    phase = 'flying',
    impactPosition,
    groundY = 0,
    onSpent,
    seed = 0,
  } = props;

  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);

  // Tail position: TRAIL_LENGTH_METERS behind the head along -forward.
  const tailPosition = useMemo<[number, number, number]>(() => {
    const fwd = normalize3(forward);
    return [
      headPosition[0] - fwd[0] * TRAIL_LENGTH_METERS,
      headPosition[1] - fwd[1] * TRAIL_LENGTH_METERS,
      headPosition[2] - fwd[2] * TRAIL_LENGTH_METERS,
    ];
  }, [headPosition, forward]);

  // Impact VFX lifecycle.
  const [showImpact, setShowImpact] = useState(false);
  const [decalDone, setDecalDone] = useState(false);
  const [sparkDone, setSparkDone] = useState(false);
  const trailFadeElapsedRef = useRef(0);
  const [trailGone, setTrailGone] = useState(false);

  useEffect(() => {
    if (phase === 'impacted') {
      setShowImpact(true);
    }
  }, [phase]);

  // After impact, allow the trail to fade for ~0.4 s before hiding it.
  useFrame((_, dt) => {
    if (phase !== 'impacted') return;
    trailFadeElapsedRef.current += dt;
    if (!trailGone && trailFadeElapsedRef.current >= 0.4) {
      setTrailGone(true);
    }
  });

  // Fire onSpent once both HitSpark + WebSlickDecal finish.
  useEffect(() => {
    if (phase === 'impacted' && decalDone && sparkDone && trailGone) {
      onSpent?.();
    }
  }, [phase, decalDone, sparkDone, trailGone, onSpent]);

  return (
    <>
      {/* Trail: always mounted while flying; also stays mounted for
          ~0.4 s after impact to fade out. */}
      {phase === 'flying' || !trailGone ? (
        <WebStrand
          from={tailPosition}
          to={headPosition}
          width={reducedMotion ? 0.04 : 0.08}
          color={ANANSI_GOLD}
          emissiveIntensity={reducedMotion ? 0.9 : 1.4}
          space="billboard"
        />
      ) : null}

      {/* Head disc: only while flying. */}
      {phase === 'flying' ? (
        <SilkenDartHead
          position={headPosition}
          color={ANANSI_HIGHLIGHT}
          emissive={reducedMotion ? 1.2 : 1.8}
        />
      ) : null}

      {/* Impact burst: golden HitSpark + web-slick decal. */}
      {showImpact && impactPosition ? (
        <>
          <HitSpark
            origin={impactPosition}
            color={ANANSI_GOLD}
            count={20}
            lifetime={0.3}
            speed={3.5}
            size={0.35}
            seed={seed + 11}
            onComplete={() => setSparkDone(true)}
          />
          <WebSlickDecal
            position={[impactPosition[0], groundY, impactPosition[2]]}
            size={2}
            color={ANANSI_HIGHLIGHT}
            lifetime={1}
            onComplete={() => setDecalDone(true)}
          />
        </>
      ) : null}
    </>
  );
}

function normalize3(v: readonly [number, number, number]): [number, number, number] {
  const m = Math.hypot(v[0], v[1], v[2]);
  if (m < 1e-6) return [0, 0, 1];
  return [v[0] / m, v[1] / m, v[2] / m];
}
