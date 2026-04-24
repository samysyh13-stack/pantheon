// Character R3F component (T-004 AE).
//
// Wraps a kinematic rigid body with a capsule collider, binds an input
// source (the real InputManager or a mocked one) to the controller, and
// mirrors derived state into the animation FSM each frame. Exposes an
// imperative ref API for the Phase 2 combat layer (`applyHit` / `kill`)
// and for HUD + camera consumers (`getState` / `getWorldPosition`).
//
// The contract on `inputSource` is deliberately narrow: just a
// `{ snapshot(playerIndex): InputFrame }` object. This is the exact shape
// of the InputManager's public API (see /src/game/systems/input/manager.ts)
// so the orchestrator can pass the real manager without any adapter, and
// tests / the Demo scene can pass an in-memory stub.
//
// Why a ref API rather than a store subscription for hit / kill?
//   - ADR-0006 determinism: combat runs inside the 60 Hz sim tick. Ref
//     calls are synchronous and avoid the React render frame.
//   - Per-entity granularity: the match may have up to 4 characters; a
//     single store subscription pattern would need explicit ids. Refs
//     let the caller keep a map of `playerIndex -> ref`.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import type { Mesh } from 'three';
import { Vector3 } from 'three';

import { damp } from '../../../utils/math';

import type { CharacterState, CharacterStats } from './types';
import { createCharacterController, type CharacterController } from './controller';
import { createAnimationFSM, type AnimationFSM } from './animationFSM';
import { ToonMaterial } from '../../../rendering/materials';
import type { InputFrame, PlayerIndex } from '../../systems/input';

/** Capsule dimensions — DESIGN §4 "slightly heroic proportions". */
const CAPSULE_RADIUS = 0.4;
/** Half the cylinder-section height (total capsule height = 2*(halfHeight+radius) = 2.6 m). */
const CAPSULE_HALF_HEIGHT = 0.9;

/**
 * Object exposed by the input manager's public API. Narrowly typed here
 * instead of importing the full `InputManager` type so mocks / tests
 * only need to satisfy the snapshot method. Matches the `snapshot`
 * method in /src/game/systems/input/manager.ts.
 */
export interface InputSource {
  snapshot(playerIndex: PlayerIndex): InputFrame;
}

/**
 * Imperative handle attached to the character's ref. Callers drive
 * combat (`applyHit`, `kill`) and read observable state (`getState`,
 * `getWorldPosition`).
 */
export interface CharacterHandle {
  /** Current animation FSM state. Pure read. */
  getState(): CharacterState;
  /** World-space position as a Vector3 snapshot. Not a live view. */
  getWorldPosition(): Vector3;
  /**
   * Apply incoming damage. In T-004 this only drives the FSM into `hit`;
   * HP math and hit-confirm stack integration (DESIGN §8) is Phase 2 /
   * T-100 scope. `dmg` is the amount that *would* be applied; we thread
   * it here so the Phase 2 extension point has the signature it needs.
   * Returns `true` if the hit landed (i.e., not invulnerable); `false`
   * if the dodge i-frames ate it.
   */
  applyHit(dmg: number): boolean;
  /** Terminal — transitions the FSM to `dead` and halts controller input. */
  kill(): void;
  /** For camera / HUD: true during dodge i-frames. */
  isInvulnerable(): boolean;
}

export interface CharacterProps {
  stats: CharacterStats;
  position: [number, number, number];
  playerIndex: PlayerIndex;
  inputSource: InputSource;
  /**
   * Optional color tint for the ToonMaterial's base color. Each god
   * passes its signature color here (Anansi gold, Brigid ember, Susanoo
   * storm cyan). Default is a neutral warm gray.
   */
  color?: string;
  /**
   * Optional rim light color. Defaults to white.
   */
  rimColor?: string;
  /** Deterministic RNG seed threaded into the controller (Phase 2 feature hook). */
  seed?: number;
  /**
   * Optional imperative-handle callback. The orchestrator passes a
   * ref-set callback here to receive the CharacterHandle once the rigid
   * body is ready. We use a callback instead of forwardRef so the
   * component stays simple and we don't fight React 19's ref-as-prop
   * semantics.
   */
  onHandleReady?: (handle: CharacterHandle) => void;
}

