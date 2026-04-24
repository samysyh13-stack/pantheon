// PANTHÉON ParticlePool — hand-rolled InstancedMesh + Points particle
// ring-buffer (T-102 RS, per ADR-0013).
//
// ARCHITECTURE
// ============
// A single pool owns one of:
//   - a `THREE.InstancedMesh` with `N` billboard quads (default 256 on
//     mobile, 1024 on desktop) — the standard path; uses the
//     particle-atlas ShaderMaterial; 1 draw call per pool.
//   - a `THREE.Points` cloud with `N` vertices — auto-downgrade path for
//     Mobile Low / Battery presets; uses PointsMaterial (no custom
//     shader; simpler vertex count trades silhouette detail for perf).
//
// Both modes share the same instance-buffer layout so callers can swap
// at preset-resolution time and all existing `spawn(...)` call sites
// keep working. Only the Material and the render object differ.
//
// Free-slot tracking uses a ring-buffer cursor: `spawn` writes into the
// slot under the cursor and advances. Slots whose lifetime has elapsed
// are *implicitly* recycled — the vertex shader discards them via the
// `vAlive` sentinel, and when the cursor loops back to that index the
// slot is reused. This means the pool has no CPU-side "expiry scan":
// lifetime accounting lives entirely on the GPU.
//
// MOBILE LOW / BATTERY FALLBACK
// =============================
// On mobile Low/Battery we swap the InstancedMesh for `THREE.Points`.
// Rationale: Points renders one vertex per particle rather than four,
// halving transform work and GPU bandwidth on tile-based mobile GPUs.
// We lose rotation and size-over-life billboard trickery, but the
// silhouette-critical effects (ribbons, domes) use dedicated geometry
// anyway — Points is only used for hit sparks, embers, and mist, where
// shape detail doesn't matter.
//
// Both paths respect:
//   - `renderOrder` (additive-over-opaque or behind-geometry ordering)
//   - `depthWrite: false` / `depthTest: true` (so particles occlude
//     correctly when behind opaque geometry, but do not write depth
//     themselves — fixes the typical "additive particle stipple" artifact)
//   - blending per-mode (additive by default; NormalBlending also exposed)
//
// DETERMINISM
// ===========
// The pool itself is stateless w.r.t. RNG — spawn takes an explicit
// `seed` so the caller owns the PRNG progression. (See Emitter.ts for
// the declarative spawn-jitter driver that handles RNG per ADR-0006.)
//
// PERFORMANCE BUDGET
// ==================
// - One pool = one draw call (ARCHITECTURE §4 mobile budget: ≤ 150
//   total draw calls / frame).
// - Shader variant: 1 (the particle-atlas shader, shared across pools).
// - No `three.* except the three package itself; no extra runtime deps.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  NormalBlending,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Uniform,
  Vector3,
} from 'three';
import type { Blending, Color, ColorRepresentation, Texture } from 'three';

import {
  PARTICLE_ATLAS_PIXEL_SIZE,
  PARTICLE_ATTRIBUTE_NAMES,
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
  generateDefaultSpriteAtlas,
} from './particle.glsl';

/** Render mode for a ParticlePool. */
export type ParticleRenderMode = 'instanced' | 'points';

