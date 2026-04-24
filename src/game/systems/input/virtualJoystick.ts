// Thumb-dock virtual joystick state machine. Dock position = the screen-space
// location of the first touch inside the joystick's half of the screen. The
// thumb is then constrained to a radius around the dock; the normalized delta
// (clamped to unit-length) is the stick's output.

import { clamp, normalize2, vec2Length } from '../../../utils/math';

export interface JoystickVector {
  x: number;
  y: number;
  magnitude: number;
}

// Snapshot of the rendered joystick UI — the HUD React component consumes
// this via `touch.ts` to draw the base + thumb.
export interface JoystickState extends JoystickVector {
  active: boolean;
  dockX: number;
  dockY: number;
  thumbX: number;
  thumbY: number;
  radius: number;
}

const EMPTY_STATE: JoystickState = {
  x: 0,
  y: 0,
  magnitude: 0,
  active: false,
  dockX: 0,
  dockY: 0,
  thumbX: 0,
  thumbY: 0,
  radius: 0,
};

export function emptyJoystickState(): JoystickState {
  // Caller gets a fresh mutable copy; the constant above is the reset template.
  return { ...EMPTY_STATE };
}

export interface VirtualJoystick {
  engage(touchId: number, x: number, y: number): void;
  move(touchId: number, x: number, y: number): void;
  release(touchId: number): void;
  readonly state: JoystickState;
  readonly activeTouchId: number | null;
  // Invert the Y axis to match the "+y = forward" gameplay convention.
  // Left/right joysticks both want it.
  readonly invertY: boolean;
}

interface Options {
  // Max distance (in CSS px) the thumb can travel from the dock before the
  // output vector saturates to magnitude 1. 60px is the default; HUD scale
  // is applied upstream by the ControlSettings.touchScale multiplier.
  radius?: number;
  invertY?: boolean;
}

export function createVirtualJoystick(options: Options = {}): VirtualJoystick {
  const radius = options.radius ?? 60;
  const invertY = options.invertY ?? true;
  const state: JoystickState = { ...EMPTY_STATE, radius };
  let activeId: number | null = null;

  const reset = () => {
    state.active = false;
    state.dockX = 0;
    state.dockY = 0;
    state.thumbX = 0;
    state.thumbY = 0;
    state.x = 0;
    state.y = 0;
    state.magnitude = 0;
    activeId = null;
  };

  const updateFromThumb = (tx: number, ty: number) => {
    const dx = tx - state.dockX;
    // Screen y grows downward; invertY flips so "drag up" = +1.
    const dy = invertY ? -(ty - state.dockY) : ty - state.dockY;
    const len = vec2Length(dx, dy);
    if (len < 1e-4) {
      state.x = 0;
      state.y = 0;
      state.magnitude = 0;
    } else {
      const [nx, ny] = normalize2(dx, dy);
      const mag = clamp(len / radius, 0, 1);
      state.x = nx * mag;
      state.y = ny * mag;
      state.magnitude = mag;
    }
    state.thumbX = tx;
    state.thumbY = ty;
  };

  return {
    engage: (touchId, x, y) => {
      if (activeId !== null) return;
      activeId = touchId;
      state.active = true;
      state.dockX = x;
      state.dockY = y;
      state.thumbX = x;
      state.thumbY = y;
      state.x = 0;
      state.y = 0;
      state.magnitude = 0;
    },
    move: (touchId, x, y) => {
      if (activeId !== touchId) return;
      updateFromThumb(x, y);
    },
    release: (touchId) => {
      if (activeId !== touchId) return;
      reset();
    },
    state,
    get activeTouchId() {
      return activeId;
    },
    invertY,
  };
}
