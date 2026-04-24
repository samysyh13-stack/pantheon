// PANTHÉON RibbonStrip — rolling sample-buffer trail geometry (T-102 RS).
//
// A ribbon is a quad-strip rendered from `N` sample points; each sample
// contributes two vertices (left and right of the strip's forward
// axis). The sample buffer is circular: `update(pos, width)` shifts the
// oldest sample out and adds the newest. This is the "trail of rolling
// samples" pattern in /docs/research/R-05.md §4.
//
// TWO VARIANTS (the `space` prop):
//   - 'world'           — classic trail; `update(worldPoint)` writes
//                         world-space coordinates. Used for Susanoo
//                         lightning step + the Silken Dart projectile
//                         whose head moves through world space.
//   - 'local-billboard' — vertices are emitted in a camera-facing plane
//                         so the ribbon always reads as a flat ribbon
//                         regardless of view angle. Used for Anansi's
//                         web strand when it must be "flat to camera".
//                         The caller still writes world-space sample
//                         points; the vertex shader performs the camera
//                         transformation.
//
// GEOMETRY LAYOUT
// ===============
// For `N` samples we allocate `2N` vertices and `(N-1)*6` indices for
// the tri-strip. On each `update` we shift the typed arrays in-place
// (O(N)) and mark attributes dirty. N ≤ 60 in practice, so the per-
// frame cost is negligible against the 12 ms JS budget in §4.
//
// PERF BUDGET
// ===========
// - Default sample count: 30 on mobile, 60 on desktop (tunable via
//   preset.particleDensity by the caller; see WebStrand wrapper).
// - 1 draw call per ribbon.
// - 1 shader variant ("ribbon-strip"); reused across Anansi web strand,
//   Silken Dart trail, and (later) Susanoo lightning.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
  Uniform,
  Vector3,
  AdditiveBlending,
} from 'three';
import type { Blending, ColorRepresentation } from 'three';

/** Ribbon render space. See file header. */
export type RibbonSpace = 'world' | 'local-billboard';

export interface RibbonConfig {
  /** Sample-point count. Default 30 (mobile) / 60 (desktop). */
  sampleCount?: number;
  /** 'world' | 'local-billboard'. Default 'world'. */
  space?: RibbonSpace;
  /** Default ribbon width (m) if caller omits on update. */
  defaultWidth?: number;
  /** Tint color. Default white. */
  color?: ColorRepresentation;
  /** Emissive multiplier (for bloom gating). Default 1.0. */
  emissiveIntensity?: number;
  /** Blending mode. Default AdditiveBlending. */
  blending?: Blending;
  /** Debug name. */
  name?: string;
  /** renderOrder. Default 10. */
  renderOrder?: number;
}

const RIBBON_VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute float aSide;   // -1 (left), +1 (right)
attribute float aAge;    // 0..1 where 0 = newest, 1 = oldest

uniform int   uSpaceMode; // 0 = world, 1 = local-billboard
uniform float uWidth;
uniform float uWidthTaper; // how much the tail narrows (0..1)

varying float vAge;
varying float vSide;

