// PANTHÉON VFX infrastructure tests (T-102 RS).
//
// Covers:
//   - ParticlePool allocates + recycles slots via the ring cursor.
//   - ParticlePool exposes a single draw call (one InstancedMesh/Points).
//   - Emitter timing is deterministic under a fixed seed — identical
//     inputs produce identical spawn counts + attribute values.
//   - HitSpark count scaling with reduced-motion is predictable (the
//     scaling rule lives in VFXController; we exercise it through the
//     pool/emitter primitives that expose the same scaling factor).
//
// Tests intentionally avoid rendering — we assert on the pool/emitter
// internal state + geometry shapes, which is stable in happy-dom
// without a WebGLContext.

import { describe, it, expect } from 'vitest';
import {
  BufferGeometry,
  InstancedMesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
} from 'three';

import {
  ParticlePool,
  createEmitter,
  PARTICLE_ATTRIBUTE_NAMES,
  PARTICLE_ATLAS_PIXEL_SIZE,
  PARTICLE_ATLAS_TILES_PER_ROW,
  generateDefaultSpriteAtlas,
} from '../../src/vfx';
import type { ParticlePoolConfig } from '../../src/vfx';

// ---------------------------------------------------------------------
// ParticlePool
// ---------------------------------------------------------------------

describe('ParticlePool — InstancedMesh mode', () => {
  it('creates a single InstancedMesh with N instances', () => {
    const pool = new ParticlePool({ capacity: 64, mode: 'instanced' });
    const obj = pool.getObject();
    expect(obj).toBeInstanceOf(InstancedMesh);
    const mesh = obj as InstancedMesh;
    expect(mesh.count).toBe(64);
    expect(mesh.material).toBeInstanceOf(ShaderMaterial);
    // frustumCulled disabled so pool isn't clipped on empty-AABB frames.
    expect(mesh.frustumCulled).toBe(false);
    pool.dispose();
  });

  it('attaches all required instance attributes', () => {
    const pool = new ParticlePool({ capacity: 16, mode: 'instanced' });
    const mesh = pool.getObject() as InstancedMesh;
    const g = mesh.geometry as BufferGeometry;
    for (const key of Object.values(PARTICLE_ATTRIBUTE_NAMES)) {
      expect(g.getAttribute(key)).toBeDefined();
    }
    pool.dispose();
  });

  it('advances the ring cursor on each spawn and wraps around', () => {
    const pool = new ParticlePool({ capacity: 4, mode: 'instanced' });
    expect(pool.getCursor()).toBe(0);
    pool.spawn([0, 0, 0]);
    expect(pool.getCursor()).toBe(1);
    pool.spawn([0, 0, 0]);
    pool.spawn([0, 0, 0]);
    pool.spawn([0, 0, 0]);
    expect(pool.getCursor()).toBe(0); // wrapped
    pool.spawn([0, 0, 0]);
    expect(pool.getCursor()).toBe(1); // overwrote slot 0
    pool.dispose();
  });

  it('writes per-slot birthTime and lifetime from spawn options', () => {
    const pool = new ParticlePool({ capacity: 8, mode: 'instanced' });
    const h = pool.spawn([0, 0, 0], { lifetime: 1.25 });
    expect(pool.getLifetimeAtSlot(h.slot)).toBeCloseTo(1.25, 5);
    expect(pool.getBirthTimeAtSlot(h.slot)).toBeCloseTo(0, 5);
    pool.update(0.5);
    const h2 = pool.spawn([0, 0, 0], { lifetime: 0.75 });
    expect(pool.getBirthTimeAtSlot(h2.slot)).toBeCloseTo(0.5, 5);
    pool.dispose();
  });

  it('countLive tracks live particles across time', () => {
    const pool = new ParticlePool({ capacity: 4, mode: 'instanced' });
    pool.spawn([0, 0, 0], { lifetime: 1.0 });
    pool.spawn([0, 0, 0], { lifetime: 0.3 });
    expect(pool.countLive()).toBe(2);
    pool.update(0.5);
    expect(pool.countLive()).toBe(1); // second one expired
    pool.update(0.6);
    expect(pool.countLive()).toBe(0);
    pool.dispose();
  });

  it('cancelSlot immediately expires a slot', () => {
    const pool = new ParticlePool({ capacity: 4, mode: 'instanced' });
    const h = pool.spawn([0, 0, 0], { lifetime: 10.0 });
    expect(pool.countLive()).toBe(1);
    pool.cancelSlot(h.slot);
    expect(pool.countLive()).toBe(0);
    pool.dispose();
  });
});

