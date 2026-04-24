// PANTHÉON particle shader (T-102 RS).
//
// Single shader variant shared across every ParticlePool that renders in
// InstancedMesh mode. Kept TS-module-form (not a raw .glsl file) because:
//   - the project has no vite-plugin-glsl / `?raw` loader wired,
//   - /src/rendering/materials/{Toon,Rim}.tsx already use the same
//     `/* glsl */`-tagged template-literal convention (editor tooling
//     picks up the highlight hint), and
//   - we can co-locate a TypeScript attribute-name constant registry so
//     ParticlePool / Emitter / tests stay in lockstep with the shader.
//
// ADR-0013 compliance:
//   - Vertex shader evolves position analytically from `aBirthTime + uTime`;
//     CPU never writes per-particle transforms after spawn.
//   - Fragment samples a 4×4 sprite atlas indexed by `aSeed mod 16`.
//   - Additive blend, depth-write off, depth-test on (configured on the
//     Material in ParticlePool.ts, not here).
//
// Uniforms:
//   - `uTime`         (f32) — seconds since pool creation; driven by
//                             ParticlePool.update() each frame.
//   - `uSpriteAtlas`  (Texture2D) — 4×4 grid of circular sprite variants.
//   - `uFrustumScale` (f32) — scales billboard quad size (perspective-
//                             correction hook; 1.0 on orthographic).
//   - `uGravity`      (vec3) — analytic gravity vector (default (0,-2,0)).
//   - `uDrag`         (f32)  — linear drag coefficient (default 0.2).
//   - `uReducedMotion` (f32) — 0 or 1; when 1, lifetime/size scale down.
//   - `uAnimateAtlas` (f32)  — 0 or 1; when 1, atlas index advances over
//                              lifetime (ember-like flicker). When 0, the
//                              sprite is fixed per seed (hit sparks etc.).
//
// Per-instance attributes (written by ParticlePool spawn slot):
//   - `aBirthTime` (f32)  — time (in `uTime` units) the particle spawned.
//   - `aLifetime`  (f32)  — planned lifetime seconds. `alive = uTime - aBirth < aLifetime`.
//   - `aSeed`      (f32)  — randomized per-particle scalar in [0, 1).
//   - `aColor`     (vec3) — tint multiplied into the atlas sample.
//   - `aVelocity`  (vec3) — initial velocity (meters/second).
//   - `aSize`      (f32)  — billboard world-size multiplier.
//
// Note: `aPosition` (vec3) is the spawn world-origin. We chose to store
// the initial position on the instance matrix (`instanceMatrix`) rather
// than a separate attribute because Three.js's InstancedMesh already
// ships an instanceMatrix buffer — reusing it saves one attribute slot.
// The vertex shader reads `instanceMatrix` for the spawn translation and
// then adds the analytic offset.

/** Attribute names used across shader + ParticlePool + tests. */
export const PARTICLE_ATTRIBUTE_NAMES = {
  birthTime: 'aBirthTime',
  lifetime: 'aLifetime',
  seed: 'aSeed',
  color: 'aColor',
  velocity: 'aVelocity',
  size: 'aSize',
} as const;

/** Uniform names used across shader + ParticlePool + tests. */
export const PARTICLE_UNIFORM_NAMES = {
  time: 'uTime',
  spriteAtlas: 'uSpriteAtlas',
  frustumScale: 'uFrustumScale',
  gravity: 'uGravity',
  drag: 'uDrag',
  reducedMotion: 'uReducedMotion',
  animateAtlas: 'uAnimateAtlas',
} as const;

/** Atlas is 4×4 — fragment shader indexes mod 16. */
export const PARTICLE_ATLAS_TILES_PER_ROW = 4;

