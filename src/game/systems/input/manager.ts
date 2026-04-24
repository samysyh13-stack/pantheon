// Central InputManager. Samples keyboard, mouse, gamepad, and touch each
// frame (rAF-driven), merges them into per-player InputFrames, and exposes
// both a push API (subscribe) and a pull API (snapshot) so the deterministic
// 60Hz simulation can read on demand without waiting on the render frame.
//
// Determinism note (ADR-0006): the manager captures input per-render-frame
// but simulation reads `snapshot(playerIndex)` during its fixed-tick loop.
// No Math.random() or wall-clock sampling happens here — wall time is only
// used to throttle gamepad polling, and it never leaks into InputFrame.

import { useAppStore, type ControlSettings } from '../../../state/store';
import { createEmptyFrame, type InputFrame, type InputSource, type PlayerIndex } from './types';
import { createKeyboardTracker, type KeyboardTracker } from './keyboard';
import { createMouseTracker, type MouseTracker } from './mouse';
import { createGamepadTracker, type GamepadTracker, type GamepadSnapshot } from './gamepad';
import { createTouchTracker, type TouchTracker } from './touch';
import { DEFAULT_GAMEPAD, DEFAULT_KEYBOARD } from './defaults';

export type PlayerCount = 1 | 2 | 3 | 4;

export interface InputManager {
  subscribe(playerIndex: PlayerIndex, callback: (frame: InputFrame) => void): () => void;
  snapshot(playerIndex: PlayerIndex): InputFrame;
  setAimReferencePoint(playerIndex: PlayerIndex, x: number, y: number): void;
  touch: TouchTracker;
  dispose(): void;
}

export interface CreateOptions {
  playerCount: PlayerCount;
  // Injection points for testing — default to the real trackers in production.
  keyboard?: KeyboardTracker;
  mouse?: MouseTracker;
  gamepad?: GamepadTracker;
  touch?: TouchTracker;
  // rAF injection for tests / SSR. Production uses window.requestAnimationFrame.
  requestFrame?: (cb: () => void) => number;
  cancelFrame?: (id: number) => void;
}

interface PlayerSource {
  kind: 'keyboard+mouse' | 'gamepad' | 'touch';
  gamepadIndex?: number;
  aimRefX: number;
  aimRefY: number;
}

function resolvePlayerSources(count: PlayerCount, gamepads: readonly number[]): PlayerSource[] {
  // Assignment rules (from brief): keyboard+mouse -> P0, gamepad 0 -> P1,
  // gamepad 1 -> P2, touch -> wherever unclaimed. Solo (count=1) — player 0
  // receives all sources merged.
  const sources: PlayerSource[] = [];
  if (count === 1) {
    sources.push({ kind: 'keyboard+mouse', aimRefX: 0, aimRefY: 0 });
    return sources;
  }
  sources.push({ kind: 'keyboard+mouse', aimRefX: 0, aimRefY: 0 });
  for (let i = 1; i < count; i++) {
    const gpIndex = gamepads[i - 1];
    if (gpIndex !== undefined) {
      sources.push({ kind: 'gamepad', gamepadIndex: gpIndex, aimRefX: 0, aimRefY: 0 });
    } else {
      sources.push({ kind: 'touch', aimRefX: 0, aimRefY: 0 });
    }
  }
  return sources;
}

