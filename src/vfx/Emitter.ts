// PANTHÉON Emitter — declarative spawn driver (T-102 RS).
//
// An Emitter is NOT a scene object. It's a plain value that a consumer
// (usually a <VFXController> wrapper's `useFrame`) advances each frame,
// and at each tick it computes how many particles should spawn and
// writes them into an owning ParticlePool.
//
// Two emission knobs:
//   - `rate`   — particles per second (continuous stream).
//   - `burst`  — one-shot count (fired when `triggerBurst()` is called).
//
// Spawn randomization (position zone, velocity jitter, colour and size
// roll) runs through a deterministic `Rng` per ADR-0006. Callers pass a
// seed; the emitter derives a new sub-seed per spawn so the sequence is
// reproducible frame-for-frame under identical tick input.
//
// Why not a class with many getters? Emitters are data. Zero lifecycle,
// zero internal refs. This keeps the hot path — stepping the emitter
// against a pool in `useFrame` — allocation-free.

import { createRng, type Rng } from '../game/engine/random';
import type { ParticlePool, SpawnOptions } from './ParticlePool';

/** 3D position / velocity vector. */
export type Vec3 = readonly [number, number, number];

/** A zone from which spawn positions are sampled. */
export type PositionZone =
  | { kind: 'point'; position: Vec3 }
  | { kind: 'sphere'; center: Vec3; radius: number }
  | { kind: 'disc'; center: Vec3; normal: Vec3; radius: number }
  | { kind: 'box'; center: Vec3; halfExtents: Vec3 };

/**
 * Jitter spec for initial velocity. `base` is the mean; `jitter` is the
 * per-axis uniform amplitude added symmetrically (±jitter).
 */
export interface VelocityJitter {
  base: Vec3;
  jitter: Vec3;
  /**
   * Optional outward-from-zone-center bias in [0..1]. 0 = pure base,
   * 1 = pure radial outward direction. Used for "explosion" bursts.
   */
  outwardBias?: number;
}

/** Lifetime spec with a uniform jitter band. */
export interface LifetimeJitter {
  min: number;
  max: number;
}

/** Size spec — single value or uniform range. */
export interface SizeJitter {
  min: number;
  max: number;
}

/**
 * Color-over-life LUT. For v1 we keep it simple: a start and end color
 * and let the shader do the per-particle fade in alpha. More elaborate
 * ramps land in Phase 2 polish via a real uSprite atlas per god.
 */
export interface ColorRamp {
  start: number;
  end?: number; // optional end color; default = start
}

export interface EmitterConfig {
  /** Base seed for deterministic jitter. */
  seed: number;
  /** Continuous spawn rate (particles/sec). Default 0 (burst-only). */
  rate?: number;
  /** Burst size — particles spawned per `triggerBurst()` call. */
  burst?: number;
  /** Zone from which positions are sampled. Default: point(0,0,0). */
  positionZone?: PositionZone;
  /** Velocity jitter. Default zero. */
  velocityJitter?: VelocityJitter;
  /** Lifetime per particle (seconds). Default [0.8, 1.2]. */
  lifetime?: LifetimeJitter;
  /** Size per particle. Default [0.8, 1.2]. */
  size?: SizeJitter;
  /** Color ramp. Default white. */
  color?: ColorRamp;
  /** Reduced-motion scaler — count × 0.5, lifetime × 0.6. Per DESIGN §13. */
  reducedMotion?: boolean;
}

/**
 * Runtime state handed back from `createEmitter`. Hot-path API:
 *   - `step(pool, dtSeconds)` — advance continuous stream.
 *   - `triggerBurst(pool)` — fire `burst` particles now.
 *   - `reset()` — rewind accumulator + regenerate RNG.
 */
export interface Emitter {
  readonly config: EmitterConfig;
  step(pool: ParticlePool, dtSeconds: number): void;
  triggerBurst(pool: ParticlePool, count?: number): number;
  reset(): void;
  /** Read-only deterministic RNG used for spawn jitter. */
  readonly rng: Rng;
}

const DEFAULT_ZONE: PositionZone = { kind: 'point', position: [0, 0, 0] };
const DEFAULT_LIFETIME: LifetimeJitter = { min: 0.8, max: 1.2 };
const DEFAULT_SIZE: SizeJitter = { min: 0.8, max: 1.2 };
const DEFAULT_COLOR: ColorRamp = { start: 0xffffff };

/**
 * Construct a declarative Emitter bound to an initial seed.
 *
 * The returned object carries a seeded RNG; each spawn consumes a few
 * samples. Under identical step(pool, dt) input, the spawn sequence is
 * byte-identical — required by ADR-0006 for replay / lockstep.
 */
export function createEmitter(config: EmitterConfig): Emitter {
  const rng = createRng(config.seed);
  let accumulatedParticles = 0;

  const step = (pool: ParticlePool, dtSeconds: number): void => {
    const rate = config.rate ?? 0;
    if (rate <= 0) return;
    accumulatedParticles += rate * dtSeconds;
    while (accumulatedParticles >= 1) {
      accumulatedParticles -= 1;
      spawnOne(pool, rng, config);
    }
  };

  const triggerBurst = (pool: ParticlePool, countOverride?: number): number => {
    const baseCount = countOverride ?? config.burst ?? 0;
    if (baseCount <= 0) return 0;
    // Reduced motion: halve burst size (DESIGN §13).
    const n = Math.max(
      1,
      Math.floor(config.reducedMotion ? baseCount * 0.5 : baseCount),
    );
    for (let i = 0; i < n; i++) {
      spawnOne(pool, rng, config);
    }
    return n;
  };

  const reset = (): void => {
    accumulatedParticles = 0;
  };

  return { config, step, triggerBurst, reset, rng };
}

