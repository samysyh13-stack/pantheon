// Character R3F component (T-004 AE, extended in T-301 with the KayKit
// Anansi placeholder mesh + animation mixer).
//
// Wraps a kinematic rigid body with a capsule collider, binds an input
// source (the real InputManager or a mocked one) to the controller, and
// mirrors derived state into the animation FSM each frame. Exposes an
// imperative ref API for the Phase 2 combat layer (`applyHit` / `kill`)
// and for HUD + camera consumers (`getState` / `getWorldPosition`).
//
// T-301 additions:
//   - Loads `/models/anansi/Anansi.glb` via drei's `useGLTF` (preloaded at
//     module scope so the first Canvas render doesn't stall on the network
//     fetch). GLB ships the KayKit Rogue skinned mesh + 76 baked animation
//     clips; see /docs/research/T-201-anansi-mesh.md for the authoring
//     story.
//   - Clones the loaded GLTF scene per-instance via
//     `SkeletonUtils.clone(scene)`. Clone is mandatory because the
//     `AnimationMixer` binds to a specific skeleton instance — two
//     Characters sharing the source scene would alias animation state.
//   - Tints every `Mesh` material's `color` to the per-god signature
//     color (gold #D4A24A for Anansi). The KayKit texture atlas is
//     near-neutral, so tint multiplication reads pure. This is cheaper
//     than swapping to a new ToonMaterial per-mesh (keeps shader variant
//     count under the 12-variant budget from ARCHITECTURE §9).
//   - Owns an `AnimationMixer` per-instance. Each FSM state transition
//     triggers a 0.2-s crossfade into the mapped clip (via
//     `CLIP_MAP` + `pickClip` in `./animationClips.ts`). The mixer is
//     driven by `useFrame`'s dt, which the R3F render loop delivers in
//     seconds — matches T-004's determinism model (ADR-0006).
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

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import {
  AnimationMixer,
  Color,
  LoopOnce,
  LoopRepeat,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import type { AnimationAction, AnimationClip, Material, Mesh } from 'three';
import { SkeletonUtils } from 'three-stdlib';

import { damp } from '../../../utils/math';

import type { CharacterState, CharacterStats } from './types';
import { createCharacterController, type CharacterController } from './controller';
import { createAnimationFSM, type AnimationFSM } from './animationFSM';
import { pickClip } from './animationClips';
import type { InputFrame, PlayerIndex } from '../../systems/input';

/** Capsule dimensions — DESIGN §4 "slightly heroic proportions". */
const CAPSULE_RADIUS = 0.4;
/** Half the cylinder-section height (total capsule height = 2*(halfHeight+radius) = 2.6 m). */
const CAPSULE_HALF_HEIGHT = 0.9;

/**
 * Source GLB path. Keep in one place so both `useGLTF(...)` and the
 * module-level `useGLTF.preload(...)` agree. The `public/` dir is served
 * at the web root by Vite, so `/models/...` resolves to
 * `/public/models/...` at dev-server + build time.
 */
const ANANSI_GLB_PATH = '/models/anansi/Anansi.glb';

/**
 * Capsule total height (2*(radius+halfHeight) = 2.6 m). Used to scale
 * the KayKit rig (authored at ~1.8 m) up to the collider's total height
 * so the visual and physics silhouettes match. 2.6 / 1.8 ≈ 1.44.
 *
 * Rationale: we keep the *physics* capsule fixed (controller stats,
 * collision margins, camera offset in Camera.tsx are all tuned against
 * the 2.6 m total height). Scaling the *mesh* to match is the cheapest
 * correction — no rig surgery, no per-clip retargeting, no Blender pass.
 * A multiplier node on the cloned scene's root propagates through the
 * skinned mesh and the skeleton bones uniformly.
 */
const CAPSULE_TOTAL_HEIGHT = 2 * (CAPSULE_RADIUS + CAPSULE_HALF_HEIGHT);
const KAYKIT_NATIVE_HEIGHT = 1.8;
const MESH_SCALE = CAPSULE_TOTAL_HEIGHT / KAYKIT_NATIVE_HEIGHT;

/**
 * Vertical offset applied to the cloned mesh's local origin so the
 * character's feet sit at the capsule's bottom. The capsule's
 * center-of-collider is at y=0 in the RigidBody's local frame, and its
 * bottom is at -(CAPSULE_RADIUS + CAPSULE_HALF_HEIGHT) = -1.3 m.
 * KayKit meshes are authored with feet at y=0 in their own local frame.
 * Lowering the mesh by the capsule's bottom offset puts the feet
 * coincident with the capsule's base.
 */
const MESH_Y_OFFSET = -(CAPSULE_RADIUS + CAPSULE_HALF_HEIGHT);

/** Crossfade duration for animation state transitions, in seconds. */
const CROSSFADE_DURATION_S = 0.2;

/**
 * Preload the Anansi GLB at module scope so the first Canvas render
 * doesn't block on network fetch. `useGLTF.preload` is drei's public API
 * for this (kicks the `useLoader` cache asynchronously). Calling it once
 * per module is safe — drei dedupes internally.
 */
useGLTF.preload(ANANSI_GLB_PATH);

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
   * Optional color tint for the character's material base color. Each
   * god passes its signature color (Anansi gold, Brigid ember, Susanoo
   * storm cyan). Default is a neutral warm gray — unlikely to be used
   * in production since every god wrapper sets an explicit color, but
   * avoids undefined-tint surprises in test harnesses.
   */
  color?: string;
  /**
   * Optional rim light color. Carried through for parity with the pre-
   * T-301 capsule material props; not applied to the KayKit mesh in the
   * current pass because the GLB's `MeshStandardMaterial`s don't expose
   * a rim-intensity uniform. Reserved for Phase 3 when we swap back to
   * a full ToonMaterial layer on the skinned mesh.
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
    seed = 1,
    onHandleReady,
  } = props;

  const rbRef = useRef<RapierRigidBody | null>(null);
  // meshRef now points to the cloned-scene's root `Object3D`, which is
  // what we rotate each frame for aim-alignment. `Mesh` is the old type
  // when the visual was a capsule; `Object3D` is the broader type that
  // includes Group / Scene from the GLB clone.
  const meshRef = useRef<Object3D | null>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const currentClipStateRef = useRef<CharacterState | null>(null);
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

  // Load the Anansi GLB. `useGLTF` suspends the component tree until the
  // GLTFLoader resolves; Canvas.tsx wraps the scene in a <Suspense> so
  // the first render's delay is absorbed without crashing. The hook
  // returns a cached shared reference — we clone the scene below so
  // each instance has its own skeleton state.
  const gltf = useGLTF(ANANSI_GLB_PATH);

  // Clone the source scene per-instance. `SkeletonUtils.clone` walks the
  // object tree AND duplicates the `Skeleton` + skinned mesh bone map,
  // so two Anansis on screen don't share bone transforms (which would
  // make both characters play the same animation pose). Clone the clips
  // array reference-only — `AnimationClip` objects are immutable shared
  // resources; it's only the mixer that needs to be per-instance.
  const clonedScene = useMemo<Object3D>(() => {
    return SkeletonUtils.clone(gltf.scene);
  }, [gltf.scene]);

  // Apply per-instance material tint. We walk the cloned tree once on
  // mount (and when `color` or `clonedScene` changes) and set each mesh
  // material's base color. The KayKit GLB ships a single shared material
  // reference, but `SkeletonUtils.clone` does NOT clone materials — so
  // we defensively clone the material here to prevent one character's
  // tint from leaking across to another. Without this guard, swapping
  // Anansi for Brigid (different god colors) would recolor both.
  useEffect(() => {
    const tintColor = new Color(color);
    // Weapon / accessory children to hide — Anansi is a trickster weaver,
    // not a sword-rogue. KayKit Rogue_Hooded's actual node names (verified
    // via in-browser GLB inspection): Knife_Offhand, Knife, 1H_Crossbow,
    // 2H_Crossbow, Throwable. We use an exact-name set + a prefix regex so
    // we don't false-match IK bones (e.g., elbowIK.l used to get caught
    // by an earlier regex that included "bow").
    const WEAPON_EXACT = new Set([
      'Knife',
      'Knife_Offhand',
      'Knife_Mainhand',
      'Throwable',
      'Quiver',
      'Rogue_Cape_Hood', // if it shows up; real hood is part of Rogue_Head_Hooded mesh
    ]);
    const WEAPON_PREFIX_RE = /^(1H|2H)_(Sword|Axe|Dagger|Bow|Crossbow|Shield|Hammer|Staff|Rod|Spear|Mace|Pickaxe|Flail|Knife)/i;
    clonedScene.traverse((obj: Object3D) => {
      if (obj.name && (WEAPON_EXACT.has(obj.name) || WEAPON_PREFIX_RE.test(obj.name))) {
        obj.visible = false;
        return;
      }
      // `Mesh` has a `material` field; other Object3D subclasses don't.
      // We duck-check by looking for the field rather than an
      // instanceof (cheaper and tolerates proxied meshes).
      const mesh = obj as Mesh;
      if (mesh.isMesh && mesh.material !== undefined) {
        // Material can be either a single material or an array.
        // Normalize to an array for the clone-and-tint loop.
        const mats: Material[] = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        const cloned = mats.map((m) => {
          const c = m.clone();
          // `MeshStandardMaterial` and its subclasses expose a `.color`
          // (three.js Color). Feature-detect and tint when present —
          // skips materials like MeshBasicMaterial that might not have
          // a color in degenerate GLBs.
          const withColor = c as MeshStandardMaterial;
          if (withColor.color !== undefined && withColor.color.isColor === true) {
            withColor.color.copy(tintColor);
            // Drop the baked texture so the gold tint reads pure. The
            // KayKit atlas is colorful (green hood, orange armor) — kept
            // as-is it multiplies with the gold and the hue wins the
            // battle. Mythological-deity read > Minecraft-block read.
            // Phase 4 polish can re-introduce a neutral-atlas tint if
            // a custom toon-shaded variant is authored.
            withColor.map = null;
            if (withColor.emissive !== undefined) {
              // Subtle gold rim glow — helps the silhouette pop against
              // the Sacred Grove overcast palette (ADR-0012).
              withColor.emissive.copy(tintColor).multiplyScalar(0.15);
            }
            withColor.needsUpdate = true;
          }
          return c;
        });
        // Re-assign: single-material meshes get the first cloned
        // material; multi-material meshes keep array shape.
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [clonedScene, color]);

  // Mount the AnimationMixer once per instance. `new AnimationMixer(root)`
  // binds the mixer to the cloned scene's skeleton — every subsequent
  // `mixer.clipAction(clip)` returns an action scoped to THIS scene.
  // We construct the mixer in a `useMemo` keyed on `clonedScene` so
  // React's re-render semantics don't leak old mixers. (The gltf.scene
  // reference is stable — drei caches the loaded GLTF — so the memo
  // effectively runs once.)
  const mixer = useMemo<AnimationMixer>(() => {
    return new AnimationMixer(clonedScene);
  }, [clonedScene]);

  // Clips list is stable across renders (GLB is cached by drei).
  // Memoize to pass a stable readonly array into pickClip calls.
  const clips = useMemo<readonly AnimationClip[]>(() => gltf.animations, [gltf.animations]);

  // Play the initial idle clip once the mixer and clips are available.
  // This avoids a T-pose flash at mount — the skeleton's bind pose is
  // a T-pose by default, and without a clip playing the mixer won't
  // update the bone transforms.
  useEffect(() => {
    const action = pickClip(mixer, clips, 'idle');
    if (action !== null) {
      action.setLoop(LoopRepeat, Infinity);
      action.reset().play();
      currentActionRef.current = action;
      currentClipStateRef.current = 'idle';
    }
  }, [mixer, clips]);

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

  // Dispose the mixer on unmount. `stopAllAction` halts any in-flight
  // transitions; `uncacheRoot` frees the skeleton binding. Both are safe
  // no-ops on already-torn-down instances.
  useEffect(() => {
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
    };
  }, [mixer, clonedScene]);

  /**
   * Crossfade the active animation action into the clip that matches
   * the FSM's current state. No-op if the state hasn't changed since
   * the last sync. Called each tick from `useFrame` so state changes
   * are picked up on the same frame they happen.
   *
   * Wrapped in `useCallback` keyed on `mixer` + `clips` so the identity
   * is stable across renders (dependencies are both stable-through-memo
   * — drei caches the GLB, `SkeletonUtils.clone` runs once per mount).
   */
  const syncClipToState = useCallback(
    (state: CharacterState): void => {
      if (state === currentClipStateRef.current) return;
      const prev = currentActionRef.current;
      const next = pickClip(mixer, clips, state);
      if (next === null) return;

      // Death / hit / dodge / attack are one-shot clips; idle / running
      // are looping. Clamp one-shots to their final frame so the skeleton
      // holds the last pose until the next transition.
      if (state === 'dead' || state === 'hit' || state === 'dodging' || state === 'attacking') {
        next.setLoop(LoopOnce, 1);
        next.clampWhenFinished = true;
      } else {
        next.setLoop(LoopRepeat, Infinity);
        next.clampWhenFinished = false;
      }

      next.reset();
      next.setEffectiveTimeScale(1);
      next.setEffectiveWeight(1);
      next.fadeIn(CROSSFADE_DURATION_S).play();
      if (prev !== null && prev !== next) {
        prev.fadeOut(CROSSFADE_DURATION_S);
      }

      currentActionRef.current = next;
      currentClipStateRef.current = state;
    },
    [mixer, clips],
  );

  useFrame((_state, dtSeconds) => {
    const ctrl = controllerRef.current;
    const fsm = fsmRef.current;
    const rb = rbRef.current;

    // Always advance the mixer (even when dead) — the Death_A clip's
    // tail pose depends on the mixer ticking through its last frame.
    mixer.update(dtSeconds);

    if (!ctrl || !rb) return;
    if (deadRef.current) {
      // Dead: advance the FSM timer (for any death-anim budgeting) but
      // do not sample input or move. The FSM state is already 'dead'
      // so the next `syncClipToState` call below will pick the death
      // clip and let it play out.
      fsm.tick(dtSeconds);
      syncClipToState(fsm.current);
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

    // Visual yaw rotation. Priority:
    //   1. When MOVING (moveMag >= threshold): face movement direction.
    //      This matches the "character goes where you go" brawler feel
    //      (Brawl Stars / MOBA-likes) and is what desktop mouse-aim users
    //      expect when running without actively targeting.
    //   2. When STATIONARY AND aim is significantly deflected: face aim.
    //      Gives a "look around while standing" tell when the mouse is
    //      pulled far from the character — useful for pre-aim before
    //      committing to a shot.
    //   3. Otherwise: no rotation (mesh stays as-is).
    //
    // Rationale for this priority (vs aim-always): the mouse ALWAYS has
    // some non-zero magnitude relative to the character's screen position
    // (because the character moves but the cursor doesn't), so
    // aim-always caused the mesh to constantly swing toward the cursor
    // even when the player was just running. Bad feel + disorienting.
    //
    // Yaw math: default mesh forward is -Z. Rotating by θ around Y makes
    // forward = (sin θ, 0, -cos θ). For target direction (dx, 0, dz),
    // θ = atan2(dx, -dz). Both input axes (move + aim) are stick-space
    // where Y=up maps to world -Z, so the -dz substitution cancels the
    // stick's Y-up sign → θ = atan2(stickX, stickY). Same formula for
    // both inputs; we just pick which stick drives it.
    const MOVE_FACE_THRESHOLD = 0.1;
    const AIM_FACE_THRESHOLD = 0.4;
    const moveMag = Math.hypot(input.moveX, input.moveY);
    let targetYaw: number | null = null;
    if (moveMag >= MOVE_FACE_THRESHOLD) {
      targetYaw = Math.atan2(input.moveX, input.moveY);
    } else if (input.aimMagnitude >= AIM_FACE_THRESHOLD) {
      targetYaw = Math.atan2(input.aimX, input.aimY);
    }
    const mesh = meshRef.current;
    if (mesh && targetYaw !== null) {
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

    // Finally, crossfade the mixer into the clip that matches the FSM's
    // current state. `syncClipToState` is a no-op if we're already on
    // that state — so the tick-rate cost is a single ref compare.
    syncClipToState(fsm.current);
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
      {/* Cloned-scene wrapper. The inner primitive carries the KayKit
          skinned mesh + skeleton + animation targets; the outer group
          carries the scale + y-offset so the feet line up with the
          capsule's base without mutating the scene's original transform.
          The aim-rotation is applied to the same wrapper (meshRef) so
          yaw propagates through the skeleton uniformly. */}
      <group
        ref={meshRef as unknown as React.Ref<Object3D>}
        position={[0, MESH_Y_OFFSET, 0]}
        scale={[MESH_SCALE, MESH_SCALE, MESH_SCALE]}
      >
        <primitive object={clonedScene} />
      </group>
    </RigidBody>
  );
}
