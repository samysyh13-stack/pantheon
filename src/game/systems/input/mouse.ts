// Mouse tracker. Produces an aim vector (-1..1) computed from the cursor's
// pixel position relative to the character's on-screen position, which the
// manager injects per tick via `setAimReferencePoint`. Buttons are forwarded
// to the keyboard tracker's depressed-set so a single keymap lookup covers
// mouse bindings (e.g., "Mouse0" = basic attack).

import { clamp, normalize2, vec2Length } from '../../../utils/math';
import type { KeyboardTracker } from './keyboard';

export interface MouseAim {
  aimX: number;
  aimY: number;
  aimMagnitude: number;
  hasPointer: boolean;
}

export interface MouseTracker {
  snapshot(): MouseAim;
  setAimReferencePoint(x: number, y: number): void;
  getRawPosition(): { x: number; y: number } | null;
  dispose(): void;
}

interface Options {
  keyboard: KeyboardTracker;
  target?: Window | HTMLElement;
  // Distance (in px) at which aim magnitude saturates to 1. Below this the
  // normalized magnitude eases from 0 to 1 so gentle mouse movement doesn't
  // snap the character's aim. 160 px ≈ the thumb-reach radius on a laptop.
  saturationRadius?: number;
}

export function createMouseTracker(options: Options): MouseTracker {
  const { keyboard, target = window, saturationRadius = 160 } = options;
  let posX: number | null = null;
  let posY: number | null = null;
  let refX = 0;
  let refY = 0;

  const onMove = (e: MouseEvent) => {
    posX = e.clientX;
    posY = e.clientY;
  };
  const onDown = (e: MouseEvent) => {
    keyboard.setMouseButton(e.button, true);
  };
  const onUp = (e: MouseEvent) => {
    keyboard.setMouseButton(e.button, false);
  };
  const onContextMenu = (e: Event) => {
    // RMB is our `ability` default — suppress the native context menu so the
    // game actually receives the button press.
    e.preventDefault();
  };
  const onBlur = () => {
    keyboard.setMouseButton(0, false);
    keyboard.setMouseButton(1, false);
    keyboard.setMouseButton(2, false);
  };

  const t = target as EventTarget;
  t.addEventListener('mousemove', onMove as EventListener);
  t.addEventListener('mousedown', onDown as EventListener);
  t.addEventListener('mouseup', onUp as EventListener);
  t.addEventListener('contextmenu', onContextMenu);
  t.addEventListener('blur', onBlur);

  return {
    snapshot: () => {
      if (posX === null || posY === null) {
        return { aimX: 0, aimY: 0, aimMagnitude: 0, hasPointer: false };
      }
      const dx = posX - refX;
      // Flip y so "mouse above the character" = +y aim, matching the
      // keyboard convention in keyboard.ts.
      const dy = -(posY - refY);
      const len = vec2Length(dx, dy);
      const [nx, ny] = normalize2(dx, dy);
      const magnitude = clamp(len / saturationRadius, 0, 1);
      return {
        aimX: nx,
        aimY: ny,
        aimMagnitude: magnitude,
        hasPointer: true,
      };
    },
    setAimReferencePoint: (x, y) => {
      refX = x;
      refY = y;
    },
    getRawPosition: () => (posX === null || posY === null ? null : { x: posX, y: posY }),
    dispose: () => {
      t.removeEventListener('mousemove', onMove as EventListener);
      t.removeEventListener('mousedown', onDown as EventListener);
      t.removeEventListener('mouseup', onUp as EventListener);
      t.removeEventListener('contextmenu', onContextMenu);
      t.removeEventListener('blur', onBlur);
    },
  };
}