/** Configuration for a freshly-constructed ParticlePool. */
export interface ParticlePoolConfig {
  /** Max concurrent particles. Default 256 (mobile), 1024 (desktop). */
  capacity?: number;
  /**
   * 'instanced' = InstancedMesh quads (full billboard shader).
   * 'points'    = THREE.Points (Low/Battery preset; cheaper vertex load).
   */
  mode?: ParticleRenderMode;
  /** Additive by default (glow / light accumulation). */
  blending?: Blending;
  /** RenderOrder for z-sort tie-breaks. Default 10 (over opaque). */
  renderOrder?: number;
  /**
   * Shared sprite atlas. When omitted, the pool lazily generates the
   * built-in 4×4 soft-circle atlas. Pass a shared Texture across pools
   * to keep the shader-variant count at 1 project-wide.
   */
  atlas?: Texture;
  /**
   * Global gravity vector applied analytically in the vertex shader.
   * Default (0, -2, 0) m/s² — gentle downward pull for most VFX.
   */
  gravity?: [number, number, number];
  /** Linear drag coefficient. Default 0.2. */
  drag?: number;
  /** When true, fragment shader advances atlas index over life. */
  animateAtlas?: boolean;
  /** Reduced-Motion accessibility toggle. */
  reducedMotion?: boolean;
  /** Point size (Points mode only). Default 8 px. */
  pointSize?: number;
  /**
   * Stable name for debugging and the one-shader-instance guarantee in
   * /docs/ARCHITECTURE.md §9. Multiple pools can share the same name
   * (they share the same Material instance).
   */
  name?: string;
}

/** Inline options for a single spawn call. */
export interface SpawnOptions {
  /** Velocity in world m/s. Default (0, 0, 0). */
  velocity?: readonly [number, number, number];
  /** Lifetime in seconds. Default 1.0. */
  lifetime?: number;
  /** Color tint. Default white. */
  color?: ColorRepresentation;
  /** Size multiplier. Default 1.0. */
  size?: number;
  /** Per-particle seed in [0,1). Default 0.5. */
  seed?: number;
}

/**
 * Minimal handle returned by spawn. `slot` is the instance index; the
 * caller can cancel by overriding lifetime via `cancelSlot`.
 */
export interface ParticleSlotHandle {
  readonly slot: number;
}

// Reusable scratch objects — avoid per-frame GC churn.
const SCRATCH_MATRIX = new Matrix4();
const SCRATCH_PROXY = new Object3D();
const TMP_COLOR = { r: 1, g: 1, b: 1 };

/**
 * ParticlePool.
 *
 * Public API:
 *   - spawn(position, options) → slotIndex
 *   - update(frameSeconds)     → advance uTime on the shader
 *   - getObject()              → the Three.js Object3D to add to the scene
 *   - setReducedMotion(on)     → toggles the shader's reduced-motion scale
 *   - dispose()                → releases geometry, material, atlas
 */
export class ParticlePool {
  readonly capacity: number;
  readonly mode: ParticleRenderMode;
  readonly name: string;

  private readonly atlasTexture: Texture;
  private readonly ownsAtlas: boolean;
  private readonly object: InstancedMesh | Points;
  private readonly sharedUniforms: {
    uTime: Uniform<number>;
    uSpriteAtlas: Uniform<Texture>;
    uFrustumScale: Uniform<number>;
    uGravity: Uniform<Vector3>;
    uDrag: Uniform<number>;
    uReducedMotion: Uniform<number>;
    uAnimateAtlas: Uniform<number>;
  };

  // Instance buffers (kept as typed arrays so we can write into them
  // directly during spawn without allocating).
  private readonly birthTimes: Float32Array;
  private readonly lifetimes: Float32Array;
  private readonly seeds: Float32Array;
  private readonly colors: Float32Array; // vec3 per slot
  private readonly velocities: Float32Array; // vec3 per slot
  private readonly sizes: Float32Array;

  // Free-slot cursor. Advances on each spawn(); wraps around capacity.
  private cursor = 0;

  // Time accumulator in seconds — fed to `uTime`. Simulation-only;
  // ADR-0006 wall-clock is deliberately kept out of the simulation path.
  private timeSeconds = 0;

  // Attribute refs we need to mark-for-update per spawn.
  private readonly birthAttr: InstancedBufferAttribute | BufferAttribute;
  private readonly lifeAttr: InstancedBufferAttribute | BufferAttribute;
  private readonly seedAttr: InstancedBufferAttribute | BufferAttribute;
  private readonly colorAttr: InstancedBufferAttribute | BufferAttribute;
  private readonly velocityAttr: InstancedBufferAttribute | BufferAttribute;
  private readonly sizeAttr: InstancedBufferAttribute | BufferAttribute;
  // Points mode: uses a standard position attribute.
  private readonly positionAttr: BufferAttribute | null;
  // InstancedMesh mode: uses the instanceMatrix slot.
  private readonly isInstanced: boolean;

