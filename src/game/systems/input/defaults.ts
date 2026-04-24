// Default keymaps for keyboard+mouse and gamepad.
// Duplicated from the settings store's seed so the input layer can resolve a
// binding even before the store has hydrated from localStorage. The settings
// store's `migrate` path fills the same values into ControlSettings.

import type { InputAction } from './types';

// KeyboardEvent.code values, plus two synthetic mouse tokens:
//   "Mouse0" — primary button (LMB)
//   "Mouse2" — secondary button (RMB)
// Middle click and extra buttons are intentionally not bound in v1.
export const DEFAULT_KEYBOARD: Readonly<Record<InputAction, string>> = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  basicAttack: 'Mouse0',
  ability: 'Mouse2',
  ultimate: 'Space',
  dodge: 'ShiftLeft',
  pause: 'Escape',
};

// Standard-mapping button indices per W3C Gamepad API:
//   0 A / Cross        1 B / Circle       2 X / Square      3 Y / Triangle
//   4 LB  5 RB  6 LT  7 RT  8 Back/Select  9 Start/Options
//   10 L3 11 R3
//   12 DPad Up  13 DPad Down  14 DPad Left  15 DPad Right
// Movement is sourced from axes 0/1 (left stick) primarily; the dpad entries
// below are the fallback remap targets.
export const DEFAULT_GAMEPAD: Readonly<Record<InputAction, number>> = {
  moveUp: 12,
  moveDown: 13,
  moveLeft: 14,
  moveRight: 15,
  basicAttack: 7, // RT
  ability: 5, // RB
  ultimate: 3, // Y / Triangle
  dodge: 6, // LT
  pause: 9, // Start / Options
};

// Gamepad axis indices for left and right thumbsticks (standard mapping).
export const GAMEPAD_AXIS = {
  leftX: 0,
  leftY: 1,
  rightX: 2,
  rightY: 3,
} as const;

// Minimum raw stick magnitude before input is considered present. Matches
// the default radial deadzone used by most shipped fighting games.
export const DEFAULT_STICK_DEADZONE = 0.15;

// Vendor-specific button override hook — Xbox vs PlayStation vs generic share
// the standard mapping well enough that we don't need per-vendor remaps at
// ship. Any future diverging controller surfaces here.
export function gamepadButtonForAction(
  action: InputAction,
  overrides?: Partial<Record<InputAction, number>>,
): number {
  return overrides?.[action] ?? DEFAULT_GAMEPAD[action];
}