// Scratch objects reused per-frame to keep GC quiet.
const SCRATCH_POS = new Vector3();

export function Character(props: CharacterProps) {
  const {
    stats,
    position,
    playerIndex,
    inputSource,
    color = '#c9a27a',
    rimColor = '#ffffff',
    seed = 1,
    onHandleReady,
  } = props;

  const rbRef = useRef<RapierRigidBody | null>(null);
  const meshRef = useRef<Mesh | null>(null);
  const { world } = useRapier();
  const { camera } = useThree();

  // Rotation damping: keeps the character turning smoothly rather than snapping
  // when the aim stick flicks. Critically-damped lambda = 12 converges in ~350 ms.
  const AIM_TURN_LAMBDA = 12;

  // Animation FSM lives in a ref so it's not re-created on re-render.
  // The controller is constructed lazily (see effect below) because it
  // needs the rigid body + collider, which only exist after Rapier has
  // spawned the body on the world.
  const fsmRef = useRef<AnimationFSM>(createAnimationFSM());
  const controllerRef = useRef<CharacterController | null>(null);
  const deadRef = useRef<boolean>(false);

  // Set the mouse aim reference point on the input source (if it
  // supports it) so aim is computed relative to the character's screen
  // position rather than the window origin. Done inside useFrame because
  // the projected point moves every frame.
  //
  // We feature-detect setAimReferencePoint so the test mock doesn't need
  // to implement it. In production the real manager does.
  const hasAimRef = useMemo(
    () => 'setAimReferencePoint' in (inputSource as object),
    [inputSource],
  );

  // Construct the controller once the rigid body settles. We do this
  // inside useEffect after-mount so rbRef.current is populated. The
  // collider comes from `rigidBody.collider(0)` — the first (and only)
  // collider attached to the capsule RigidBody.
  useEffect(() => {
    const rb = rbRef.current;
    if (!rb) return;
    if (rb.numColliders() === 0) return;
    const collider = rb.collider(0);
    const ctrl = createCharacterController({
      world,
      rigidBody: rb,
      collider,
      config: { stats, seed },
    });
    controllerRef.current = ctrl;

    // Construct and publish the imperative handle once the controller
    // exists. Doing this inside the same effect guarantees the handle
    // cannot be called before the controller is ready.
    const handle: CharacterHandle = {
      getState: () => fsmRef.current.current,
      getWorldPosition: () => {
        if (!rb) return SCRATCH_POS.clone().set(0, 0, 0);
        const t = rb.translation();
        return new Vector3(t.x, t.y, t.z);
      },
      applyHit: (_dmg: number) => {
        if (deadRef.current) return false;
        if (ctrl.isInvulnerable()) return false;
        fsmRef.current.transition('hit');
        return true;
      },
      kill: () => {
        deadRef.current = true;
        fsmRef.current.transition('dead');
      },
      isInvulnerable: () => ctrl.isInvulnerable(),
    };
    onHandleReady?.(handle);

    return () => {
      ctrl.dispose();
      controllerRef.current = null;
    };
    // Intentional: stats / seed changes do not rebuild the controller
    // mid-match (stats are design-time constants). We only rebuild if
    // the Rapier world reference changes (practically never).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  useFrame((_state, dtSeconds) => {
    const ctrl = controllerRef.current;
    const fsm = fsmRef.current;
    const rb = rbRef.current;
    if (!ctrl || !rb) return;
    if (deadRef.current) {
      // Dead: advance the FSM timer (for any death-anim budgeting) but
      // do not sample input or move.
      fsm.tick(dtSeconds);
      return;
    }

    // Sample the latest input frame. The manager samples on rAF; we
    // pull on each render tick. The cost is ~one object copy per frame,
    // small vs the layout/physics work.
    const input: InputFrame = inputSource.snapshot(playerIndex);

    // Update the aim reference point — the manager uses this to compute
    // mouse aim relative to the character's screen position. Project
    // the character's world origin through the camera matrix.
    if (hasAimRef) {
      const t = rb.translation();
      SCRATCH_POS.set(t.x, t.y, t.z).project(camera);
      const screenX = (SCRATCH_POS.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (SCRATCH_POS.y * -0.5 + 0.5) * window.innerHeight;
      (
        inputSource as unknown as {
          setAimReferencePoint: (pi: PlayerIndex, x: number, y: number) => void;
        }
      ).setAimReferencePoint(playerIndex, screenX, screenY);
    }

    // Drive the controller — this computes the per-tick displacement
    // and applies it via setNextKinematicTranslation.
    ctrl.update(input, dtSeconds);

    // Aim-driven visual rotation (Fix 1). Rotate the mesh (not the RigidBody,
    // whose rotations are locked for physics stability) to face the aim
    // vector in world space. Stick coords map to world as:
    //   aimX (stick right) → world +X
    //   aimY (stick up)    → world -Z   (camera looks down +Z)
    // Default mesh forward is -Z, so rotation.y = atan2(aimX, aimY) gives
    // the correct yaw. Critically-damped so the mesh turns smoothly
    // rather than snapping when the aim joystick flicks.
    const mesh = meshRef.current;
    if (mesh && input.aimMagnitude > 0) {
      const targetYaw = Math.atan2(input.aimX, input.aimY);
      // Shortest-arc wrap: keep the delta in [-π, π] so we don't spin
      // the long way around when crossing the ±π branch cut.
      let current = mesh.rotation.y;
      const twoPi = Math.PI * 2;
      let delta = ((targetYaw - current) % twoPi + twoPi) % twoPi;
      if (delta > Math.PI) delta -= twoPi;
      current = damp(current, current + delta, AIM_TURN_LAMBDA, dtSeconds);
      mesh.rotation.y = current;
    }

    // Mirror controller-derived edges into the FSM. Order matters:
    //   1) dead is already short-circuited above, so skip here.
    //   2) dodge edge takes precedence over attack edge — the FSM
    //      allows dodge-cancel but not the reverse.
    //   3) velocity-based idle <-> running is evaluated last so it
    //      can't stomp an attacking / dodging state.
    if (ctrl.consumeDodgeEdge()) {
      fsm.transition('dodging');
    }
    if (ctrl.consumeBasicAttackEdge()) {
      fsm.transition('attacking');
    }

    // Idle/running velocity threshold. 0.1 m/s is below typical walk
    // speed (5 m/s) but above numerical drift — keeps the state from
    // flickering between idle and running when the character is
    // decelerating.
    const speed = ctrl.getPlanarSpeed();
    const currentState = fsm.current;
    if (currentState === 'idle' && speed > 0.1) {
      fsm.transition('running');
    } else if (currentState === 'running' && speed <= 0.1) {
      fsm.transition('idle');
    }

    // Advance the FSM time budget — auto-transitions (attack -> idle,
    // dodge -> idle, hit -> idle) fire here.
    fsm.tick(dtSeconds);
  });

  return (
    <RigidBody
      ref={rbRef}
      type="kinematicPosition"
      position={position}
      colliders={false}
      canSleep={false}
      enabledRotations={[false, false, false]}
    >
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} friction={0.2} />
      <mesh ref={meshRef} castShadow receiveShadow>
        <capsuleGeometry
          args={[CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT * 2, 8, 16]}
        />
        <ToonMaterial color={color} rimColor={rimColor} rimIntensity={0.7} />
        {/* Forward indicator — a small gold cone at the front of the capsule
           so the player can see which way they're facing during Phase 1
           testing. Phase 2 replaces the capsule with a rigged mesh and the
           indicator goes away. */}
        <mesh position={[0, 0.4, -CAPSULE_RADIUS - 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.1, 0.2, 8]} />
          <meshStandardMaterial color={rimColor ?? '#ffd48a'} emissive={rimColor ?? '#ffd48a'} emissiveIntensity={0.3} />
        </mesh>
      </mesh>
    </RigidBody>
  );
}
