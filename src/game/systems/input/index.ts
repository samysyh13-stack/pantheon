// Public surface for the input system. Consumers should import from here.

export type {
  InputFrame,
  InputSource,
  InputAction,
  PlayerIndex,
  ActionKey,
} from './types';
export { Action, ALL_ACTIONS, createEmptyFrame } from './types';

export { DEFAULT_KEYBOARD, DEFAULT_GAMEPAD, GAMEPAD_AXIS, DEFAULT_STICK_DEADZONE } from './defaults';

export type { InputManager, CreateOptions, PlayerCount } from './manager';
export { create } from './manager';

export type { JoystickState, JoystickVector, VirtualJoystick } from './virtualJoystick';
export { createVirtualJoystick, emptyJoystickState } from './virtualJoystick';

export type { TouchSnapshot, TouchTracker, ButtonRegion, TouchButtonState, JoystickSide } from './touch';
export { createTouchTracker } from './touch';

export type { KeyboardSnapshot, KeyboardTracker } from './keyboard';
export { createKeyboardTracker } from './keyboard';

export type { MouseAim, MouseTracker } from './mouse';
export { createMouseTracker } from './mouse';

export type { GamepadSnapshot, GamepadTracker } from './gamepad';
export { createGamepadTracker } from './gamepad';

export { pulse, pulsePattern, stopHaptic } from './haptic';