function mergeSoloFrame(
  playerIndex: PlayerIndex,
  controls: ControlSettings,
  keyboard: KeyboardTracker,
  mouse: MouseTracker,
  gamepads: readonly GamepadSnapshot[],
  touch: TouchTracker,
  aimRef: { x: number; y: number },
): InputFrame {
  // Solo mode takes the highest-magnitude source per channel. The `source`
  // tag reports whichever surface last produced real input, so the HUD can
  // react (e.g., fade out the touch joysticks when a keyboard key was pressed).
  mouse.setAimReferencePoint(aimRef.x, aimRef.y);
  const kb = keyboard.snapshot(controls.keyboard);
  const mouseAim = mouse.snapshot();
  const gp = gamepads[0];
  const ts = touch.snapshot();

  let moveX = kb.moveX;
  let moveY = kb.moveY;
  let source: InputSource = 'keyboard+mouse';
  // Gamepad takes move if the stick beats the keyboard's unit-step value.
  if (gp && (Math.abs(gp.moveX) + Math.abs(gp.moveY) > Math.abs(moveX) + Math.abs(moveY))) {
    moveX = gp.moveX;
    moveY = gp.moveY;
    source = 'gamepad';
  }
  if (Math.abs(ts.moveX) + Math.abs(ts.moveY) > Math.abs(moveX) + Math.abs(moveY)) {
    moveX = ts.moveX;
    moveY = ts.moveY;
    source = 'touch';
  }

  let aimX = mouseAim.aimX;
  let aimY = mouseAim.aimY;
  let aimMagnitude = mouseAim.aimMagnitude;
  if (gp && gp.aimMagnitude > aimMagnitude) {
    aimX = gp.aimX;
    aimY = gp.aimY;
    aimMagnitude = gp.aimMagnitude;
    source = 'gamepad';
  }
  if (ts.aimMagnitude > aimMagnitude) {
    aimX = ts.aimX;
    aimY = ts.aimY;
    aimMagnitude = ts.aimMagnitude;
    source = 'touch';
  }

  return {
    moveX,
    moveY,
    aimX,
    aimY,
    aimMagnitude,
    basicAttack: kb.basicAttack || Boolean(gp?.basicAttack) || ts.buttons.basicAttack,
    ability: kb.ability || Boolean(gp?.ability) || ts.buttons.ability,
    ultimate: kb.ultimate || Boolean(gp?.ultimate) || ts.buttons.ultimate,
    dodge: kb.dodge || Boolean(gp?.dodge) || ts.buttons.dodge,
    pause: kb.pause || Boolean(gp?.pause) || ts.buttons.pause,
    source,
    playerIndex,
  };
}

function mergeAssignedFrame(
  playerIndex: PlayerIndex,
  playerSource: PlayerSource,
  controls: ControlSettings,
  keyboard: KeyboardTracker,
  mouse: MouseTracker,
  gamepads: readonly GamepadSnapshot[],
  touch: TouchTracker,
): InputFrame {
  if (playerSource.kind === 'keyboard+mouse') {
    mouse.setAimReferencePoint(playerSource.aimRefX, playerSource.aimRefY);
    const kb = keyboard.snapshot(controls.keyboard);
    const aim = mouse.snapshot();
    return {
      moveX: kb.moveX,
      moveY: kb.moveY,
      aimX: aim.aimX,
      aimY: aim.aimY,
      aimMagnitude: aim.aimMagnitude,
      basicAttack: kb.basicAttack,
      ability: kb.ability,
      ultimate: kb.ultimate,
      dodge: kb.dodge,
      pause: kb.pause,
      source: 'keyboard+mouse',
      playerIndex,
    };
  }
  if (playerSource.kind === 'gamepad') {
    const gp = gamepads.find((g) => g.index === playerSource.gamepadIndex);
    if (!gp) return createEmptyFrame(playerIndex, 'gamepad');
    return {
      moveX: gp.moveX,
      moveY: gp.moveY,
      aimX: gp.aimX,
      aimY: gp.aimY,
      aimMagnitude: gp.aimMagnitude,
      basicAttack: gp.basicAttack,
      ability: gp.ability,
      ultimate: gp.ultimate,
      dodge: gp.dodge,
      pause: gp.pause,
      source: 'gamepad',
      playerIndex,
    };
  }
  // touch
  const ts = touch.snapshot();
  return {
    moveX: ts.moveX,
    moveY: ts.moveY,
    aimX: ts.aimX,
    aimY: ts.aimY,
    aimMagnitude: ts.aimMagnitude,
    basicAttack: ts.buttons.basicAttack,
    ability: ts.buttons.ability,
    ultimate: ts.buttons.ultimate,
    dodge: ts.buttons.dodge,
    pause: ts.buttons.pause,
    source: 'touch',
    playerIndex,
  };
}

