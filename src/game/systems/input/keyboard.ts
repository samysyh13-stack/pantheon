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

/**
 * Layout-fallback alias codes for each movement action. KeyboardEvent.code
 * is layout-independent in the spec (e.g. "KeyW" always = the physical
 * key in QWERTY-W position), but:
 *   - Some AZERTY configurations (French) return `code` values that track
 *     the labeled letter rather than the physical position — we want both
 *     "press the key labeled Z" and "press the key labeled W" to work.
 *   - Arrow keys are a near-universal accessibility fallback many
 *     players expect alongside WASD/ZQSD.
 *
 * The primary binding from the keymap is checked first; aliases are
 * OR-ed in. Remapping the primary via Settings doesn't disable the
 * aliases — they're a safety net, not a user-facing binding.
 */
const MOVE_UP_ALIASES = ['KeyZ', 'ArrowUp'];
const MOVE_DOWN_ALIASES = ['ArrowDown'];
const MOVE_LEFT_ALIASES = ['KeyQ', 'ArrowLeft'];
const MOVE_RIGHT_ALIASES = ['ArrowRight'];

function anyDown(down: ReadonlySet<string>, primary: string, aliases: readonly string[]): boolean {
  if (down.has(primary)) return true;
  for (const alias of aliases) if (down.has(alias)) return true;
  return false;
}

function evaluate(
  down: ReadonlySet<string>,
  keymap: Readonly<Record<InputAction, string>>,
): KeyboardSnapshot {
  const up = anyDown(down, keymap.moveUp, MOVE_UP_ALIASES) ? 1 : 0;
  const dn = anyDown(down, keymap.moveDown, MOVE_DOWN_ALIASES) ? 1 : 0;
  const lt = anyDown(down, keymap.moveLeft, MOVE_LEFT_ALIASES) ? 1 : 0;
  const rt = anyDown(down, keymap.moveRight, MOVE_RIGHT_ALIASES) ? 1 : 0;
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
