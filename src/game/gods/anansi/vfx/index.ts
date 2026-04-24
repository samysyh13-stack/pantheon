// Anansi VFX barrel (T-102 RS).
//
// Consumers (god component, combat systems, tests) should import from
// here. The underlying VFX primitives live in /src/vfx/; these wrappers
// compose them with Anansi's colors and ability-specific lifecycles.

export { SilkenDart } from './SilkenDart';
export type { SilkenDartProps, SilkenDartPhase } from './SilkenDart';

export { MirrorThreadVFX } from './MirrorThreadVFX';
export type { MirrorThreadVFXProps } from './MirrorThreadVFX';

export { EightStrandDome } from './EightStrandDome';
export type {
  EightStrandDomeProps,
  EightStrandDomePhase,
} from './EightStrandDome';