void main() {
  vAge = aAge;
  vSide = aSide;

  // Position encodes the sample centerline point; width lives in the
  // vertex shader so we can taper over age without re-uploading data.
  vec3 world = position;

  // Width taper: wider at head, narrow at tail.
  float w = mix(uWidth * (1.0 - uWidthTaper), uWidth, 1.0 - aAge);

  if (uSpaceMode == 1) {
    // local-billboard: offset along the screen-space right vector at
    // each vertex. Extract camera right from the inverse view matrix.
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    world += camRight * aSide * w * 0.5;
  } else {
    // world: offset along the local XZ right vector computed per-vertex
    // by the uploader (embedded into the side as a post-multiply). For
    // the v1 ribbons we rely on billboard mode OR we pre-compute right
    // offsets into the position itself in RibbonStrip.update — we pick
    // the latter for world-space trails so the ribbon twists in 3D.
    // When the uploader has already baked the offset into position,
    // aSide is 0 for both vertices (unused).
  }

  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const RIBBON_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform vec3  uColor;
uniform float uEmissive;

varying float vAge;
varying float vSide;

void main() {
  // Fade from head (age=0) to tail (age=1).
  float headFade = 1.0 - vAge;

  // Edge falloff for feathered look.
  float edge = 1.0 - abs(vSide);
  edge = max(edge, 0.0);

  float alpha = headFade * headFade * edge;
  vec3 rgb = uColor * uEmissive;

  gl_FragColor = vec4(rgb * alpha, alpha);
}
`;

/**
 * RibbonStrip.
 *
 * Typical usage:
 *   const strip = new RibbonStrip({ sampleCount: 30, space: 'local-billboard' });
 *   scene.add(strip.getObject());
 *   // each frame while the emitting entity is alive:
 *   strip.update(worldPoint);
 *   // when finished:
 *   strip.dispose();
 */
export class RibbonStrip {
  readonly sampleCount: number;
  readonly space: RibbonSpace;

  private readonly mesh: Mesh;
  private readonly geometry: BufferGeometry;
  private readonly material: ShaderMaterial;
  private readonly positions: Float32Array;
  private readonly positionAttr: BufferAttribute;

  // Rolling sample buffer: each sample is a single centerline point.
  private readonly samples: Float32Array;
  private sampleHead = 0; // index of the OLDEST sample
  private sampleFill = 0; // how many samples are populated (max sampleCount)

  // Last-known width (used as default for samples where width wasn't
  // explicitly provided).
  private lastWidth: number;

  // Reusable scratch vectors.
  private readonly tmpForward = new Vector3();
  private readonly tmpRight = new Vector3();
  private readonly tmpUp = new Vector3(0, 1, 0);

  constructor(config: RibbonConfig = {}) {
    const {
      sampleCount = 30,
      space = 'world',
      defaultWidth = 0.2,
      color = 0xffffff,
      emissiveIntensity = 1.0,
      blending = AdditiveBlending,
      name = 'ribbon-strip',
      renderOrder = 10,
    } = config;

    this.sampleCount = Math.max(4, Math.floor(sampleCount));
    this.space = space;
    this.lastWidth = defaultWidth;
    this.samples = new Float32Array(this.sampleCount * 3);

    // 2 vertices per sample — left and right of centerline.
    const vertexCount = this.sampleCount * 2;
    this.positions = new Float32Array(vertexCount * 3);
    const ages = new Float32Array(vertexCount);
    const sides = new Float32Array(vertexCount);
    const indices = new Uint16Array((this.sampleCount - 1) * 6);

    // Populate per-vertex aAge (sample-index / (N-1)) and aSide (-1/+1).
    for (let i = 0; i < this.sampleCount; i++) {
      const age = i / (this.sampleCount - 1); // 0 = newest (head), 1 = oldest (tail)
      const v0 = i * 2;
      const v1 = v0 + 1;
      ages[v0] = age;
      ages[v1] = age;
      sides[v0] = -1;
      sides[v1] = 1;
    }

    // Quad-strip indices.
    let idx = 0;
    for (let i = 0; i < this.sampleCount - 1; i++) {
      const v0 = i * 2;
      const v1 = v0 + 1;
      const v2 = v0 + 2;
      const v3 = v0 + 3;
      indices[idx++] = v0;
      indices[idx++] = v1;
      indices[idx++] = v2;
      indices[idx++] = v1;
      indices[idx++] = v3;
      indices[idx++] = v2;
    }

    this.geometry = new BufferGeometry();
    this.positionAttr = new Float32BufferAttribute(this.positions, 3);
    this.positionAttr.setUsage(35048); // DynamicDrawUsage
    this.geometry.setAttribute('position', this.positionAttr);
    this.geometry.setAttribute('aAge', new BufferAttribute(ages, 1));
    this.geometry.setAttribute('aSide', new BufferAttribute(sides, 1));
    this.geometry.setIndex(new BufferAttribute(indices, 1));

    const c = new Color(color);

    this.material = new ShaderMaterial({
      uniforms: {
        uColor: new Uniform(new Vector3(c.r, c.g, c.b)),
        uEmissive: new Uniform(emissiveIntensity),
        uSpaceMode: new Uniform(space === 'local-billboard' ? 1 : 0),
        uWidth: new Uniform(defaultWidth),
        uWidthTaper: new Uniform(0.8),
      },
      vertexShader: RIBBON_VERTEX_SHADER,
      fragmentShader: RIBBON_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: DoubleSide,
      blending,
    });
    this.material.name = `${name}-material`;

    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
  }

  /** The Three object to add to the scene graph. */
  getObject(): Mesh {
    return this.mesh;
  }

  /** Current ribbon width (m). */
  getWidth(): number {
    return this.lastWidth;
  }

  /**
   * Push a new sample onto the ribbon. The caller should call this at
   * render rate from the entity's useFrame callback. Width is optional
   * and persists across calls.
   *
   * For 'world' space, the uploader pre-computes left/right offsets
   * along the forward direction's perpendicular so the ribbon twists
   * correctly in 3D. For 'local-billboard' space, we write the
   * centerline position and let the vertex shader offset along the
   * camera right axis at draw time.
   */
  update(worldPoint: readonly [number, number, number], width?: number): void {
    if (width !== undefined) this.lastWidth = width;
    this.material.uniforms.uWidth!.value = this.lastWidth;

    // Shift sample buffer: drop oldest, append new at the tail.
    // We use the `sampleHead` cursor instead of physically shifting
    // data, then project into the positions buffer on rebuild.
    if (this.sampleFill < this.sampleCount) {
      const slot = this.sampleFill;
      this.samples[slot * 3] = worldPoint[0];
      this.samples[slot * 3 + 1] = worldPoint[1];
      this.samples[slot * 3 + 2] = worldPoint[2];
      this.sampleFill++;
    } else {
      // Buffer full: oldest slot becomes the new head; advance cursor.
      this.samples[this.sampleHead * 3] = worldPoint[0];
      this.samples[this.sampleHead * 3 + 1] = worldPoint[1];
      this.samples[this.sampleHead * 3 + 2] = worldPoint[2];
      this.sampleHead = (this.sampleHead + 1) % this.sampleCount;
    }

    this.rebuildPositions();
  }

  /**
   * Set both endpoints directly — used by WebStrand (Anansi web strand)
   * when the ribbon is a straight-line from A to B, not a trail.
   * Lerps `sampleCount` samples evenly between the endpoints.
   */
  setEndpoints(
    from: readonly [number, number, number],
    to: readonly [number, number, number],
    width?: number,
  ): void {
    if (width !== undefined) this.lastWidth = width;
    this.material.uniforms.uWidth!.value = this.lastWidth;

    for (let i = 0; i < this.sampleCount; i++) {
      const t = i / (this.sampleCount - 1);
      this.samples[i * 3] = from[0] + (to[0] - from[0]) * t;
      this.samples[i * 3 + 1] = from[1] + (to[1] - from[1]) * t;
      this.samples[i * 3 + 2] = from[2] + (to[2] - from[2]) * t;
    }
    this.sampleFill = this.sampleCount;
    this.sampleHead = 0;

    this.rebuildPositions();
  }

  /**
   * Compute the final per-vertex positions from the rolling sample
   * buffer. For 'world' space, we compute a perpendicular right vector
   * per segment and offset each vertex; for 'local-billboard' we set
   * both left/right vertices to the centerline point and the vertex
   * shader applies the camera-space right offset.
   */
  private rebuildPositions(): void {
    const halfWidth = this.lastWidth * 0.5;
    for (let i = 0; i < this.sampleCount; i++) {
      // Ordered from head (newest) to tail (oldest).
      // `ages` goes head→tail (0→1), so sample index i at age (i/N-1)
      // should map to the i-th newest sample in the ring.
      const orderedIndex = (this.sampleHead + (this.sampleCount - 1 - i) + this.sampleCount) % this.sampleCount;
      const centerX = this.samples[orderedIndex * 3]!;
      const centerY = this.samples[orderedIndex * 3 + 1]!;
      const centerZ = this.samples[orderedIndex * 3 + 2]!;

      const v0 = i * 2; // -1 side
      const v1 = v0 + 1; // +1 side

      if (this.space === 'local-billboard') {
        // Shader handles the side offset at draw time — write the same
        // centerline point to both vertices.
        this.positions[v0 * 3] = centerX;
        this.positions[v0 * 3 + 1] = centerY;
        this.positions[v0 * 3 + 2] = centerZ;
        this.positions[v1 * 3] = centerX;
        this.positions[v1 * 3 + 1] = centerY;
        this.positions[v1 * 3 + 2] = centerZ;
      } else {
        // World-space: compute forward from neighbor sample and offset
        // perpendicular along world-up to produce a flat ribbon.
        let fx = 0;
        let fy = 0;
        let fz = 1;
        if (this.sampleCount > 1) {
          const nextIdx = (this.sampleHead + (this.sampleCount - 1 - Math.max(i - 1, 0)) + this.sampleCount) % this.sampleCount;
          const nx = this.samples[nextIdx * 3]!;
          const ny = this.samples[nextIdx * 3 + 1]!;
          const nz = this.samples[nextIdx * 3 + 2]!;
          fx = nx - centerX;
          fy = ny - centerY;
          fz = nz - centerZ;
          const m = Math.hypot(fx, fy, fz);
          if (m < 1e-6) {
            fx = 0;
            fy = 0;
            fz = 1;
          } else {
            fx /= m;
            fy /= m;
            fz /= m;
          }
        }
        // right = forward x up
        this.tmpForward.set(fx, fy, fz);
        this.tmpRight.crossVectors(this.tmpForward, this.tmpUp).normalize();
        if (!Number.isFinite(this.tmpRight.x) || this.tmpRight.lengthSq() < 1e-6) {
          this.tmpRight.set(1, 0, 0);
        }
        this.positions[v0 * 3] = centerX - this.tmpRight.x * halfWidth;
        this.positions[v0 * 3 + 1] = centerY - this.tmpRight.y * halfWidth;
        this.positions[v0 * 3 + 2] = centerZ - this.tmpRight.z * halfWidth;
        this.positions[v1 * 3] = centerX + this.tmpRight.x * halfWidth;
        this.positions[v1 * 3 + 1] = centerY + this.tmpRight.y * halfWidth;
        this.positions[v1 * 3 + 2] = centerZ + this.tmpRight.z * halfWidth;
      }
    }
    this.positionAttr.needsUpdate = true;
  }

  /** Reset the sample buffer (collapses the ribbon to zero length). */
  reset(): void {
    this.positions.fill(0);
    this.samples.fill(0);
    this.sampleHead = 0;
    this.sampleFill = 0;
    this.positionAttr.needsUpdate = true;
  }

  /** Change tint live. */
  setColor(color: ColorRepresentation): void {
    const c = new Color(color);
    const v = this.material.uniforms.uColor!.value as Vector3;
    v.set(c.r, c.g, c.b);
  }

  /** Change emissive multiplier live (for bloom gating). */
  setEmissiveIntensity(v: number): void {
    this.material.uniforms.uEmissive!.value = v;
  }

  /** Dispose geometry + material. */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
