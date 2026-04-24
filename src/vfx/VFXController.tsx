// PANTHÉON VFXController — R3F wrappers around ParticlePool / RibbonStrip
// (T-102 RS).
//
// Five components, each bridging one of ADR-0013's building blocks to the
// declarative R3F render tree:
//
//   <HitSpark origin color />          — burst of Points/quads using a
//                                         shared ParticlePool. One draw
//                                         call per mounted spark. 20
//                                         particles, 300 ms lifetime.
//   <WebStrand from to />              — straight-line RibbonStrip. Used
//                                         for the Silken Dart trail and
//                                         stationary web threads.
//   <DomeBoundary center radius />     — shader-driven translucent sphere
//                                         with a scrolling web-weave
//                                         pattern. Used for Anansi's
//                                         Eight-Strand Dome.
//   <CloneShimmer />                   — thin fresnel + UV-distort shader
//                                         material for the Mirror Thread
//                                         clone overlay.
//   <WebSlickDecal position />         — horizontal gold-web quad on the
//                                         ground at the projectile hit
//                                         point; 1 s fade.
//
// Accessibility (DESIGN §13, ARCHITECTURE §15):
//   - Reduced Motion scales HitSpark count × 0.5, lifetime × 0.6 (the
//     shader does the lifetime scale; the count scale lives here so the
//     CPU spawn cost halves too).
//   - DomeBoundary pulses at half animation speed under reducedMotion.
//   - No pulsing brightness changes when reducedMotion is on.
//
// Bloom gating (DESIGN §3, ARCHITECTURE §9):
//   - HitSpark particles are emissive (additive blend + bright tint) →
//     they trigger the luminance-threshold bloom pass.
//   - DomeBoundary fresnel-edge emits above threshold → bloom at the dome
//     rim.
//   - Gold mist in EightStrandDome is NON-emissive (multiplicative blend,
//     cool color tint) → no bloom.
//
// Shader-variant accounting:
//   - Every HitSpark SHARES the particle-atlas shader (count: 1).
//   - WebStrand shares the ribbon-strip shader (count: 1).
//   - DomeBoundary has its own shader (count: 1, dome-boundary).
//   - CloneShimmer has its own shader (count: 1, clone-shimmer).
//   - WebSlickDecal has its own shader (count: 1, web-slick-decal).
//   Total new variants: 5 — exactly the budget granted in T-102.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Uniform,
  Vector3,
} from 'three';
import type { ColorRepresentation } from 'three';

import { useAppStore } from '../state/store';
import { resolvePreset, PRESETS } from '../rendering/presets';
import { ParticlePool, type ParticleRenderMode } from './ParticlePool';
import { RibbonStrip } from './RibbonStrip';

// ---------------------------------------------------------------------
// Shared: "pick the right pool mode from the active preset"
// ---------------------------------------------------------------------

/**
 * Returns the ParticlePool mode matching the active graphics preset.
 * Low / Battery fall back to `'points'`; everything else uses the
 * full InstancedMesh path.
 */
function usePoolModeAndDensity(): { mode: ParticleRenderMode; density: number } {
  const preset = useAppStore((s) => s.settings.graphicsPreset);
  const resolved = resolvePreset(preset);
  const cfg = PRESETS[resolved];
  const mode: ParticleRenderMode = resolved === 'low' || resolved === 'battery' ? 'points' : 'instanced';
  return { mode, density: cfg.particleDensity };
}

// ---------------------------------------------------------------------
// <HitSpark>
// ---------------------------------------------------------------------

export interface HitSparkProps {
  /** World-space origin of the burst. */
  origin: readonly [number, number, number];
  /** Tint. Default gold (#d4a24a). */
  color?: ColorRepresentation;
  /** Base particle count. Default 20. Reduced-motion halves this. */
  count?: number;
  /** Base lifetime (s). Default 0.3. Reduced-motion × 0.6. */
  lifetime?: number;
  /** Deterministic seed (ADR-0006). */
  seed?: number;
  /** Initial burst speed (m/s). Default 3.0. */
  speed?: number;
  /** Size per particle. Default 0.4 m. */
  size?: number;
  /** Auto-unmount time (ms) after last particle fades. Default lifetime*1000 + 200. */
  unmountAfterMs?: number;
  /** Callback fired once the effect has fully faded out. */
  onComplete?: () => void;
}