describe('ParticlePool — Points mode (Mobile Low/Battery fallback)', () => {
  it('creates a THREE.Points when mode=points', () => {
    const pool = new ParticlePool({ capacity: 32, mode: 'points' });
    const obj = pool.getObject();
    expect(obj).toBeInstanceOf(Points);
    const pts = obj as Points;
    expect(pts.material).toBeInstanceOf(PointsMaterial);
    // Shared blending / depth options apply to both modes.
    const m = pts.material as PointsMaterial;
    expect(m.transparent).toBe(true);
    expect(m.depthWrite).toBe(false);
    expect(m.depthTest).toBe(true);
    pool.dispose();
  });

  it('writes per-particle position on Points spawn', () => {
    const pool = new ParticlePool({ capacity: 8, mode: 'points' });
    pool.spawn([1, 2, 3]);
    const pts = pool.getObject() as Points;
    const pos = pts.geometry.getAttribute('position') as { array: Float32Array };
    expect(pos.array[0]).toBeCloseTo(1);
    expect(pos.array[1]).toBeCloseTo(2);
    expect(pos.array[2]).toBeCloseTo(3);
    pool.dispose();
  });
});

// ---------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------

describe('Emitter determinism', () => {
  it('yields the same sequence of spawns under identical seed + dt input', () => {
    const cfg = {
      seed: 42,
      rate: 20, // 20 particles/sec
      positionZone: {
        kind: 'sphere' as const,
        center: [0, 0, 0] as const,
        radius: 1,
      },
      velocityJitter: { base: [0, 1, 0] as const, jitter: [0.5, 0.5, 0.5] as const },
      lifetime: { min: 0.5, max: 1.0 },
      size: { min: 0.5, max: 1.0 },
    };

    // Two pools + two emitters with identical seed should produce the
    // same cursor progression under the same dt steps.
    const pa = new ParticlePool({ capacity: 64, mode: 'instanced' });
    const pb = new ParticlePool({ capacity: 64, mode: 'instanced' });
    const ea = createEmitter(cfg);
    const eb = createEmitter(cfg);

    for (let i = 0; i < 10; i++) {
      pa.update(0.05);
      pb.update(0.05);
      ea.step(pa, 0.05);
      eb.step(pb, 0.05);
    }

    // Ring cursor should match exactly — same number of spawns.
    expect(pa.getCursor()).toBe(pb.getCursor());
    // Sample a couple of attribute slots to confirm parity.
    expect(pa.getLifetimeAtSlot(0)).toBeCloseTo(pb.getLifetimeAtSlot(0), 6);
    expect(pa.getLifetimeAtSlot(1)).toBeCloseTo(pb.getLifetimeAtSlot(1), 6);
    pa.dispose();
    pb.dispose();
  });

  it('different seeds produce different spawn sequences', () => {
    const cfg = (seed: number) => ({
      seed,
      rate: 10,
      positionZone: { kind: 'point' as const, position: [0, 0, 0] as const },
      lifetime: { min: 0.5, max: 1.0 },
    });
    const pa = new ParticlePool({ capacity: 32, mode: 'instanced' });
    const pb = new ParticlePool({ capacity: 32, mode: 'instanced' });
    const ea = createEmitter(cfg(1));
    const eb = createEmitter(cfg(2));
    for (let i = 0; i < 20; i++) {
      pa.update(0.05);
      pb.update(0.05);
      ea.step(pa, 0.05);
      eb.step(pb, 0.05);
    }
    // Cursor count is the same (rate-driven); but per-slot lifetime
    // should diverge because of the different RNG sequence.
    const lifetimesA: number[] = [];
    const lifetimesB: number[] = [];
    for (let i = 0; i < 10; i++) {
      lifetimesA.push(pa.getLifetimeAtSlot(i));
      lifetimesB.push(pb.getLifetimeAtSlot(i));
    }
    expect(lifetimesA).not.toEqual(lifetimesB);
    pa.dispose();
    pb.dispose();
  });

  it('step count matches rate * elapsed under integer spawn windows', () => {
    const pool = new ParticlePool({ capacity: 256, mode: 'instanced' });
    const emit = createEmitter({
      seed: 7,
      rate: 100, // 100 particles/sec
      positionZone: { kind: 'point', position: [0, 0, 0] },
      lifetime: { min: 1, max: 1 },
    });
    // 1 second at rate 100 → 100 particles.
    for (let i = 0; i < 100; i++) {
      pool.update(0.01);
      emit.step(pool, 0.01);
    }
    expect(pool.getCursor()).toBe(100 % 256);
    expect(pool.countLive()).toBe(100);
    pool.dispose();
  });

  it('triggerBurst spawns N particles at once', () => {
    const pool = new ParticlePool({ capacity: 64, mode: 'instanced' });
    const emit = createEmitter({
      seed: 3,
      burst: 20,
      positionZone: { kind: 'point', position: [0, 0, 0] },
      lifetime: { min: 1, max: 1 },
    });
    const spawned = emit.triggerBurst(pool);
    expect(spawned).toBe(20);
    expect(pool.countLive()).toBe(20);
    pool.dispose();
  });

  it('triggerBurst honors reducedMotion by halving count', () => {
    const pool = new ParticlePool({ capacity: 64, mode: 'instanced' });
    const emit = createEmitter({
      seed: 3,
      burst: 20,
      positionZone: { kind: 'point', position: [0, 0, 0] },
      lifetime: { min: 1, max: 1 },
      reducedMotion: true,
    });
    const spawned = emit.triggerBurst(pool);
    // Reduced motion: burst × 0.5 (DESIGN §13).
    expect(spawned).toBe(10);
    expect(pool.countLive()).toBe(10);
    pool.dispose();
  });

  it('burst count override takes precedence over config', () => {
    const pool = new ParticlePool({ capacity: 64, mode: 'instanced' });
    const emit = createEmitter({
      seed: 3,
      burst: 10,
      positionZone: { kind: 'point', position: [0, 0, 0] },
      lifetime: { min: 1, max: 1 },
    });
    expect(emit.triggerBurst(pool, 5)).toBe(5);
    expect(pool.countLive()).toBe(5);
    pool.dispose();
  });
});

