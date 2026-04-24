// Multi-touch tracker. Up to MAX_TOUCHES concurrent pointers are recognized;
// each is routed to the left-half move joystick or the right-half aim
// joystick based on the screen-space x of the first touchstart. A right-half
// touch that lands inside a button overlay region (bottom-right) is routed
// through a transient "button press" bus instead of the aim joystick. The
// Joystick React component subscribes via subscribe() to render the stick.

import { createVirtualJoystick, type JoystickState, emptyJoystickState } from './virtualJoystick';

export type JoystickSide = 'left' | 'right';

export interface TouchButtonState {
  basicAttack: boolean;
  ability: boolean;
  ultimate: boolean;
  dodge: boolean;
  pause: boolean;
}

export interface TouchSnapshot {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  aimMagnitude: number;
  buttons: TouchButtonState;
  active: boolean;
}

// Button region — axis-aligned rectangle in CSS pixels, anchored to a screen
// corner. Populated by the Joystick component when it lays out the overlay.
export interface ButtonRegion {
  id: keyof TouchButtonState;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface TouchTracker {
  snapshot(): TouchSnapshot;
  getJoystickState(side: JoystickSide): JoystickState;
  subscribe(side: JoystickSide, cb: (state: JoystickState) => void): () => void;
  setButtonRegions(regions: readonly ButtonRegion[]): void;
  setScreenWidth(width: number): void;
  isActive(): boolean;
  dispose(): void;
}

const MAX_TOUCHES = 3;

interface TrackedTouch {
  id: number;
  kind: 'left-joystick' | 'right-joystick' | 'button';
  buttonId?: keyof TouchButtonState;
}

function emptyButtons(): TouchButtonState {
  return {
    basicAttack: false,
    ability: false,
    ultimate: false,
    dodge: false,
    pause: false,
  };
}

function hitTestButton(
  regions: readonly ButtonRegion[],
  x: number,
  y: number,
): ButtonRegion | null {
  for (const r of regions) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return r;
  }
  return null;
}

interface Options {
  target?: Window | HTMLElement;
  // Screen width at init. Updated via setScreenWidth on orientation changes
  // or if the tracker is constructed before the DOM knows its own size.
  screenWidth?: number;
  leftJoystickRadius?: number;
  rightJoystickRadius?: number;
}