/**
 * Single-burst hit-spark. Allocates its own pool on mount, spawns
 * `count` particles once, and self-unmounts after the lifetime elapses.
 *
 * Reduced motion: count × 0.5, lifetime × 0.6 (DESIGN §13).
 */
export function HitSpark(props: HitSparkProps) {
  const {
    origin,
    color = 0xd4a24a,
    count = 20,
    lifetime = 0.3,
    seed = 0,
    speed = 3,
    size = 0.4,
    unmountAfterMs,
    onComplete,
  } = props;

  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);
  const { mode, density } = usePoolModeAndDensity();

  const poolRef = useRef<ParticlePool | null>(null);
  const spawnedRef = useRef(false);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);

  // Effective burst count honors reduced motion AND preset density.
  const effectiveCount = useMemo(() => {
    const base = reducedMotion ? count * 0.5 : count;
    return Math.max(1, Math.floor(base * density));
  }, [reducedMotion, count, density]);

  const effectiveLifetime = reducedMotion ? lifetime * 0.6 : lifetime;

  const pool = useMemo(() => {
    const p = new ParticlePool({
      capacity: Math.max(32, effectiveCount + 4),
      mode,
      renderOrder: 11,
      blending: AdditiveBlending,
      gravity: [0, -4, 0],
      drag: 0.9,
      animateAtlas: false,
      reducedMotion,
      pointSize: 10,
      name: 'vfx-hit-spark',
    });
    poolRef.current = p;
    return p;
  }, [mode, effectiveCount, reducedMotion]);

  useEffect(() => {
    return () => {
      pool.dispose();
      poolRef.current = null;
    };
  }, [pool]);

  useFrame((_, dt) => {
    pool.update(dt);
    if (!spawnedRef.current) {
      spawnedRef.current = true;
      // Omni-directional cone burst — each particle gets a randomized
      // velocity sampled from a sphere scaled by `speed`.
      for (let i = 0; i < effectiveCount; i++) {
        const t = (i + 1) / effectiveCount;
        const theta = (seed * 0.131 + i * 2.399) % (Math.PI * 2);
        const phi = Math.acos(2 * ((seed * 0.357 + i * 1.618) % 1) - 1);
        const sx = Math.sin(phi) * Math.cos(theta);
        const sy = Math.cos(phi) * 0.7 + 0.3; // upward bias
        const sz = Math.sin(phi) * Math.sin(theta);
        pool.spawn(origin, {
          velocity: [sx * speed, sy * speed, sz * speed],
          lifetime: effectiveLifetime * (0.7 + ((i + seed) % 3) * 0.1),
          color,
          size: size * (0.7 + t * 0.3),
          seed: (i + seed) % 16 / 16,
        });
      }
    }
    elapsedRef.current += dt;
    const autoUnmount = unmountAfterMs ?? effectiveLifetime * 1000 + 200;
    if (!doneRef.current && elapsedRef.current * 1000 >= autoUnmount) {
      doneRef.current = true;
      onComplete?.();
    }
  });

  return <primitive object={pool.getObject()} />;
}

// ---------------------------------------------------------------------
// <WebStrand>
// ---------------------------------------------------------------------

export interface WebStrandProps {
  /** Start world point. */
  from: readonly [number, number, number];
  /** End world point. */
  to: readonly [number, number, number];
  /** Tint. Default Anansi gold. */
  color?: ColorRepresentation;
  /** Strand width (m). Default 0.08. */
  width?: number;
  /** 'billboard' (Anansi web-strand; flat to camera) or 'world' (trail). Default 'billboard'. */
  space?: 'billboard' | 'world';
  /** Emissive multiplier (for bloom). Default 1.2. */
  emissiveIntensity?: number;
  /** Sample count override. Default mobile=30 / desktop=60 based on preset. */
  sampleCount?: number;
}

/**
 * Straight-line RibbonStrip between two points. Used for Silken Dart
 * trail (updated every frame to follow the projectile), web strands on
 * the ground, and (later) Susanoo lightning.
 *
 * This component does NOT advance the sample buffer on its own — the
 * caller writes new endpoints via React prop updates (the position
 * change triggers a useEffect that calls setEndpoints).
 */