/** Spawn a single particle using the emitter's jitter config. */
function spawnOne(pool: ParticlePool, rng: Rng, config: EmitterConfig): void {
  const zone = config.positionZone ?? DEFAULT_ZONE;
  const life = config.lifetime ?? DEFAULT_LIFETIME;
  const sizeSpec = config.size ?? DEFAULT_SIZE;
  const colorSpec = config.color ?? DEFAULT_COLOR;

  // 1) Position.
  const position = samplePosition(zone, rng);

  // 2) Velocity.
  const velocity = sampleVelocity(config.velocityJitter, zone, position, rng);

  // 3) Lifetime. Reduced motion shortens lifetime.
  const baseLife = lerp(life.min, life.max, rng.next());
  const lifetime = config.reducedMotion ? baseLife * 0.6 : baseLife;

  // 4) Size.
  const size = lerp(sizeSpec.min, sizeSpec.max, rng.next());

  // 5) Color — for MVP we use start; a fragment-shader ramp lands in
  //    Phase 2 polish (uColorOverLife LUT).
  const color = colorSpec.start;

  const options: SpawnOptions = {
    velocity,
    lifetime,
    size,
    color,
    seed: rng.next(),
  };

  pool.spawn(position, options);
}

function samplePosition(zone: PositionZone, rng: Rng): Vec3 {
  switch (zone.kind) {
    case 'point':
      return zone.position;
    case 'sphere': {
      // Uniform sphere via normalized cube-reject (cheap, deterministic).
      let x: number, y: number, z: number, m: number;
      do {
        x = rng.next() * 2 - 1;
        y = rng.next() * 2 - 1;
        z = rng.next() * 2 - 1;
        m = x * x + y * y + z * z;
      } while (m > 1);
      const r = zone.radius * Math.cbrt(m > 0 ? rng.next() : 0); // volume-uniform
      return [zone.center[0] + x * r, zone.center[1] + y * r, zone.center[2] + z * r];
    }
    case 'disc': {
      // Uniform disc in the plane defined by `normal` at `center`.
      const angle = rng.next() * Math.PI * 2;
      const radius = zone.radius * Math.sqrt(rng.next());
      // Build an arbitrary tangent basis from `normal`.
      const n = normalize3(zone.normal);
      const t = orthonormalTangent(n);
      const b = cross(n, t);
      return [
        zone.center[0] + (t[0] * Math.cos(angle) + b[0] * Math.sin(angle)) * radius,
        zone.center[1] + (t[1] * Math.cos(angle) + b[1] * Math.sin(angle)) * radius,
        zone.center[2] + (t[2] * Math.cos(angle) + b[2] * Math.sin(angle)) * radius,
      ];
    }
    case 'box': {
      return [
        zone.center[0] + (rng.next() * 2 - 1) * zone.halfExtents[0],
        zone.center[1] + (rng.next() * 2 - 1) * zone.halfExtents[1],
        zone.center[2] + (rng.next() * 2 - 1) * zone.halfExtents[2],
      ];
    }
  }
}

function sampleVelocity(
  vj: VelocityJitter | undefined,
  zone: PositionZone,
  spawnPos: Vec3,
  rng: Rng,
): Vec3 {
  if (!vj) return [0, 0, 0];
  const jx = (rng.next() * 2 - 1) * vj.jitter[0];
  const jy = (rng.next() * 2 - 1) * vj.jitter[1];
  const jz = (rng.next() * 2 - 1) * vj.jitter[2];
  const vx = vj.base[0] + jx;
  const vy = vj.base[1] + jy;
  const vz = vj.base[2] + jz;
  const bias = vj.outwardBias ?? 0;
  if (bias <= 0) return [vx, vy, vz];
  // Outward-radial bias — push velocity along (spawn - center).
  const center = zoneCenter(zone);
  const dx = spawnPos[0] - center[0];
  const dy = spawnPos[1] - center[1];
  const dz = spawnPos[2] - center[2];
  const m = Math.hypot(dx, dy, dz);
  if (m < 1e-6) return [vx, vy, vz];
  const rx = dx / m;
  const ry = dy / m;
  const rz = dz / m;
  const speed = Math.hypot(vx, vy, vz);
  return [
    (1 - bias) * vx + bias * rx * speed,
    (1 - bias) * vy + bias * ry * speed,
    (1 - bias) * vz + bias * rz * speed,
  ];
}

function zoneCenter(zone: PositionZone): Vec3 {
  switch (zone.kind) {
    case 'point':
      return zone.position;
    case 'sphere':
      return zone.center;
    case 'disc':
      return zone.center;
    case 'box':
      return zone.center;
  }
}

// Local vector helpers (avoid importing three.Vector3 into this hot path).
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function normalize3(v: Vec3): Vec3 {
  const m = Math.hypot(v[0], v[1], v[2]);
  if (m < 1e-6) return [0, 1, 0];
  return [v[0] / m, v[1] / m, v[2] / m];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function orthonormalTangent(n: Vec3): Vec3 {
  // Pick an axis not parallel to `n`, then cross.
  const other: Vec3 = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return normalize3(cross(n, other));
}
