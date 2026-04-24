// Gamepad API polling + hot-plug. `pollAll()` is called by the manager each
// frame because browsers provide no native gamepad event stream — only
// connect/disconnect and the snapshot you pull via `navigator.getGamepads()`.

import { deadzone, normalize2, vec2Length } from '../../../utils/math';
import type { InputAction } from './types';
import { DEFAULT_GAMEPAD, DEFAULT_STICK_DEADZONE, GAMEPAD_AXIS } from './defaults';

export interface GamepadSnapshot {
  index: number;
  id: string;
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
}

export interface GamepadTracker {
  pollAll(
    keymap?: Readonly<Record<InputAction, number>>,
    deadzoneRadius?: number,
  ): GamepadSnapshot[];
  dispose(): void;
  connectedIndices(): readonly number[];
}

function isButtonDown(gp: Gamepad, index: number): boolean {
  const b = gp.buttons[index];
  return b !== undefined && b.pressed;
}

function readStick(
  gp: Gamepad,
  xAxis: number,
  yAxis: number,
  dz: number,
): { x: number; y: number; magnitude: number } {
  const rawX = gp.axes[xAxis] ?? 0;
  // Browsers report stick-up as a negative axis value; invert so +y = up.
  const rawY = -(gp.axes[yAxis] ?? 0);
  const magnitude = vec2Length(rawX, rawY);
  if (magnitude < dz) return { x: 0, y: 0, magnitude: 0 };
  // Apply radial deadzone to the magnitude, keep direction from the raw vector.
  const scaled = deadzone(magnitude, dz);
  const [nx, ny] = normalize2(rawX, rawY);
  return { x: nx * scaled, y: ny * scaled, magnitude: scaled };
}

export function createGamepadTracker(): GamepadTracker {
  // Tracked set of connected gamepad indices. The browser-supplied array from
  // `getGamepads()` has sparse null slots as controllers come and go.
  const connected = new Set<number>();

  const onConnect = (e: GamepadEvent) => {
    connected.add(e.gamepad.index);
  };
  const onDisconnect = (e: GamepadEvent) => {
    connected.delete(e.gamepad.index);
  };

  window.addEventListener('gamepadconnected', onConnect);
  window.addEventListener('gamepaddisconnected', onDisconnect);

  // Seed on construction in case controllers were already connected before
  // the page loaded. `getGamepads()` is only defined in browser environments;
  // tests in happy-dom hit the optional-chain fallback.
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const initial = nav?.getGamepads?.() ?? [];
  for (const gp of initial) {
    if (gp) connected.add(gp.index);
  }

  return {
    pollAll: (keymap = DEFAULT_GAMEPAD, dz = DEFAULT_STICK_DEADZONE) => {
      const snapshots: GamepadSnapshot[] = [];
      const pads = nav?.getGamepads?.() ?? [];
      for (const gp of pads) {
        if (!gp || !gp.connected) continue;
        const move = readStick(gp, GAMEPAD_AXIS.leftX, GAMEPAD_AXIS.leftY, dz);
        const aim = readStick(gp, GAMEPAD_AXIS.rightX, GAMEPAD_AXIS.rightY, dz);
        snapshots.push({
          index: gp.index,
          id: gp.id,
          moveX: move.x,
          moveY: move.y,
          aimX: aim.x,
          aimY: aim.y,
          aimMagnitude: aim.magnitude,
          basicAttack: isButtonDown(gp, keymap.basicAttack),
          ability: isButtonDown(gp, keymap.ability),
          ultimate: isButtonDown(gp, keymap.ultimate),
          dodge: isButtonDown(gp, keymap.dodge),
          pause: isButtonDown(gp, keymap.pause),
        });
      }
      return snapshots;
    },
    connectedIndices: () => Array.from(connected),
    dispose: () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      connected.clear();
    },
  };
}