export function WebStrand(props: WebStrandProps) {
  const {
    from,
    to,
    color = 0xd4a24a,
    width = 0.08,
    space = 'billboard',
    emissiveIntensity = 1.2,
    sampleCount,
  } = props;

  const preset = useAppStore((s) => s.settings.graphicsPreset);
  const resolved = resolvePreset(preset);
  const defaultSampleCount =
    resolved === 'low' || resolved === 'battery' || resolved === 'medium' ? 30 : 60;

  const strip = useMemo(
    () =>
      new RibbonStrip({
        sampleCount: sampleCount ?? defaultSampleCount,
        space: space === 'billboard' ? 'local-billboard' : 'world',
        defaultWidth: width,
        color,
        emissiveIntensity,
        name: 'vfx-web-strand',
      }),
    // Recreate only when structural/arch props change. Width/color update live below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [space, sampleCount, defaultSampleCount],
  );

  useEffect(() => {
    return () => strip.dispose();
  }, [strip]);

  useEffect(() => {
    strip.setColor(color);
  }, [strip, color]);

  useEffect(() => {
    strip.setEmissiveIntensity(emissiveIntensity);
  }, [strip, emissiveIntensity]);

  useEffect(() => {
    strip.setEndpoints(from, to, width);
  }, [strip, from, to, width]);

  return <primitive object={strip.getObject()} />;
}

// ---------------------------------------------------------------------
// <DomeBoundary>
// ---------------------------------------------------------------------

const DOME_VERTEX = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vWorldPos;

void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const DOME_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3  uColor;
uniform float uOpacity;
uniform float uScrollSpeed;
uniform float uGridFrequency;
uniform float uFresnelPower;
uniform float uFresnelBoost;

