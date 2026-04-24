// Unit coverage for the input system. Deeper simulator-level tests live with
// the sim harness when it lands; this file is the per-component contract
// check.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { deadzone } from '../../src/utils/math';
import {
  Action,
  ALL_ACTIONS,
  createEmptyFrame,
  DEFAULT_GAMEPAD,
  DEFAULT_KEYBOARD,
} from '../../src/game/systems/input';
import { createVirtualJoystick } from '../../src/game/systems/input/virtualJoystick';
import { useAppStore } from '../../src/state/store';
import type { InputAction } from '../../src/state/store';

describe('deadzone math (from utils/math)', () => {
  it('returns 0 inside the deadzone', () => {
    expect(deadzone(0, 0.2)).toBe(0);
    expect(deadzone(0.1, 0.2)).toBe(0);
    expect(deadzone(-0.19, 0.2)).toBe(0);
  });

  it('rescales values past the deadzone into [0,1]', () => {
    // At the deadzone edge, output is 0. At full travel, output is ±1.
    expect(deadzone(0.2, 0.2)).toBeCloseTo(0, 5);
    expect(deadzone(1, 0.2)).toBeCloseTo(1, 5);
    expect(deadzone(-1, 0.2)).toBeCloseTo(-1, 5);
    // Midway past the deadzone.
    expect(deadzone(0.6, 0.2)).toBeCloseTo(0.5, 5);
  });

  it('preserves sign', () => {
    expect(deadzone(-0.5, 0.2)).toBeLessThan(0);
    expect(deadzone(0.5, 0.2)).toBeGreaterThan(0);
  });
});

describe('default keymap table shape', () => {
  it('covers every Action value', () => {
    for (const action of ALL_ACTIONS) {
      expect(DEFAULT_KEYBOARD).toHaveProperty(action);
      expect(DEFAULT_GAMEPAD).toHaveProperty(action);
      expect(typeof DEFAULT_KEYBOARD[action]).toBe('string');
      expect(typeof DEFAULT_GAMEPAD[action]).toBe('number');
    }
  });

  it('ALL_ACTIONS matches the Action enum values (no drift)', () => {
    const fromEnum = Object.values(Action).sort();
    const fromList = [...ALL_ACTIONS].sort();
    expect(fromList).toEqual(fromEnum);
  });

  it('the keyboard defaults match the brief (WASD, Mouse, Space, Shift, Esc)', () => {
    expect(DEFAULT_KEYBOARD.moveUp).toBe('KeyW');
    expect(DEFAULT_KEYBOARD.moveDown).toBe('KeyS');
    expect(DEFAULT_KEYBOARD.moveLeft).toBe('KeyA');
    expect(DEFAULT_KEYBOARD.moveRight).toBe('KeyD');
    expect(DEFAULT_KEYBOARD.basicAttack).toBe('Mouse0');
    expect(DEFAULT_KEYBOARD.ability).toBe('Mouse2');
    expect(DEFAULT_KEYBOARD.ultimate).toBe('Space');
    expect(DEFAULT_KEYBOARD.dodge).toBe('ShiftLeft');
    expect(DEFAULT_KEYBOARD.pause).toBe('Escape');
  });

  it('the gamepad defaults map to the brief buttons (RT/RB/Y/LT/Start)', () => {
    expect(DEFAULT_GAMEPAD.basicAttack).toBe(7); // RT
    expect(DEFAULT_GAMEPAD.ability).toBe(5); // RB
    expect(DEFAULT_GAMEPAD.ultimate).toBe(3); // Y / Triangle
    expect(DEFAULT_GAMEPAD.dodge).toBe(6); // LT
    expect(DEFAULT_GAMEPAD.pause).toBe(9); // Start / Options
  });
});

describe('InputFrame zero default', () => {
  it('createEmptyFrame is a zero-vector with all booleans false', () => {
    const f = createEmptyFrame(0, 'keyboard+mouse');
    expect(f.moveX).toBe(0);
    expect(f.moveY).toBe(0);
    expect(f.aimX).toBe(0);
    expect(f.aimY).toBe(0);
    expect(f.aimMagnitude).toBe(0);
    expect(f.basicAttack).toBe(false);
    expect(f.ability).toBe(false);
    expect(f.ultimate).toBe(false);
    expect(f.dodge).toBe(false);
    expect(f.pause).toBe(false);
    expect(f.source).toBe('keyboard+mouse');
    expect(f.playerIndex).toBe(0);
  });

  it('propagates playerIndex and source arguments', () => {
    const f = createEmptyFrame(2, 'gamepad');
    expect(f.playerIndex).toBe(2);
    expect(f.source).toBe('gamepad');
  });
});

