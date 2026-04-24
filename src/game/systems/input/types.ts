// Unified input stream shape consumed by gameplay systems (see
// /docs/ARCHITECTURE.md §12 for authoritative spec). Gameplay code touches
// InputFrame only — never DOM events, Gamepad API, or touch targets.

import type { InputAction } from '../../../state/store';

export { type InputAction };

export type PlayerIndex = 0 | 1 | 2 | 3;

export type InputSource = 'keyboard+mouse' | 'gamepad' | 'touch';

export interface InputFrame {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  aimMagnitude: number;
  basicAttack: boolean;
  ability: boolean;
  ultimate: boolean;
  dodge: boolean;
  pause: boolean;
  source: InputSource;
  playerIndex: PlayerIndex;
}

// Enum-style Action set kept as a const object so runtime code can iterate it
// without a `keyof` juggle and tests can assert equality against the stored
// keymap. Mirrors the InputAction union from the settings store.
export const Action = {
  MoveUp: 'moveUp',
  MoveDown: 'moveDown',
  MoveLeft: 'moveLeft',
  MoveRight: 'moveRight',
  BasicAttack: 'basicAttack',
  Ability: 'ability',
  Ultimate: 'ultimate',
  Dodge: 'dodge',
  Pause: 'pause',
} as const satisfies Record<string, InputAction>;

export type ActionKey = (typeof Action)[keyof typeof Action];

export const ALL_ACTIONS: readonly InputAction[] = [
  Action.MoveUp,
  Action.MoveDown,
  Action.MoveLeft,
  Action.MoveRight,
  Action.BasicAttack,
  Action.Ability,
  Action.Ultimate,
  Action.Dodge,
  Action.Pause,
];

export function createEmptyFrame(
  playerIndex: PlayerIndex = 0,
  source: InputSource = 'keyboard+mouse',
): InputFrame {
  return {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    aimMagnitude: 0,
    basicAttack: false,
    ability: false,
    ultimate: false,
    dodge: false,
    pause: false,
    source,
    playerIndex,
  };
}
