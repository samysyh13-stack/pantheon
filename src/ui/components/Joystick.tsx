// Virtual joystick renderer. The tracker in /src/game/systems/input/touch.ts
// owns all state; this component subscribes via a hook and draws the base
// and thumb into the anchor slots on the HUD. Touch/pointer events are
// already captured window-wide by touch.ts — the DOM here is purely visual,
// with `pointer-events: auto` on the base so the browser doesn't swallow the
// first tap as a scroll/selection gesture before our window listener sees it.

import { useEffect, useRef, useState } from 'react';
import {
  emptyJoystickState,
  type JoystickSide,
  type JoystickState,
  type TouchTracker,
} from '../../game/systems/input';
import { useAppStore } from '../../state/store';

export function useJoystickState(tracker: TouchTracker | null, side: JoystickSide): JoystickState {
  const [state, setState] = useState<JoystickState>(emptyJoystickState);
  useEffect(() => {
    if (!tracker) return;
    const unsub = tracker.subscribe(side, (s) => setState({ ...s }));
    return unsub;
  }, [tracker, side]);
  return state;
}

interface Props {
  tracker: TouchTracker | null;
  side: JoystickSide;
  // Radius of the visible base ring in CSS pixels. Defaults to 72 (the base
  // is visually 2x the stick's thumb-travel radius so the thumb sits inside).
  baseRadius?: number;
  thumbRadius?: number;
  // When falsy, the component renders nothing — used to hide the joystick on
  // desktop where mouse/keyboard are primary. Controlled by the manager.
  visible?: boolean;
}

export function Joystick({
  tracker,
  side,
  baseRadius = 72,
  thumbRadius = 34,
  visible = true,
}: Props) {
  const anchorRef = useRef<HTMLElement | null>(null);
  const state = useJoystickState(tracker, side);
  const touchScale = useAppStore((s) => s.settings.controls.touchScale);
  const touchOpacity = useAppStore((s) => s.settings.controls.touchOpacity);

  useEffect(() => {
    // HUD.tsx already renders `<div id="joystick-left" />` and `joystick-right`
    // as positional anchors. We append into those DOM nodes rather than
    // restructuring the HUD.
    anchorRef.current = document.getElementById(
      side === 'left' ? 'joystick-left' : 'joystick-right',
    );
  }, [side]);

  if (!visible) return null;

  const anchor = anchorRef.current;
  if (!anchor) return null;

  // When the stick is inactive, dock at the anchor center so the idle base
  // visual has a stable position. When active, dock moves to first-touch.
  const anchorRect = anchor.getBoundingClientRect();
  const centerX = anchorRect.left + anchorRect.width / 2;
  const centerY = anchorRect.top + anchorRect.height / 2;
  const dockX = state.active ? state.dockX : centerX;
  const dockY = state.active ? state.dockY : centerY;
  const thumbOffsetX = state.active ? state.thumbX - dockX : 0;
  // `state.thumbY` is the raw screen y; dockY is also screen y. No invert
  // needed for visual — the vector math in virtualJoystick.ts handles the
  // sign flip for gameplay.
  const thumbOffsetY = state.active ? state.thumbY - dockY : 0;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        opacity: touchOpacity,
        transform: `scale(${touchScale})`,
        transformOrigin: `${dockX}px ${dockY}px`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: dockX - baseRadius,
          top: dockY - baseRadius,
          width: baseRadius * 2,
          height: baseRadius * 2,
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.25)',
          background: 'rgba(15,18,24,0.35)',
          pointerEvents: 'auto',
          transition: state.active ? 'none' : 'opacity 120ms ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: dockX - thumbRadius + thumbOffsetX,
          top: dockY - thumbRadius + thumbOffsetY,
          width: thumbRadius * 2,
          height: thumbRadius * 2,
          borderRadius: '50%',
          background:
            side === 'left'
              ? 'rgba(212,162,74,0.75)'
              : 'rgba(46,159,181,0.75)',
          border: '2px solid rgba(255,255,255,0.55)',
          pointerEvents: 'none',
          transition: state.active ? 'none' : 'left 120ms ease, top 120ms ease',
        }}
      />
    </div>
  );
}