export function createTouchTracker(options: Options = {}): TouchTracker {
  const target = options.target ?? window;
  const left = createVirtualJoystick({
    radius: options.leftJoystickRadius ?? 60,
    invertY: true,
  });
  const right = createVirtualJoystick({
    radius: options.rightJoystickRadius ?? 60,
    invertY: true,
  });

  const active = new Map<number, TrackedTouch>();
  const buttons = emptyButtons();
  let buttonRegions: readonly ButtonRegion[] = [];
  let screenWidth = options.screenWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 0);
  const listeners: Record<JoystickSide, Set<(s: JoystickState) => void>> = {
    left: new Set(),
    right: new Set(),
  };

  const notify = (side: JoystickSide) => {
    const s = side === 'left' ? left.state : right.state;
    for (const cb of listeners[side]) cb(s);
  };

  const halfOf = (x: number): 'left' | 'right' =>
    x < (screenWidth > 0 ? screenWidth / 2 : 0) ? 'left' : 'right';

  const handleStart = (touchId: number, x: number, y: number) => {
    if (active.size >= MAX_TOUCHES) return;
    const half = halfOf(x);
    if (half === 'right') {
      const btn = hitTestButton(buttonRegions, x, y);
      if (btn) {
        active.set(touchId, { id: touchId, kind: 'button', buttonId: btn.id });
        buttons[btn.id] = true;
        return;
      }
      if (right.activeTouchId === null) {
        active.set(touchId, { id: touchId, kind: 'right-joystick' });
        right.engage(touchId, x, y);
        notify('right');
      }
      return;
    }
    if (left.activeTouchId === null) {
      active.set(touchId, { id: touchId, kind: 'left-joystick' });
      left.engage(touchId, x, y);
      notify('left');
    }
  };

  const handleMove = (touchId: number, x: number, y: number) => {
    const t = active.get(touchId);
    if (!t) return;
    if (t.kind === 'left-joystick') {
      left.move(touchId, x, y);
      notify('left');
    } else if (t.kind === 'right-joystick') {
      right.move(touchId, x, y);
      notify('right');
    }
    // Button presses don't track drag — lifting off the button while still in
    // region is handled at touchend, which matches expected mobile-game feel.
  };

  const handleEnd = (touchId: number) => {
    const t = active.get(touchId);
    if (!t) return;
    if (t.kind === 'left-joystick') {
      left.release(touchId);
      notify('left');
    } else if (t.kind === 'right-joystick') {
      right.release(touchId);
      notify('right');
    } else if (t.kind === 'button' && t.buttonId) {
      buttons[t.buttonId] = false;
    }
    active.delete(touchId);
  };

  const onTouchStart = (e: TouchEvent) => {
    for (const touch of Array.from(e.changedTouches)) {
      handleStart(touch.identifier, touch.clientX, touch.clientY);
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    for (const touch of Array.from(e.changedTouches)) {
      handleMove(touch.identifier, touch.clientX, touch.clientY);
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    for (const touch of Array.from(e.changedTouches)) {
      handleEnd(touch.identifier);
    }
  };

  // Pointer fallback for browsers that prefer PointerEvents (Surface, some
  // Chromium touch modes). Filters to pointerType === 'touch' so mouse doesn't
  // bleed in — mouse is handled by mouse.ts.
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    handleStart(e.pointerId, e.clientX, e.clientY);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    handleMove(e.pointerId, e.clientX, e.clientY);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    handleEnd(e.pointerId);
  };

  const onResize = () => {
    if (typeof window !== 'undefined') screenWidth = window.innerWidth;
  };

  const t = target as EventTarget;
  t.addEventListener('touchstart', onTouchStart as EventListener, { passive: true });
  t.addEventListener('touchmove', onTouchMove as EventListener, { passive: true });
  t.addEventListener('touchend', onTouchEnd as EventListener);
  t.addEventListener('touchcancel', onTouchEnd as EventListener);
  t.addEventListener('pointerdown', onPointerDown as EventListener, { passive: true });
  t.addEventListener('pointermove', onPointerMove as EventListener, { passive: true });
  t.addEventListener('pointerup', onPointerUp as EventListener);
  t.addEventListener('pointercancel', onPointerUp as EventListener);
  if (typeof window !== 'undefined' && target === window) {
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
  }

  return {
    snapshot: () => ({
      moveX: left.state.x,
      moveY: left.state.y,
      aimX: right.state.x,
      aimY: right.state.y,
      aimMagnitude: right.state.magnitude,
      buttons: { ...buttons },
      active: active.size > 0 || left.state.active || right.state.active,
    }),
    getJoystickState: (side) => (side === 'left' ? left.state : right.state),
    subscribe: (side, cb) => {
      listeners[side].add(cb);
      // Emit the current state on subscribe so the UI matches the model.
      cb(side === 'left' ? left.state : right.state);
      return () => {
        listeners[side].delete(cb);
      };
    },
    setButtonRegions: (regions) => {
      buttonRegions = regions;
    },
    setScreenWidth: (width) => {
      screenWidth = width;
    },
    isActive: () => active.size > 0,
    dispose: () => {
      t.removeEventListener('touchstart', onTouchStart as EventListener);
      t.removeEventListener('touchmove', onTouchMove as EventListener);
      t.removeEventListener('touchend', onTouchEnd as EventListener);
      t.removeEventListener('touchcancel', onTouchEnd as EventListener);
      t.removeEventListener('pointerdown', onPointerDown as EventListener);
      t.removeEventListener('pointermove', onPointerMove as EventListener);
      t.removeEventListener('pointerup', onPointerUp as EventListener);
      t.removeEventListener('pointercancel', onPointerUp as EventListener);
      if (typeof window !== 'undefined' && target === window) {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
      }
      active.clear();
      listeners.left.clear();
      listeners.right.clear();
      // Reset joystick state so late subscribers get a clean slate.
      const l = left.state;
      const r = right.state;
      Object.assign(l, emptyJoystickState());
      Object.assign(r, emptyJoystickState());
    },
  };
}