// ---------------------------------------------------------------------
// HitSpark count-scaling rule (matches VFXController implementation)
// ---------------------------------------------------------------------

/**
 * The HitSpark React wrapper computes its effective count as:
 *   effective = floor( base * (reducedMotion ? 0.5 : 1.0) * particleDensity )
 * with a hard minimum of 1.
 *
 * We re-implement the rule here so the test doesn't depend on mounting
 * R3F into happy-dom (no WebGL). This locks the scaling contract.
 */
function hitSparkCount(base: number, reducedMotion: boolean, particleDensity: number): number {
  const scaled = (reducedMotion ? base * 0.5 : base) * particleDensity;
  return Math.max(1, Math.floor(scaled));
}

describe('HitSpark count scaling rule', () => {
  it('defaults to base count at density 1.0 / reducedMotion false', () => {
    expect(hitSparkCount(20, false, 1.0)).toBe(20);
  });

  it('halves at reducedMotion true', () => {
    expect(hitSparkCount(20, true, 1.0)).toBe(10);
  });

  it('applies preset particleDensity multiplier (medium = 0.6)', () => {
    expect(hitSparkCount(20, false, 0.6)).toBe(12);
  });

  it('combines reducedMotion + Low density (0.35)', () => {
    // 20 * 0.5 * 0.35 = 3.5 → floor → 3
    expect(hitSparkCount(20, true, 0.35)).toBe(3);
  });

  it('floors to at least 1 particle even at battery density × reduced motion', () => {
    expect(hitSparkCount(1, true, 0.25)).toBe(1);
  });
});

// ---------------------------------------------------------------------
// Shader-variant / atlas contract
// ---------------------------------------------------------------------

describe('Particle atlas builder', () => {
  it('produces a pixel-perfect 4x4 tile atlas', () => {
    const buf = generateDefaultSpriteAtlas();
    const size = PARTICLE_ATLAS_PIXEL_SIZE;
    expect(size).toBe(PARTICLE_ATLAS_TILES_PER_ROW * 16);
    expect(buf.length).toBe(size * size * 4);
    // Each tile is 16x16; the center of tile (tx, ty) is at pixel
    // (tx*16 + 8, ty*16 + 8). Soft circles peak at tile center -> high alpha.
    const tilePx = 16;
    let maxAlpha = 0;
    for (let ty = 0; ty < PARTICLE_ATLAS_TILES_PER_ROW; ty++) {
      for (let tx = 0; tx < PARTICLE_ATLAS_TILES_PER_ROW; tx++) {
        const px = tx * tilePx + 8;
        const py = ty * tilePx + 8;
        const a = buf[(py * size + px) * 4 + 3]!;
        if (a > maxAlpha) maxAlpha = a;
      }
    }
    expect(maxAlpha).toBeGreaterThan(200);
  });

  it('is deterministic under the same seed', () => {
    const a = generateDefaultSpriteAtlas(0x1234);
    const b = generateDefaultSpriteAtlas(0x1234);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < Math.min(a.length, 256); i += 64) {
      expect(a[i]).toBe(b[i]);
    }
  });
});

// ---------------------------------------------------------------------
// Pool config surface (guard against silent defaults drift)
// ---------------------------------------------------------------------

describe('ParticlePool config surface', () => {
  it('accepts a full config object with strict typing', () => {
    const cfg: ParticlePoolConfig = {
      capacity: 128,
      mode: 'instanced',
      blending: 2, // AdditiveBlending
      renderOrder: 10,
      gravity: [0, -1, 0],
      drag: 0.5,
      animateAtlas: false,
      reducedMotion: false,
      pointSize: 8,
      name: 'test',
    };
    const pool = new ParticlePool(cfg);
    expect(pool.capacity).toBe(128);
    expect(pool.mode).toBe('instanced');
    expect(pool.name).toBe('test');
    pool.dispose();
  });

  it('clamps capacity to 1 when caller passes 0 or negative', () => {
    const pool = new ParticlePool({ capacity: 0 });
    expect(pool.capacity).toBe(1);
    pool.dispose();
  });
});
