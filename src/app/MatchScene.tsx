// Match scene — orchestrator integration point assembling T-004 (character +
// camera), T-001 (input manager), and orchestrator-authored Sacred Grove
// arena blockout into a single R3F subtree. Mounted as a child of
// <GameCanvas> by App.tsx only while `match.screen === 'match'`.
//
// Lifecycle:
//   - Creates the InputManager on mount; disposes on unmount so the
//     rAF loop doesn't leak between match sessions.
//   - Forwards the manager as the InputSource into Anansi (it already
//     satisfies the `{ snapshot(playerIndex): InputFrame }` contract).
//   - Wires a TrackingCamera onto the Anansi handle's `getWorldPosition()`.
//
// Deferred to Phase 2:
//   - Multi-player local co-op (2nd Anansi with playerIndex: 1)
//   - Match state machine (score, timers, pickups, breakables)
//   - Bot AI spawning opponent character

import { useEffect, useRef, useState } from 'react';

import { Anansi } from '../game/gods/anansi/Anansi';
import { SacredGrove, SPAWN_POINTS } from '../game/arenas/sacredGrove';
import { TrackingCamera } from '../game/entities/character/Camera';
import type { CharacterHandle } from '../game/entities/character/Character';
import {
  create as createInputManager,
  type InputManager,
} from '../game/systems/input/manager';

export function MatchScene() {
  const handleRef = useRef<CharacterHandle | null>(null);
  // useState + effect rather than useMemo: React 19 Strict Mode double-
  // invokes useMemo callbacks, but effect cleanups handle it correctly.
  // The rAF loop in the manager is side-effectful and must only run once.
  const [inputMgr, setInputMgr] = useState<InputManager | null>(null);

  useEffect(() => {
    const mgr = createInputManager({ playerCount: 1 });
    setInputMgr(mgr);
    return () => {
      mgr.dispose();
    };
  }, []);

  if (!inputMgr) return null;

  return (
    <>
      <SacredGrove />
      <Anansi
        position={[SPAWN_POINTS.p0.x, SPAWN_POINTS.p0.y, SPAWN_POINTS.p0.z]}
        playerIndex={0}
        inputSource={inputMgr}
        onHandleReady={(h) => {
          handleRef.current = h;
        }}
      />
      <TrackingCamera target={handleRef} />
    </>
  );
}