/**
 * Vertex shader.
 *
 * We billboard each quad toward the camera by rotating its local offset
 * by the inverse of the camera yaw. The standard approach is to use
 * `modelViewMatrix` rows (the view-space basis vectors) so the quad
 * always faces the camera regardless of instanceMatrix rotation. This is
 * the "spherical billboard" trick from the three.js docs — cheaper than
 * sampling a full view-inverse every vertex.
 */
export const PARTICLE_VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute float aBirthTime;
attribute float aLifetime;
attribute float aSeed;
attribute vec3  aColor;
attribute vec3  aVelocity;
attribute float aSize;

uniform float uTime;
uniform float uFrustumScale;
uniform vec3  uGravity;
uniform float uDrag;
uniform float uReducedMotion;

varying float vAge01;     // 0..1 normalized over lifetime
varying float vSeed;
varying vec2  vUv;
varying vec3  vColor;
varying float vAlive;     // 1.0 if alive this frame, else 0.0

void main() {
  // Age in seconds within this lifetime.
  float age = uTime - aBirthTime;
  float life = max(aLifetime, 0.0001);

  // Reduced-motion: shorten lifetime so the particle fades faster
  // without touching spawn/recycle logic on the CPU.
  float rmScale = mix(1.0, 0.6, uReducedMotion);
  float effectiveLife = life * rmScale;

  // Kill sentinel: if age >= lifetime or before birth, collapse the
  // quad to zero-size so the fragment stage is skipped and the particle
  // is effectively invisible until recycled.
  vAlive = step(0.0, age) * step(age, effectiveLife);
  float age01 = clamp(age / effectiveLife, 0.0, 1.0);
  vAge01 = age01;

  // Analytic displacement:
  //   p(t) = v0 * ((1 - exp(-k*t)) / k) + 0.5 * g * t^2
  // (exponential drag + constant gravity). For k → 0 the drag term
  // degenerates to v0 * t, so we guard with a small epsilon.
  float k = max(uDrag, 0.0001);
  float dragFactor = (1.0 - exp(-k * age)) / k;
  vec3 displacement = aVelocity * dragFactor + 0.5 * uGravity * age * age;

  // Spawn origin comes from instanceMatrix (translation column). We
  // reconstruct it rather than multiplying position by instanceMatrix
  // because we also want the billboard to face the camera regardless of
  // instanceMatrix rotation.
  vec4 spawnWorld = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec3 particleWorld = spawnWorld.xyz + displacement;

  // Size falloff — quick fade-in, slow fade-out (Phase 2 polish can
  // swap in a LUT via uSizeOverLife; keeping analytic here to stay
  // CPU-write-free and uniform-count-low).
  float sizeCurve = smoothstep(0.0, 0.15, age01) * (1.0 - age01);
  float rmSize = mix(1.0, 0.5, uReducedMotion);
  float worldSize = aSize * sizeCurve * uFrustumScale * rmSize;

  // Billboard: extract the view-space right / up basis from the
  // view matrix (modelViewMatrix is instanceMatrix * viewMatrix; we
  // want camera-space, so pull from viewMatrix directly).
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

  // The quad geometry in our geometry has position in [-0.5, 0.5]^2 on XY.
  vec3 offset = (camRight * position.x + camUp * position.y) * worldSize * vAlive;
  vec4 worldPos = vec4(particleWorld + offset, 1.0);

  gl_Position = projectionMatrix * viewMatrix * worldPos;

  vUv = uv;
  vColor = aColor;
  vSeed = aSeed;
}
`;

/**
 * Fragment shader.
 *
 * 4×4 atlas — 16 circular-falloff sprite variants. `aSeed` picks which
 * tile; optional `uAnimateAtlas` advances through tiles over life for
 * flickering effects. Additive blending happens in the Material's
 * blending state, not here — we just output a premultiplied-alpha color.
 */
export const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uSpriteAtlas;
uniform float     uAnimateAtlas;

varying float vAge01;
varying float vSeed;
varying vec2  vUv;
varying vec3  vColor;
varying float vAlive;

void main() {
  if (vAlive < 0.5) { discard; }

  // Per-seed tile index into 4×4 atlas. When uAnimateAtlas is 1, we
  // also advance by age so a single particle flickers through frames.
  float baseTile = floor(vSeed * 16.0);
  float advance  = floor(vAge01 * 16.0) * uAnimateAtlas;
  float tile = mod(baseTile + advance, 16.0);

  float col = mod(tile, 4.0);
  float row = floor(tile / 4.0);

  vec2 tileUv = (vec2(col, row) + clamp(vUv, 0.0, 1.0)) / 4.0;

  vec4 sample_ = texture2D(uSpriteAtlas, tileUv);

  // Fade alpha at the end of life (0.8 .. 1.0 -> 1.0 .. 0.0).
  float fadeOut = 1.0 - smoothstep(0.8, 1.0, vAge01);
  vec3 rgb = sample_.rgb * vColor;
  float a = sample_.a * fadeOut;

  // Premultiplied output — additive blend set on material level means
  // the alpha channel is not used as a gate (src = rgb, dst += src * 1).
  gl_FragColor = vec4(rgb * a, a);
}
`;