  constructor(config: ParticlePoolConfig = {}) {
    const {
      capacity = 256,
      mode = 'instanced',
      blending = AdditiveBlending,
      renderOrder = 10,
      atlas,
      gravity = [0, -2, 0],
      drag = 0.2,
      animateAtlas = false,
      reducedMotion = false,
      pointSize = 8,
      name = 'particle-pool',
    } = config;

    this.capacity = Math.max(1, Math.floor(capacity));
    this.mode = mode;
    this.name = name;
    this.isInstanced = mode === 'instanced';

    // Allocate instance buffers.
    this.birthTimes = new Float32Array(this.capacity);
    this.lifetimes = new Float32Array(this.capacity);
    this.seeds = new Float32Array(this.capacity);
    this.colors = new Float32Array(this.capacity * 3);
    this.velocities = new Float32Array(this.capacity * 3);
    this.sizes = new Float32Array(this.capacity);

    // Initial pool state: all slots "dead" (birthTime = -infinity so
    // age - lifetime > 0 from the first frame onward).
    this.birthTimes.fill(-1e9);
    this.lifetimes.fill(0.0001);
    this.sizes.fill(0);
    // colors default transparent-black
    // velocities default zero

    // Resolve the atlas — either user-provided or generate our built-in one.
    if (atlas) {
      this.atlasTexture = atlas;
      this.ownsAtlas = false;
    } else {
      this.atlasTexture = makeBuiltinAtlasTexture();
      this.ownsAtlas = true;
    }

    // Shared uniform group — a single object instance so multiple pools
    // sharing an atlas also share a uniform set. (In practice each pool
    // owns its own material instance because blending/gravity differ;
    // the atlas Texture is the expensive shared resource.)
    this.sharedUniforms = {
      uTime: new Uniform<number>(0),
      uSpriteAtlas: new Uniform<Texture>(this.atlasTexture),
      uFrustumScale: new Uniform<number>(1.0),
      uGravity: new Uniform<Vector3>(new Vector3(gravity[0], gravity[1], gravity[2])),
      uDrag: new Uniform<number>(drag),
      uReducedMotion: new Uniform<number>(reducedMotion ? 1 : 0),
      uAnimateAtlas: new Uniform<number>(animateAtlas ? 1 : 0),
    };

    if (this.isInstanced) {
      // Build the base quad: a 1×1 plane centered at origin in XY. The
      // vertex shader reads `position` to billboard it to the camera.
      const quad = new PlaneGeometry(1, 1, 1, 1);

      // Convert plane to an InstancedBufferGeometry-compatible base —
      // we attach the instance buffers as InstancedBufferAttribute so
      // Three's renderer sees one attribute per-instance.
      this.birthAttr = new InstancedBufferAttribute(this.birthTimes, 1);
      this.lifeAttr = new InstancedBufferAttribute(this.lifetimes, 1);
      this.seedAttr = new InstancedBufferAttribute(this.seeds, 1);
      this.colorAttr = new InstancedBufferAttribute(this.colors, 3);
      this.velocityAttr = new InstancedBufferAttribute(this.velocities, 3);
      this.sizeAttr = new InstancedBufferAttribute(this.sizes, 1);

      this.birthAttr.setUsage(35048); // DynamicDrawUsage
      this.lifeAttr.setUsage(35048);
      this.seedAttr.setUsage(35048);
      this.colorAttr.setUsage(35048);
      this.velocityAttr.setUsage(35048);
      this.sizeAttr.setUsage(35048);

      quad.setAttribute(PARTICLE_ATTRIBUTE_NAMES.birthTime, this.birthAttr);
      quad.setAttribute(PARTICLE_ATTRIBUTE_NAMES.lifetime, this.lifeAttr);
      quad.setAttribute(PARTICLE_ATTRIBUTE_NAMES.seed, this.seedAttr);
      quad.setAttribute(PARTICLE_ATTRIBUTE_NAMES.color, this.colorAttr);
      quad.setAttribute(PARTICLE_ATTRIBUTE_NAMES.velocity, this.velocityAttr);
      quad.setAttribute(PARTICLE_ATTRIBUTE_NAMES.size, this.sizeAttr);

      const material = new ShaderMaterial({
        uniforms: this.sharedUniforms as unknown as Record<
          string,
          Uniform<number | Vector3 | Texture>
        >,
        vertexShader: PARTICLE_VERTEX_SHADER,
        fragmentShader: PARTICLE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending,
        side: DoubleSide,
      });
      material.name = `${name}-material`;

      const mesh = new InstancedMesh(quad, material, this.capacity);
      mesh.name = name;
      mesh.frustumCulled = false; // pool bounds vary per frame; skip.
      mesh.renderOrder = renderOrder;
      mesh.count = this.capacity;

      // Initialize all instanceMatrices to zero translation — spawn()
      // will rewrite these into real world positions.
      SCRATCH_MATRIX.identity();
      for (let i = 0; i < this.capacity; i++) {
        mesh.setMatrixAt(i, SCRATCH_MATRIX);
      }
      mesh.instanceMatrix.needsUpdate = true;

      this.object = mesh;
      this.positionAttr = null;
    } else {
      // Points path — a single Geometry with capacity vertices.
      const geom = new BufferGeometry();
      const positions = new Float32Array(this.capacity * 3);
      this.positionAttr = new Float32BufferAttribute(positions, 3);
      this.positionAttr.setUsage(35048); // DynamicDrawUsage
      geom.setAttribute('position', this.positionAttr);

      // Store instance data as per-vertex attributes.
      this.birthAttr = new BufferAttribute(this.birthTimes, 1);
      this.lifeAttr = new BufferAttribute(this.lifetimes, 1);
      this.seedAttr = new BufferAttribute(this.seeds, 1);
      this.colorAttr = new BufferAttribute(this.colors, 3);
      this.velocityAttr = new BufferAttribute(this.velocities, 3);
      this.sizeAttr = new BufferAttribute(this.sizes, 1);

      geom.setAttribute(PARTICLE_ATTRIBUTE_NAMES.birthTime, this.birthAttr);
      geom.setAttribute(PARTICLE_ATTRIBUTE_NAMES.lifetime, this.lifeAttr);
      geom.setAttribute(PARTICLE_ATTRIBUTE_NAMES.seed, this.seedAttr);
      geom.setAttribute(PARTICLE_ATTRIBUTE_NAMES.color, this.colorAttr);
      geom.setAttribute(PARTICLE_ATTRIBUTE_NAMES.velocity, this.velocityAttr);
      geom.setAttribute(PARTICLE_ATTRIBUTE_NAMES.size, this.sizeAttr);

      // PointsMaterial is the simplest path for the mobile fallback.
      // Shader-variant count: 1 (shared built-in material). We lose the
      // custom atlas animation, but Low/Battery already opts out of the
      // bloom flash / color-grade chain so visual parity is not a goal.
      const pm = new PointsMaterial({
        size: pointSize,
        map: this.atlasTexture,
        alphaMap: this.atlasTexture,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending,
        sizeAttenuation: true,
        vertexColors: false,
      });
      pm.name = `${name}-points-material`;

      const points = new Points(geom, pm);
      points.name = name;
      points.frustumCulled = false;
      points.renderOrder = renderOrder;

      this.object = points;
    }
  }