describe('settings.controls remap persistence roundtrip', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset the store to defaults between tests.
    useAppStore.setState((s) => ({
      settings: {
        ...s.settings,
        controls: {
          keyboard: { ...DEFAULT_KEYBOARD },
          gamepad: { ...DEFAULT_GAMEPAD },
          touchScale: 1,
          touchOpacity: 0.7,
        },
      },
    }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('setKeyboardBinding updates the store and can be read back', () => {
    const action: InputAction = 'dodge';
    useAppStore.getState().setKeyboardBinding(action, 'KeyZ');
    expect(useAppStore.getState().settings.controls.keyboard.dodge).toBe('KeyZ');
  });

  it('setGamepadBinding updates the store and can be read back', () => {
    useAppStore.getState().setGamepadBinding('ultimate', 2);
    expect(useAppStore.getState().settings.controls.gamepad.ultimate).toBe(2);
  });

  it('the persisted shape is serialisable via JSON (no cycles, no functions)', () => {
    useAppStore.getState().setKeyboardBinding('basicAttack', 'Enter');
    useAppStore.getState().setGamepadBinding('dodge', 10);
    const snapshot = useAppStore.getState().settings.controls;
    const roundTripped: unknown = JSON.parse(JSON.stringify(snapshot));
    expect(roundTripped).toEqual(snapshot);
  });

  it('setControls merges the touchScale field without clobbering keymaps', () => {
    const before = useAppStore.getState().settings.controls.keyboard.moveUp;
    useAppStore.getState().setControls({ touchScale: 1.5 });
    const after = useAppStore.getState().settings.controls;
    expect(after.touchScale).toBe(1.5);
    expect(after.keyboard.moveUp).toBe(before);
  });
});

describe('virtual joystick state machine', () => {
  it('stays empty before engage()', () => {
    const j = createVirtualJoystick();
    expect(j.state.active).toBe(false);
    expect(j.state.magnitude).toBe(0);
    expect(j.activeTouchId).toBeNull();
  });

  it('engages on first touch, tracks the thumb, and resets on release', () => {
    const j = createVirtualJoystick({ radius: 50 });
    j.engage(1, 100, 100);
    expect(j.state.active).toBe(true);
    expect(j.state.dockX).toBe(100);
    expect(j.state.dockY).toBe(100);
    expect(j.activeTouchId).toBe(1);

    // Drag 50px up (screen y decreases); with invertY=true that's +y out.
    j.move(1, 100, 50);
    expect(j.state.y).toBeCloseTo(1, 5);
    expect(j.state.x).toBeCloseTo(0, 5);
    expect(j.state.magnitude).toBeCloseTo(1, 5);

    j.release(1);
    expect(j.state.active).toBe(false);
    expect(j.state.magnitude).toBe(0);
    expect(j.activeTouchId).toBeNull();
  });

  it('ignores moves and releases from non-owning touch ids', () => {
    const j = createVirtualJoystick({ radius: 50 });
    j.engage(1, 100, 100);
    j.move(2, 200, 200);
    expect(j.state.dockX).toBe(100);
    expect(j.state.magnitude).toBe(0);
    j.release(2);
    expect(j.state.active).toBe(true);
  });

  it('saturates output magnitude at 1 past the radius', () => {
    const j = createVirtualJoystick({ radius: 50 });
    j.engage(1, 100, 100);
    j.move(1, 300, 100);
    expect(j.state.magnitude).toBeCloseTo(1, 5);
    expect(j.state.x).toBeCloseTo(1, 5);
  });
});

describe('haptic iOS fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('is a no-op when navigator.vibrate is undefined', async () => {
    const { pulse, __resetHapticForTests } = await import(
      '../../src/game/systems/input/haptic'
    );
    __resetHapticForTests();
    // happy-dom's Navigator does not expose `vibrate`; mirror iOS Safari.
    // (jsdom-style environments may — delete explicitly.)
    const navAny = navigator as unknown as { vibrate?: unknown };
    const saved = navAny.vibrate;
    try {
      delete navAny.vibrate;
      expect(pulse(25)).toBe(false);
    } finally {
      if (saved !== undefined) navAny.vibrate = saved;
    }
  });
});