/**
 * Lightweight, deterministic built-in atlas — a 4×4 canvas-painted set
 * of soft circular falloff sprites with varying jitter. Generated at
 * runtime so we don't ship a binary atlas for this MVP. Higher-quality
 * atlases land in Phase 2 polish (T-303 RS final visual polish).
 *
 * Returns a `DataTexture` — 64×64 pixels (4×4 tiles × 16 px each).
 * Single RGBA8 allocation, ~16 KB in VRAM. Cheap.
 *
 * Determinism: tile content is a pure function of `seedSalt`, so
 * re-calling with the same salt yields byte-identical pixels.
 */
export function generateDefaultSpriteAtlas(seedSalt = 0xa0a051): Uint8Array {
  const tilesPerRow = PARTICLE_ATLAS_TILES_PER_ROW;
  const tilePx = 16;
  const size = tilesPerRow * tilePx;
  const buf = new Uint8Array(size * size * 4);

  // LCG for atlas generation — avoids importing createRng here to keep
  // the shader file zero-dep. This is build-time determinism, not
  // gameplay RNG, so it can use its own generator safely.
  let s = seedSalt >>> 0;
  const nextRand = () => {
    s = (Math.imul(s, 0x5bd1e995) + 0x1) >>> 0;
    return (s & 0xffffff) / 0xffffff;
  };

  for (let ty = 0; ty < tilesPerRow; ty++) {
    for (let tx = 0; tx < tilesPerRow; tx++) {
      // Per-tile "shape wobble" — not a harsh circle; gives visual variety.
      const shapeSharpness = 1.5 + nextRand() * 3.0;
      const centerOffsetX = (nextRand() - 0.5) * 0.2;
      const centerOffsetY = (nextRand() - 0.5) * 0.2;
      for (let py = 0; py < tilePx; py++) {
        for (let px = 0; px < tilePx; px++) {
          const u = (px + 0.5) / tilePx - 0.5 - centerOffsetX;
          const v = (py + 0.5) / tilePx - 0.5 - centerOffsetY;
          const r = Math.hypot(u, v) * 2.0; // 0 at center, ~1 at edge
          const a = Math.max(0, 1 - Math.pow(r, shapeSharpness));
          const outX = tx * tilePx + px;
          const outY = ty * tilePx + py;
          const idx = (outY * size + outX) * 4;
          // Soft circular falloff. RGB = white; color comes from aColor
          // in the fragment shader (tint multiply).
          buf[idx] = 255;
          buf[idx + 1] = 255;
          buf[idx + 2] = 255;
          buf[idx + 3] = Math.round(a * 255);
        }
      }
    }
  }
  return buf;
}

export const PARTICLE_ATLAS_PIXEL_SIZE = PARTICLE_ATLAS_TILES_PER_ROW * 16;
