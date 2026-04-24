// Standalone demo scene (T-004 AE).
//
// A minimal R3F subtree that renders:
//   - A ground plane + subtle directional light (for shadow grounding).
//   - One Character driven by the real InputManager (`src/game/systems/input`).
//   - A tracking camera that follows the character.
//
// This is what the orchestrator will swap into Canvas.tsx's <DemoScene>
// slot (Canvas.tsx is off-limits to this task per the brief). The
// barrel `src/game/entities/character/index.ts` re-exports `CharacterDemo`.
//
// NOTE: This component must be mounted inside an R3F <Canvas> AND inside
// a @react-three/rapier <Physics> provider. The orchestrator is
// responsible for adding the <Physics> wrapper when integrating — the
// Canvas.tsx edit is orchestrator scope.

import { useEffect, useRef, useState } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';

import { Character, type CharacterHandle, type InputSource } from './Character';
import { TrackingCamera } from './Camera';
import type { CharacterStats } from './types';
import { create as createInputManager, type InputManager } from '../../systems/input/manager';

/** Default Anansi stats for the demo. Mirrors the Anansi wrapper. */
const DEMO_STATS: CharacterStats = {
  maxHp: 320,
  moveSpeed: 5,
  dashSpeed: 12,
  dashDurationMs: 300,
  dashCooldownMs: 3000,
};

/**
 * Demo scene. Spawns an input manager for 1 player and a single
 * character on top of a ground plane. Cleans up the manager on unmount.
 */
export function CharacterDemo() {
  const handleRef = useRef<CharacterHandle | null>(null);
  // Manager is created on mount and disposed on unmount. useState (not
  // useMemo) is the safest idiom — useMemo's callback may fire twice
  // in React 19 Strict Mode, and the manager's rAF loop is side-effectful.
  const [inputMgr, setInputMgr] = useState<InputManager | null>(null);

  useEffect(() => {
    const mgr = createInputManager({ playerCount: 1 });
    setInputMgr(mgr);
    return () => {
      mgr.dispose();
    };
  }, []);

  if (!inputMgr) return null;

  const source: InputSource = inputMgr;

  return (
    <>
      {/* Ground plane. A thin cuboid collider 40 m x 40 m x 0.2 m, matching
          the Sacred Grove diameter in DESIGN §7. The arena proper will
          replace this in T-104 / orchestrator integration. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[20, 0.1, 20]} position={[0, -0.1, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#3a4a4e" roughness={1} />
        </mesh>
      </RigidBody>

      {/* Single character. The onHandleReady callback stashes the ref
          for the tracking camera to read. */}
      <Character
        stats={DEMO_STATS}
        position={[0, 1.5, 0]}
        playerIndex={0}
        inputSource={source}
        color="#d4a24a"
        rimColor="#ffd48a"
        seed={1}
        onHandleReady={(h) => {
          handleRef.current = h;
        }}
      />

      <TrackingCamera target={handleRef} />
    </>
  );
}
