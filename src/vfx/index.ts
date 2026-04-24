// PANTHÉON VFX public surface (T-102 RS).
//
// Consumers outside /src/vfx should import from this barrel. Per-god
// VFX wrappers in /src/game/gods/<god>/vfx live OUTSIDE this barrel —
// they are authored per-god and compose the primitives below.

export { ParticlePool, AdditiveBlending, NormalBlending } from './ParticlePool';
export type {
  ParticlePoolConfig,
  ParticleRenderMode,
  SpawnOptions,
  ParticleSlotHandle,
} from './ParticlePool';

export { createEmitter } from './Emitter';
export type {
  Emitter,
  EmitterConfig,
  PositionZone,
  VelocityJitter,
  LifetimeJitter,
  SizeJitter,
  ColorRamp,
  Vec3,
} from './Emitter';

export { RibbonStrip } from './RibbonStrip';
export type { RibbonConfig, RibbonSpace } from './RibbonStrip';

export {
  HitSpark,
  WebStrand,
  DomeBoundary,
  CloneShimmer,
  WebSlickDecal,
  MistLayer,
} from './VFXController';
export type {
  HitSparkProps,
  WebStrandProps,
  DomeBoundaryProps,
  CloneShimmerProps,
  WebSlickDecalProps,
  MistLayerProps,
} from './VFXController';

// Shader + atlas helpers (exposed so tests / devtools can introspect).
export {
  PARTICLE_ATTRIBUTE_NAMES,
  PARTICLE_UNIFORM_NAMES,
  PARTICLE_ATLAS_TILES_PER_ROW,
  PARTICLE_ATLAS_PIXEL_SIZE,
  generateDefaultSpriteAtlas,
} from './particle.glsl';
