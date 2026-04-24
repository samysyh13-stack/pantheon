// Keyboard subscription + remap resolution. Internally the keyboard tracker
// owns a Set of depressed KeyboardEvent.code values; the manager queries it
// per-tick via `snapshot()`.

import type { InputAction } from './types';
import { DEFAULT_KEYBOARD } from './defaults';

export interface KeyboardSnapshot {
  moveX: number;
  moveY: number;
  basicAttack: boolean;
  ability: boolean;
  ultimate: boolean;
  dodge: boolean;
  pause: boolean;
  anyKeyPressedThisFrame: boolean;
}

export interface KeyboardTracker {
  snapshot(keymap?: Readonly<Record<InputAction, string>>): KeyboardSnapshot;
  isCodeDown(code: string): boolean;
  dispose(): void;
  // Mouse-button helpers used by the mouse module to share the depressed-set
  // with keyboard bindings that point at "Mouse0" / "Mouse2".
  setMouseButton(button: number, down: boolean): void;
}

function evaluate(
  down: ReadonlySet<string>,
  keymap: Readonly<Record<InputAction, string>>,
): KeyboardSnapshot {
  const up = down.has(keymap.moveUp) ? 1 : 0;
  const dn = down.has(keymap.moveDown) ? 1 : 0;
  const lt = down.has(keymap.moveLeft) ? 1 : 0;
  const rt = down.has(keymap.moveRight) ? 1 : 0;
  return {
    moveX: rt - lt,
    // Screen-space y goes down; gameplay convention has +y forward. Keep the
    // "W = +1" semantic and let the player controller translate.
    moveY: up - dn,
    basicAttack: down.has(keymap.basicAttack),
    ability: down.has(keymap.ability),
    ultimate: down.has(keymap.ultimate),
    dodge: down.has(keymap.dodge),
    pause: down.has(keymap.pause),
    anyKeyPressedThisFrame: down.size > 0,
  };
}

export function createKeyboardTracker(target: Window | HTMLElement = window): KeyboardTracker {
  const down = new Set<string>();

  const onKeyDown = (e: KeyboardEvent) => {
    down.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    down.delete(e.code);
  };
  const onBlur = () => {
    down.clear();
  };

  // `window.addEventListener` accepts KeyboardEvent listeners directly; the
  // generic overload on HTMLElement is the same. Cast the target to the base
  // EventTarget signature to satisfy both.
  const t = target as EventTarget;
  t.addEventListener('keydown', onKeyDown as EventListener);
  t.addEventListener('keyup', onKeyUp as EventListener);
  t.addEventListener('blur', onBlur);

  return {
    snapshot: (keymap = DEFAULT_KEYBOARD) => evaluate(down, keymap),
    isCodeDown: (code) => down.has(code),
    setMouseButton: (button, isDown) => {
      const token = `Mouse${button}`;
      if (isDown) down.add(token);
      else down.delete(token);
    },
    dispose: () => {
      t.removeEventListener('keydown', onKeyDown as EventListener);
      t.removeEventListener('keyup', onKeyUp as EventListener);
      t.removeEventListener('blur', onBlur);
      down.clear();
    },
  };
}