export function create(options: CreateOptions): InputManager {
  const keyboard = options.keyboard ?? createKeyboardTracker();
  const mouse = options.mouse ?? createMouseTracker({ keyboard });
  const gamepad = options.gamepad ?? createGamepadTracker();
  const touch = options.touch ?? createTouchTracker();

  const requestFrame: (cb: () => void) => number =
    options.requestFrame ??
    (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? (cb) => window.requestAnimationFrame(cb)
      : () => 0);
  const cancelFrame: (id: number) => void =
    options.cancelFrame ??
    (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
      ? (id) => window.cancelAnimationFrame(id)
      : () => {});

  const playerSources = resolvePlayerSources(options.playerCount, gamepad.connectedIndices());
  // Ensure the subscribers array has a slot per seated player even if the
  // brief asks for fewer (e.g. playerCount=2 still allows P2/P3 subscribe
  // calls to register with zero-frames).
  const subs: Array<Set<(frame: InputFrame) => void>> = [
    new Set(),
    new Set(),
    new Set(),
    new Set(),
  ];
  const latest: InputFrame[] = [
    createEmptyFrame(0),
    createEmptyFrame(1),
    createEmptyFrame(2),
    createEmptyFrame(3),
  ];
  let rafId = 0;
  let disposed = false;

  const readControls = (): ControlSettings => {
    // Store.getState() is synchronous and cheap — pull on every tick so remap
    // changes take effect immediately.
    return useAppStore.getState().settings.controls;
  };

  const resolveBindings = (controls: ControlSettings): ControlSettings => {
    // Defensive merge: if persistence ever loads an incomplete record, fall
    // back to the shipped defaults so the player can always act.
    return {
      keyboard: { ...DEFAULT_KEYBOARD, ...controls.keyboard },
      gamepad: { ...DEFAULT_GAMEPAD, ...controls.gamepad },
      touchScale: controls.touchScale,
      touchOpacity: controls.touchOpacity,
    };
  };

  const tick = () => {
    if (disposed) return;
    const controls = resolveBindings(readControls());
    const gamepads = gamepad.pollAll(controls.gamepad);

    for (let i = 0; i < options.playerCount; i++) {
      const pi = i as PlayerIndex;
      const playerSource = playerSources[i];
      let frame: InputFrame;
      if (options.playerCount === 1) {
        const src = playerSource ?? { kind: 'keyboard+mouse' as const, aimRefX: 0, aimRefY: 0 };
        frame = mergeSoloFrame(pi, controls, keyboard, mouse, gamepads, touch, {
          x: src.aimRefX,
          y: src.aimRefY,
        });
      } else if (playerSource) {
        frame = mergeAssignedFrame(
          pi,
          playerSource,
          controls,
          keyboard,
          mouse,
          gamepads,
          touch,
        );
      } else {
        frame = createEmptyFrame(pi);
      }
      latest[pi] = frame;
      for (const cb of subs[pi] ?? []) cb(frame);
    }

    rafId = requestFrame(tick);
  };
  rafId = requestFrame(tick);

  return {
    subscribe: (playerIndex, callback) => {
      const bucket = subs[playerIndex];
      if (!bucket) return () => {};
      bucket.add(callback);
      // Immediately emit the most-recent frame so subscribers don't need to
      // wait a full rAF before receiving their first state.
      const current = latest[playerIndex];
      if (current) callback(current);
      return () => {
        bucket.delete(callback);
      };
    },
    snapshot: (playerIndex) => latest[playerIndex] ?? createEmptyFrame(playerIndex),
    setAimReferencePoint: (playerIndex, x, y) => {
      const src = playerSources[playerIndex];
      if (!src) return;
      src.aimRefX = x;
      src.aimRefY = y;
      if (src.kind === 'keyboard+mouse' || options.playerCount === 1) {
        mouse.setAimReferencePoint(x, y);
      }
    },
    touch,
    dispose: () => {
      disposed = true;
      cancelFrame(rafId);
      for (const b of subs) b.clear();
      keyboard.dispose();
      mouse.dispose();
      gamepad.dispose();
      touch.dispose();
    },
  };
}
