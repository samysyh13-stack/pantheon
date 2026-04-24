// Character entity public surface (T-004 AE).
//
// Consumers outside /src/game/entities/character should import from
// here. Internal cross-file imports within this folder use the relative
// filename paths directly.

export type { CharacterConfig, CharacterStats, CharacterState } from './types';

export {
  createAnimationFSM,
  ATTACK_DURATION_MS,
  DODGE_DURATION_MS,
  HIT_DURATION_MS,
} from './animationFSM';
export type { AnimationFSM } from './animationFSM';

export { createCharacterController } from './controller';
export type { CharacterController, ControllerDeps } from './controller';

export { Character } from './Character';
export type { CharacterHandle, CharacterProps, InputSource } from './Character';

export {
  TrackingCamera,
  CAMERA_OFFSET,
  CAMERA_LOOK_AT_OFFSET,
  CAMERA_LAMBDA,
  CAMERA_FOV_DEG,
  CAMERA_NEAR,
  CAMERA_FAR,
} from './Camera';
export type { TrackingCameraProps } from './Camera';

export { CharacterDemo } from './Demo';