varying vec3 vNormal;
varying vec3 vWorldPos;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  // Spherical UV from world normal (stable regardless of rotation).
  vec3 n = normalize(vNormal);
  float u = atan(n.x, n.z) / 6.2831853 + 0.5;
  float v = asin(clamp(n.y, -1.0, 1.0)) / 3.1415926 + 0.5;

  // Scrolling web-weave pattern — two overlapping grids phased by time.
  vec2 uv1 = vec2(u * uGridFrequency, v * uGridFrequency) + vec2(uTime * uScrollSpeed, 0.0);
  vec2 uv2 = uv1 + vec2(0.5, uTime * uScrollSpeed * 0.3);

  float grid1 = max(abs(fract(uv1.x) - 0.5), abs(fract(uv1.y) - 0.5));
  float grid2 = max(abs(fract(uv2.x) - 0.5), abs(fract(uv2.y) - 0.5));
  float weave = smoothstep(0.40, 0.49, max(grid1, grid2));

  // Sparse "stars" at the intersections — a little sparkle along the weave.
  vec2 cell = floor(uv1 * 1.2);
  float star = smoothstep(0.95, 1.0, hash21(cell)) * weave;

  // Fresnel rim — we have no view dir without passing camera; use a
  // simple trick where the normal's Y component approximates top/bottom
  // falloff from a top-down camera. Good enough for a floating dome.
  // The actual view-space fresnel uses modelViewMatrix's 3rd column.
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), uFresnelPower);
  float rim = fresnel * uFresnelBoost;

  float alpha = clamp(weave * 0.4 + rim + star * 0.8, 0.0, 1.0) * uOpacity;
  gl_FragColor = vec4(uColor * (0.7 + rim * 1.5 + star), alpha);
}
`;

export interface DomeBoundaryProps {
  /** World-space center of the dome. */
  center: readonly [number, number, number];
  /** Radius in meters. */
  radius: number;
  /** Tint. Default Anansi gold. */
  color?: ColorRepresentation;
  /** Base opacity. Default 0.6. */
  opacity?: number;
  /** Web scroll speed (uv/sec). Default 0.12. */
  scrollSpeed?: number;
  /** Grid frequency (# of cells around). Default 16. */
  gridFrequency?: number;
  /**
   * Render only interior (hemisphere cap visible from inside)? Default
   * false — full sphere rendered double-sided.
   */
  interiorOnly?: boolean;
}

/**
 * Translucent web-weave dome. Bloom-emissive at the fresnel rim.
 *
 * Reduced Motion halves `scrollSpeed` and disables the pulsing overlay.
 */
export function DomeBoundary(props: DomeBoundaryProps) {
  const {
    center,
    radius,
    color = 0xd4a24a,
    opacity = 0.6,
    scrollSpeed = 0.12,
    gridFrequency = 16,
    interiorOnly = false,
  } = props;

  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);

  const mat = useMemo(() => {
    const c = new Color(color);
    const m = new ShaderMaterial({
      uniforms: {
        uTime: new Uniform(0),
        uColor: new Uniform(new Vector3(c.r, c.g, c.b)),
        uOpacity: new Uniform(opacity),
        uScrollSpeed: new Uniform(reducedMotion ? scrollSpeed * 0.5 : scrollSpeed),
        uGridFrequency: new Uniform(gridFrequency),
        uFresnelPower: new Uniform(2.0),
        uFresnelBoost: new Uniform(1.2),
      },
      vertexShader: DOME_VERTEX,
      fragmentShader: DOME_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      side: interiorOnly ? BackSide : DoubleSide,
    });
    m.name = 'dome-boundary-material';
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- live updates below
  }, [interiorOnly]);

  // Live uniform updates.
  useEffect(() => {
    const c = new Color(color);
    const v = mat.uniforms.uColor!.value as Vector3;
    v.set(c.r, c.g, c.b);
  }, [mat, color]);
  useEffect(() => {
    mat.uniforms.uOpacity!.value = opacity;
  }, [mat, opacity]);
  useEffect(() => {
    mat.uniforms.uScrollSpeed!.value = reducedMotion ? scrollSpeed * 0.5 : scrollSpeed;
  }, [mat, scrollSpeed, reducedMotion]);
  useEffect(() => {
    mat.uniforms.uGridFrequency!.value = gridFrequency;
  }, [mat, gridFrequency]);

  useEffect(() => {
    return () => mat.dispose();
  }, [mat]);

  useFrame((_, dt) => {
    mat.uniforms.uTime!.value += dt;
  });

  return (
    <mesh position={[center[0], center[1], center[2]]} renderOrder={5}>
      <sphereGeometry args={[radius, 32, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ---------------------------------------------------------------------
// <CloneShimmer />
// ---------------------------------------------------------------------

const CLONE_SHIMMER_VERTEX = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vViewPos;

void main() {
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const CLONE_SHIMMER_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3  uTint;
uniform float uTime;
uniform float uFresnelPower;
uniform float uIntensity;

varying vec3 vNormal;
varying vec3 vViewPos;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vViewPos);
  float fresnel = pow(clamp(1.0 - max(dot(n, v), 0.0), 0.0, 1.0), uFresnelPower);

  // A subtle UV distortion-noise over the body ("heat-haze" look) —
  // computed from world-normal hashed cells + time.
  vec2 ncell = floor(n.xy * 8.0 + vec2(uTime * 0.4, -uTime * 0.3));
  float noise = hash21(ncell);
  float shimmer = smoothstep(0.7, 1.0, noise + fresnel * 0.5);

  float alpha = clamp(fresnel * uIntensity + shimmer * 0.3, 0.0, 1.0);
  gl_FragColor = vec4(uTint * (1.0 + fresnel * 0.6), alpha);
}
`;

export interface CloneShimmerProps {
  /** Position of the clone mesh (used for `position` on the wrapper). */
  position?: readonly [number, number, number];
  /** Tint color. Default Anansi gold highlight. */
  color?: ColorRepresentation;
  /** Intensity multiplier. Default 0.8. */
  intensity?: number;
  /** Fresnel exponent. Default 3.0. */
  fresnelPower?: number;
  /**
   * Shape geometry: default is a capsule (matching the character mesh
   * in /src/game/entities/character/Character.tsx). Callers using a
   * full rigged mesh can pass a custom `geometry` via children.
   */
  capsuleRadius?: number;
  capsuleHalfHeight?: number;
}

/**
 * Shimmer overlay for the Mirror Thread clone. Designed to be mounted
 * as a child of the clone's character root — rendered slightly larger
 * than the body mesh with additive blending for a "ghost silhouette"
 * look.
 */
