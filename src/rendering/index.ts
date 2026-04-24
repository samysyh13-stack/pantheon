// PANTHÉON rendering public surface (T-002 RS).
//
// Consumers outside /src/rendering should import from this barrel.

export { GameCanvas } from './Canvas';
export { GameEnvironment } from './environment';
export { ToonMaterial, RimMaterial } from './materials';
export type { ToonMaterialProps, RimMaterialProps } from './materials';
export { PRESETS, resolvePreset, detectPreset } from './presets';
export type { PresetConfig, Tonemap } from './presets';