  /** The Three object to add to the scene graph. */
  getObject(): InstancedMesh | Points {
    return this.object;
  }

  /** Current pool time in seconds (fed to the shader as `uTime`). */
  getTimeSeconds(): number {
    return this.timeSeconds;
  }

  /**
   * Advance the shader clock. Call once per render frame from the
   * consumer's useFrame. Accepts delta seconds.
   */
  update(deltaSeconds: number): void {
    this.timeSeconds += deltaSeconds;
    this.sharedUniforms.uTime.value = this.timeSeconds;
  }

  /** Toggle Reduced-Motion. Cheap — writes a single uniform. */
  setReducedMotion(on: boolean): void {
    this.sharedUniforms.uReducedMotion.value = on ? 1 : 0;
  }

  /**
   * Spawn a particle. Writes into the slot under the ring-cursor and
   * advances the cursor. Returns the slot index so callers can
   * reference or cancel the slot later.
   *
   * Expired slots are NOT scanned for — the shader discards dead
   * particles on the GPU, and the cursor naturally recycles them as it
   * loops around capacity. This is the "ring buffer" pattern in
   * /docs/research/R-05.md §5.
   */
  spawn(position: readonly [number, number, number], options: SpawnOptions = {}): ParticleSlotHandle {
    const slot = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;

    const now = this.timeSeconds;
    const {
      velocity = [0, 0, 0],
      lifetime = 1.0,
      color = 0xffffff,
      size = 1.0,
      seed = 0.5,
    } = options;

    // Write to instance buffers.
    this.birthTimes[slot] = now;
    this.lifetimes[slot] = Math.max(0.0001, lifetime);
    this.seeds[slot] = ((seed % 1) + 1) % 1; // normalize to [0,1)
    this.sizes[slot] = size;
    this.velocities[slot * 3] = velocity[0];
    this.velocities[slot * 3 + 1] = velocity[1];
    this.velocities[slot * 3 + 2] = velocity[2];

    decodeColor(color, TMP_COLOR);
    this.colors[slot * 3] = TMP_COLOR.r;
    this.colors[slot * 3 + 1] = TMP_COLOR.g;
    this.colors[slot * 3 + 2] = TMP_COLOR.b;

    if (this.isInstanced) {
      const mesh = this.object as InstancedMesh;
      SCRATCH_PROXY.position.set(position[0], position[1], position[2]);
      SCRATCH_PROXY.rotation.set(0, 0, 0);
      SCRATCH_PROXY.scale.set(1, 1, 1);
      SCRATCH_PROXY.updateMatrix();
      mesh.setMatrixAt(slot, SCRATCH_PROXY.matrix);
      mesh.instanceMatrix.needsUpdate = true;
    } else {
      if (this.positionAttr) {
        const parr = this.positionAttr.array as Float32Array;
        parr[slot * 3] = position[0];
        parr[slot * 3 + 1] = position[1];
        parr[slot * 3 + 2] = position[2];
        this.positionAttr.needsUpdate = true;
      }
    }

    this.birthAttr.needsUpdate = true;
    this.lifeAttr.needsUpdate = true;
    this.seedAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.velocityAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;

    return { slot };
  }