export function CloneShimmer(props: CloneShimmerProps) {
  const {
    position = [0, 0, 0],
    color = 0xffd48a,
    intensity = 0.8,
    fresnelPower = 3.0,
    capsuleRadius = 0.44,
    capsuleHalfHeight = 0.96,
  } = props;

  const mat = useMemo(() => {
    const c = new Color(color);
    const m = new ShaderMaterial({
      uniforms: {
        uTint: new Uniform(new Vector3(c.r, c.g, c.b)),
        uTime: new Uniform(0),
        uFresnelPower: new Uniform(fresnelPower),
        uIntensity: new Uniform(intensity),
      },
      vertexShader: CLONE_SHIMMER_VERTEX,
      fragmentShader: CLONE_SHIMMER_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      side: FrontSide,
    });
    m.name = 'clone-shimmer-material';
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- live updates below
  }, []);

  // Live uniform updates.
  useEffect(() => {
    const c = new Color(color);
    const v = mat.uniforms.uTint!.value as Vector3;
    v.set(c.r, c.g, c.b);
  }, [mat, color]);
  useEffect(() => {
    mat.uniforms.uIntensity!.value = intensity;
  }, [mat, intensity]);
  useEffect(() => {
    mat.uniforms.uFresnelPower!.value = fresnelPower;
  }, [mat, fresnelPower]);

  useEffect(() => {
    return () => mat.dispose();
  }, [mat]);

  useFrame((_, dt) => {
    mat.uniforms.uTime!.value += dt;
  });

  return (
    <mesh position={[position[0], position[1], position[2]]} renderOrder={9}>
      <capsuleGeometry args={[capsuleRadius, capsuleHalfHeight * 2, 8, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ---------------------------------------------------------------------
// <WebSlickDecal>
// ---------------------------------------------------------------------

const DECAL_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uLifetime;
uniform vec3  uColor;
uniform float uStartTime;

varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  float t = clamp((uTime - uStartTime) / max(uLifetime, 0.0001), 0.0, 1.0);

  // Center-out scribble pattern. Radial falloff forms the decal shape.
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float ring = 1.0 - smoothstep(0.7, 1.0, r);

  // Web-strand scribble: 6 radial arms with noise modulation.
  float angle = atan(c.y, c.x);
  float arms = abs(sin(angle * 3.0));
  float strand = smoothstep(0.82, 0.9, arms) * ring;

  // Fade out.
  float fade = 1.0 - t;
  float alpha = (strand + ring * 0.05) * fade;

  gl_FragColor = vec4(uColor, alpha);
}
`;

const DECAL_VERTEX = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export interface WebSlickDecalProps {
  /** Position on the ground plane. */
  position: readonly [number, number, number];
  /** Decal size (m square). Default 2. */
  size?: number;
  /** Tint. Default Anansi gold highlight. */
  color?: ColorRepresentation;
  /** Lifetime (s). Default 1.0. */
  lifetime?: number;
  onComplete?: () => void;
}

/**
 * Short-lived "web slick" ground decal at the projectile impact point.
 *
 * Implementation: a 2×2 m quad laid flat on the ground with an
 * additive-blended fragment shader that draws a radial web scribble
 * fading over `lifetime`.
 */
export function WebSlickDecal(props: WebSlickDecalProps) {
  const {
    position,
    size = 2,
    color = 0xffd48a,
    lifetime = 1,
    onComplete,
  } = props;

  const matRef = useRef<ShaderMaterial | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const elapsedRef = useRef(0);

  const mat = useMemo(() => {
    const c = new Color(color);
    const m = new ShaderMaterial({
      uniforms: {
        uTime: new Uniform(0),
        uLifetime: new Uniform(lifetime),
        uStartTime: new Uniform(0),
        uColor: new Uniform(new Vector3(c.r, c.g, c.b)),
      },
      vertexShader: DECAL_VERTEX,
      fragmentShader: DECAL_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    m.name = 'web-slick-decal-material';
    matRef.current = m;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- live updates below
  }, []);

  useEffect(() => {
    return () => mat.dispose();
  }, [mat]);

  useEffect(() => {
    const c = new Color(color);
    const v = mat.uniforms.uColor!.value as Vector3;
    v.set(c.r, c.g, c.b);
  }, [mat, color]);
  useEffect(() => {
    mat.uniforms.uLifetime!.value = lifetime;
  }, [mat, lifetime]);

  useFrame((_, dt) => {
    elapsedRef.current += dt;
    const m = matRef.current;
    if (!m) return;
    const time = (m.uniforms.uTime!.value as number) + dt;
    m.uniforms.uTime!.value = time;
    if (startedAtRef.current === null) {
      startedAtRef.current = time;
      m.uniforms.uStartTime!.value = time;
    }
    if (!doneRef.current && elapsedRef.current >= lifetime + 0.15) {
      doneRef.current = true;
      onComplete?.();
    }
  });

  // Lay flat: rotate the plane −90° around X so UV (0,0)..(1,1) maps to
  // the ground plane. Float it a hair above the ground to avoid z-fight.
  return (
    <mesh
      position={[position[0], position[1] + 0.01, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={4}
    >
      <planeGeometry args={[size, size]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

// ---------------------------------------------------------------------
// Non-emissive mist billboard (static, declarative) — helper used by
// EightStrandDome for ambient gold mist INSIDE the dome.
// ---------------------------------------------------------------------

export interface MistLayerProps {
  /** Center of the mist cloud. */
  center: readonly [number, number, number];
  /** Radius of the fill sphere. */
  radius: number;
  /** Color (non-emissive; kept dim to avoid bloom). */
  color?: ColorRepresentation;
  /** Particle count scaler. Default 64. */
  count?: number;
  /** Seed. */
  seed?: number;
}

/**
 * Thin Points-based mist layer. NOT emissive (uses NormalBlending + a
 * dim color, so it does not exceed the bloom luminance threshold).
 */
export function MistLayer(props: MistLayerProps) {
  const {
    center,
    radius,
    color = 0x8a6a2a,
    count = 64,
    seed = 0,
  } = props;

  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);
  const { density } = usePoolModeAndDensity();

  const effectiveCount = Math.max(8, Math.floor(count * density * (reducedMotion ? 0.6 : 1)));

  const pool = useMemo(
    () =>
      new ParticlePool({
        capacity: effectiveCount,
        mode: 'points',
        blending: NormalBlending,
        renderOrder: 3,
        gravity: [0, 0.05, 0],
        drag: 0.1,
        animateAtlas: false,
        pointSize: 22,
        name: 'vfx-gold-mist',
      }),
    [effectiveCount],
  );

  const spawnedRef = useRef(false);

  useEffect(() => {
    return () => pool.dispose();
  }, [pool]);

  useFrame((_, dt) => {
    pool.update(dt);
    if (!spawnedRef.current) {
      spawnedRef.current = true;
      // Deterministic seeded jitter for mist particle placement.
      let s = (seed || 1) >>> 0;
      const nextRand = () => {
        s = (Math.imul(s ^ (s >>> 15), s | 1) + 0x6d2b79f5) >>> 0;
        return (s & 0xffffff) / 0xffffff;
      };
      for (let i = 0; i < effectiveCount; i++) {
        const u = nextRand();
        const v = nextRand();
        const r = radius * Math.pow(nextRand(), 1 / 3);
        const theta = u * Math.PI * 2;
        const phi = Math.acos(2 * v - 1);
        const px = Math.sin(phi) * Math.cos(theta) * r;
        const py = Math.cos(phi) * r * 0.5 + radius * 0.2; // flatter vertically
        const pz = Math.sin(phi) * Math.sin(theta) * r;
        pool.spawn([center[0] + px, center[1] + py, center[2] + pz], {
          velocity: [0, 0.1 + nextRand() * 0.05, 0],
          lifetime: 5 + nextRand() * 2,
          color,
          size: 0.5 + nextRand() * 0.3,
          seed: nextRand(),
        });
      }
    }
  });

  return <primitive object={pool.getObject()} />;
}

// ---------------------------------------------------------------------
// Debug: expose primitives needed for Anansi wrappers
// ---------------------------------------------------------------------

// no-op exports to satisfy strict mode imports in the god files.
export const _VFX_IMPLEMENTATION_MARKERS = {
  HitSpark: true,
  WebStrand: true,
  DomeBoundary: true,
  CloneShimmer: true,
  WebSlickDecal: true,
  MistLayer: true,
  // three primitives imported above for typings only
  _Mesh: Mesh,
  _PlaneGeometry: PlaneGeometry,
  _SphereGeometry: SphereGeometry,
  _MeshBasicMaterial: MeshBasicMaterial,
} as const;