  /**
   * Cancel a slot immediately (forces its remaining lifetime to zero).
   * Useful for "despawn on hit" or clone-death cleanup. Does NOT free
   * the cursor — cursor stays linear.
   */
  cancelSlot(slot: number): void {
    if (slot < 0 || slot >= this.capacity) return;
    this.lifetimes[slot] = 0.0001;
    this.birthTimes[slot] = -1e9;
    this.lifeAttr.needsUpdate = true;
    this.birthAttr.needsUpdate = true;
  }

  /** Dispose geometry + material (+ owned atlas). */
  dispose(): void {
    if (this.isInstanced) {
      const mesh = this.object as InstancedMesh;
      mesh.geometry.dispose();
      (mesh.material as ShaderMaterial).dispose();
    } else {
      const pts = this.object as Points;
      pts.geometry.dispose();
      (pts.material as PointsMaterial).dispose();
    }
    if (this.ownsAtlas) {
      this.atlasTexture.dispose();
    }
  }

  /**
   * Count live particles right now. O(N) — only for tests and
   * debug HUDs; not called from the render loop.
   */
  countLive(nowSeconds: number = this.timeSeconds): number {
    let live = 0;
    for (let i = 0; i < this.capacity; i++) {
      const age = nowSeconds - this.birthTimes[i]!;
      if (age >= 0 && age < this.lifetimes[i]!) live++;
    }
    return live;
  }

  /** Test helper: current ring cursor. */
  getCursor(): number {
    return this.cursor;
  }

  /**
   * Accessor for the underlying shared uniforms. Used when pools share
   * uTime or atlas texture across a scene. Treat as read-mostly.
   */
  getSharedUniforms(): Readonly<typeof this.sharedUniforms> {
    return this.sharedUniforms;
  }

  /** Read the lifetime assigned to a given slot (test + debug use). */
  getLifetimeAtSlot(slot: number): number {
    return this.lifetimes[slot] ?? 0;
  }

  /** Read the birth-time assigned to a given slot (test + debug use). */
  getBirthTimeAtSlot(slot: number): number {
    return this.birthTimes[slot] ?? -1e9;
  }
}

// ---------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------

/**
 * Lazily-cached shared atlas. Because every pool in instanced mode is
 * built against the same Shader, sharing the texture keeps the project
 * at 1 shader variant for particle rendering (ADR-0013 / ARCHITECTURE §9).
 */
let SHARED_ATLAS: DataTexture | null = null;

function makeBuiltinAtlasTexture(): DataTexture {
  if (SHARED_ATLAS) return SHARED_ATLAS;
  const data = generateDefaultSpriteAtlas();
  const tex = new DataTexture(
    data,
    PARTICLE_ATLAS_PIXEL_SIZE,
    PARTICLE_ATLAS_PIXEL_SIZE,
    RGBAFormat,
    UnsignedByteType,
  );
  tex.needsUpdate = true;
  tex.name = 'particle-atlas';
  SHARED_ATLAS = tex;
  return tex;
}

/**
 * Minimal ColorRepresentation → linear RGB decoder. Avoids allocating
 * a three.Color on each spawn. Handles:
 *   - hex number (0xRRGGBB)
 *   - "#RRGGBB" strings (common in design docs)
 *   - a `three.Color`-compatible object (already linear; {r,g,b})
 */
function decodeColor(
  c: ColorRepresentation,
  out: { r: number; g: number; b: number },
): void {
  if (typeof c === 'number') {
    out.r = ((c >> 16) & 0xff) / 255;
    out.g = ((c >> 8) & 0xff) / 255;
    out.b = (c & 0xff) / 255;
    return;
  }
  if (typeof c === 'string') {
    // Handle "#RRGGBB" and "#RGB"
    const s = c.startsWith('#') ? c.slice(1) : c;
    if (s.length === 6) {
      out.r = parseInt(s.slice(0, 2), 16) / 255;
      out.g = parseInt(s.slice(2, 4), 16) / 255;
      out.b = parseInt(s.slice(4, 6), 16) / 255;
      return;
    }
    if (s.length === 3) {
      out.r = (parseInt(s[0]! + s[0]!, 16)) / 255;
      out.g = (parseInt(s[1]! + s[1]!, 16)) / 255;
      out.b = (parseInt(s[2]! + s[2]!, 16)) / 255;
      return;
    }
  }
  // three.Color-compatible fallback.
  const maybe = c as Partial<Color>;
  if (typeof maybe.r === 'number' && typeof maybe.g === 'number' && typeof maybe.b === 'number') {
    out.r = maybe.r;
    out.g = maybe.g;
    out.b = maybe.b;
    return;
  }
  out.r = 1;
  out.g = 1;
  out.b = 1;
}

/** Re-export the default blending value for callers. */
export { AdditiveBlending, NormalBlending };
