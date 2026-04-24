// Kinematic character controller (T-004 AE).
//
// Consumes an `InputFrame` each tick, produces a per-tick displacement
// vector, and drives a Rapier kinematic-position rigid body via Rapier's
// `KinematicCharacterController` so slopes / steps / static-world collision
// are handled correctly without us re-implementing them.
//
// The controller is deliberately NOT an R3F component — the <Character>
// component owns the rigid-body lifecycle and hands refs to this module's
// `createCharacterController(...)` factory. Keeping the controller as a
// plain TS factory keeps it testable (we can construct it with stubbed
// RigidBody-shaped objects in unit tests once we add integration coverage
// later) and keeps the React tree off the hot path — per
// /docs/ARCHITECTURE.md §8: "Gameplay systems that update every tick
// bypass the React tree entirely."
//
// Determinism (ADR-0006):
//   - No wall clock — the controller receives dt in seconds from the
//     caller, which owns timing (Phase 2 integrates against
//     `src/game/engine/loop.ts`'s TICK_DT = 1/60 s constant).
//   - No `Math.random()` — state is fully authored by the current input +
//     the previous frame's velocity. `createRng(seed)` is available via
//     config if Phase 2 features need it.
//   - Aim direction comes from the InputFrame, not from camera ray-casts
//     (which would pull wall-clock picking into the sim).
//
// Movement model:
//   - Target velocity = moveSpeed * (normalized XZ move vector from
//     InputFrame). The input is mapped X,Y -> world X,Z with Y flipped
//     because the camera looks down the +Z axis and "up on the stick"
//     means "forward in world", which is -Z in three.js conventions.
//   - Current velocity is lerped toward target via a critically-damped
//     `damp()` with separate acceleration / deceleration lambdas (so the
//     character snaps off the stick less than it snaps on — a feel tuning
//     knob).
//   - Dodge overrides target velocity for the dodge duration: velocity
//     becomes `dashSpeed * dodgeDir` until the dodge timer elapses.

import type { RapierRigidBody } from '@react-three/rapier';
import type {
  Collider,
  KinematicCharacterController,
  World,
  Vector,
} from '@dimforge/rapier3d-compat';

import type { CharacterConfig, CharacterStats } from './types';
import type { InputFrame } from '../../systems/input';
import { createRng, type Rng } from '../../engine/random';
import { damp, normalize2 } from '../../../utils/math';

/**
 * Ground acceleration lambda. Higher = snappier response to stick input.
 * 14.0 produces ~99% approach in ~0.33 s at dt=1/60, which feels
 * responsive without being twitchy. Tuned to pair with `DECEL_LAMBDA`
 * below such that releasing the stick coasts briefly (~100 ms) before
 * settling to zero — that tiny coast is what separates "brawler feel"
 * from "momentum-less arcade feel".
 */
const ACCEL_LAMBDA = 14.0;
/**
 * Ground deceleration lambda. Lower than ACCEL so stopping has a tiny
 * coast — matches brawler-genre feel (Brawl Stars, MOBA-likes) where
 * you slide ~0.1 m off the stick rather than snap to a halt.
 */
const DECEL_LAMBDA = 9.0;

/** Controller's up axis — Y-up (three.js / R3F convention). */
const UP_Y: Vector = { x: 0, y: 1, z: 0 };
/** Max slope the character can climb (40°). */
const MAX_SLOPE_CLIMB_ANGLE = (40 * Math.PI) / 180;
/** Below this slope, the character will not auto-slide down. */
const MIN_SLOPE_SLIDE_ANGLE = (30 * Math.PI) / 180;
/** Autostep: max step height, in metres. Pairs with 0.5 m stair geometry. */
const AUTOSTEP_MAX_HEIGHT = 0.35;
/** Autostep: minimum free width after the step, in metres. */
const AUTOSTEP_MIN_WIDTH = 0.2;
/** Snap-to-ground threshold. Keeps the character tracking gentle slopes. */
const SNAP_TO_GROUND_DISTANCE = 0.25;
/** Gap between the character collider and obstacles (Rapier recommendation). */
const CONTROLLER_OFFSET = 0.02;
/** Gravity applied to the character per tick, in m/s^2. */
const GRAVITY_MPS2 = -20.0;
/** Cap on downward velocity from accumulated gravity (m/s). */
const MAX_FALL_SPEED = 40.0;

/**
 * Public surface of the controller — what the Character R3F component
 * calls each tick. `update()` mutates the controller's internal state
 * and the underlying rigid body's next-kinematic-translation; it does
 * not return the new position (the caller reads that via rigidBody.translation()
 * after the physics step, or by watching the R3F object via a ref).
 */
export interface CharacterController {
  /**
   * Advance the controller one tick. `dt` is in seconds (typically 1/60).
   * `input` is sampled from the input manager via its pull API (snapshot).
   */
  update(input: InputFrame, dt: number): void;
  /**
   * Is the character currently in dodge i-frames? Consumed by the Phase 2
   * combat layer (hit-confirm pipeline in DESIGN §8) to decide whether to
   * apply damage. During the 300 ms dodge window this returns `true`; at
   * all other times (idle/running/attacking/hit/dead) it returns `false`.
   */
  isInvulnerable(): boolean;
  /**
   * Current state exposed for the R3F component to mirror into the FSM
   * and for external observers (HUD, combat). Derived state only — not
   * a second source of truth.
   */
  isDodging(): boolean;
  /**
   * Edge-triggered: returns `true` exactly once per successful dodge
   * activation. The FSM consumer calls this after `update()` to decide
   * whether to request the `dodging` FSM transition. Keeps the
   * edge-detection centralized in the controller (which already owns
   * the cooldown bookkeeping).
   */
  consumeDodgeEdge(): boolean;
  /**
   * Edge-triggered: returns `true` exactly once per basicAttack input
   * rising edge. The FSM consumer uses this to request the `attacking`
   * transition — not every tick the button is held.
   */
  consumeBasicAttackEdge(): boolean;
  /**
   * Current planar speed in m/s (hypot of velocity xz). Used by the
   * Character component to drive idle <-> running FSM transitions.
   */
  getPlanarSpeed(): number;
  /**
   * Dispose of the Rapier character controller. Call from the owning
   * component's unmount effect.
   */
  dispose(): void;
}

/**
 * Construction options. `rigidBody` and `collider` come from the R3F
 * rapier wrappers (refs settle after first render); `world` is pulled
 * from the `useRapier()` hook by the caller.
 */
export interface ControllerDeps {
  world: World;
  rigidBody: RapierRigidBody;
  collider: Collider;
  config: CharacterConfig;
}

interface ControllerInternal {
  velX: number; // world-space velocity X (m/s)
  velY: number; // gravity accumulator (m/s) — reset to 0 on ground
  velZ: number; // world-space velocity Z (m/s)
  // Dodge state
  dodgeTimerMs: number; // time remaining in active dodge; 0 = not dodging
  dodgeCooldownMs: number; // time remaining before next dodge is allowed
  dodgeDirX: number; // latched direction at dodge-start (unit)
  dodgeDirZ: number;
  // Edge detection
  prevDodgeHeld: boolean;
  prevBasicAttackHeld: boolean;
  // Edges that `consume*Edge()` will return on the next read
  pendingDodgeEdge: boolean;
  pendingBasicAttackEdge: boolean;
  // Seeded RNG — carried for Phase 2 features (footstep surface picks,
  // hit-flash variation). Not used by the controller itself today.
  rng: Rng;
}

export function createCharacterController(deps: ControllerDeps): CharacterController {
  const { world, rigidBody, collider, config } = deps;
  const stats: CharacterStats = config.stats;

  const kcc: KinematicCharacterController = world.createCharacterController(CONTROLLER_OFFSET);
  kcc.setUp(UP_Y);
  kcc.setSlideEnabled(true);
  kcc.setMaxSlopeClimbAngle(MAX_SLOPE_CLIMB_ANGLE);
  kcc.setMinSlopeSlideAngle(MIN_SLOPE_SLIDE_ANGLE);
  kcc.enableAutostep(AUTOSTEP_MAX_HEIGHT, AUTOSTEP_MIN_WIDTH, false);
  kcc.enableSnapToGround(SNAP_TO_GROUND_DISTANCE);
  // Don't push dynamic bodies around — keeps the character from launching
  // Anansi's clone (a future kinematic body) when brushing past it.
  kcc.setApplyImpulsesToDynamicBodies(false);

  const self: ControllerInternal = {
    velX: 0,
    velY: 0,
    velZ: 0,
    dodgeTimerMs: 0,
    dodgeCooldownMs: 0,
    dodgeDirX: 0,
    dodgeDirZ: 0,
    prevDodgeHeld: false,
    prevBasicAttackHeld: false,
    pendingDodgeEdge: false,
    pendingBasicAttackEdge: false,
    rng: createRng(config.seed),
  };

  const update = (input: InputFrame, dt: number): void => {
    if (!(dt > 0)) return;
    const dtMs = dt * 1000;

    // 1) Rising-edge detection for dodge + basic attack. The input
    //    manager already emits booleans held-for-the-whole-duration;
    //    edges are the controller's job.
    const dodgeEdge = input.dodge && !self.prevDodgeHeld;
    const basicEdge = input.basicAttack && !self.prevBasicAttackHeld;
    self.prevDodgeHeld = input.dodge;
    self.prevBasicAttackHeld = input.basicAttack;

    if (basicEdge) self.pendingBasicAttackEdge = true;

    // 2) Dodge activation. The edge only "takes" if cooldown is ready
    //    AND we're not already mid-dodge. Cooldown prevents spam; the
    //    in-flight check prevents re-triggering on back-to-back press.
    if (dodgeEdge && self.dodgeCooldownMs <= 0 && self.dodgeTimerMs <= 0) {
      // Latch the dodge direction from the current move input if the
      // stick is deflected; otherwise dodge backward (away from aim).
      // Back-dodge is a common brawler tech for creating space.
      const moveMag = Math.hypot(input.moveX, input.moveY);
      if (moveMag > 1e-3) {
        // Remap stick-space (y-up) to world XZ (y forward → -z).
        const [nx, ny] = normalize2(input.moveX, input.moveY);
        self.dodgeDirX = nx;
        self.dodgeDirZ = -ny;
      } else {
        // No move input — back-dodge relative to aim. If no aim either,
        // dodge "backward" along +Z (screen-down in default iso view).
        const aimMag = input.aimMagnitude;
        if (aimMag > 1e-3) {
          self.dodgeDirX = -input.aimX;
          self.dodgeDirZ = input.aimY; // aimY is stick-Y-up; negate-negate => +Z
        } else {
          self.dodgeDirX = 0;
          self.dodgeDirZ = 1;
        }
      }
      self.dodgeTimerMs = stats.dashDurationMs;
      self.dodgeCooldownMs = stats.dashCooldownMs;
      self.pendingDodgeEdge = true;
    }

    // 3) Decrement timers.
    if (self.dodgeTimerMs > 0) {
      self.dodgeTimerMs = Math.max(0, self.dodgeTimerMs - dtMs);
    }
    if (self.dodgeCooldownMs > 0) {
      self.dodgeCooldownMs = Math.max(0, self.dodgeCooldownMs - dtMs);
    }

    // 4) Compute target planar velocity.
    let targetVx = 0;
    let targetVz = 0;
    if (self.dodgeTimerMs > 0) {
      // Dodge override: fixed-speed along latched direction.
      targetVx = self.dodgeDirX * stats.dashSpeed;
      targetVz = self.dodgeDirZ * stats.dashSpeed;
    } else {
      const moveMag = Math.hypot(input.moveX, input.moveY);
      if (moveMag > 1e-3) {
        const [nx, ny] = normalize2(input.moveX, input.moveY);
        // stick-Y-up -> world -Z (forward). The 3rd-person iso camera in
        // Camera.tsx looks along -Z, so "up on stick" = "away from camera".
        targetVx = nx * stats.moveSpeed;
        targetVz = -ny * stats.moveSpeed;
      }
    }

    // 5) Critically-damped interpolation toward target. Separate lambdas
    //    for accel vs decel give that slight coast on release.
    const acceleratingX =
      Math.abs(targetVx) > Math.abs(self.velX) ||
      Math.sign(targetVx) !== Math.sign(self.velX);
    const acceleratingZ =
      Math.abs(targetVz) > Math.abs(self.velZ) ||
      Math.sign(targetVz) !== Math.sign(self.velZ);
    // During a dodge, we want immediate-ish snap to the dodge speed —
    // use ACCEL_LAMBDA * 2 so the dodge reaches full speed within ~80 ms.
    const effectiveAccel = self.dodgeTimerMs > 0 ? ACCEL_LAMBDA * 2 : ACCEL_LAMBDA;
    self.velX = damp(self.velX, targetVx, acceleratingX ? effectiveAccel : DECEL_LAMBDA, dt);
    self.velZ = damp(self.velZ, targetVz, acceleratingZ ? effectiveAccel : DECEL_LAMBDA, dt);

    // 6) Gravity accumulator. Rapier's KCC handles step/slope collision
    //    on a pre-computed desired translation, so we pre-multiply
    //    by dt here to get the vertical component of the displacement
    //    vector.
    self.velY = Math.max(MAX_FALL_SPEED * -1, self.velY + GRAVITY_MPS2 * dt);

    // 7) Feed desired translation to Rapier's KCC. It returns the actual
    //    translation after slope / step / collision resolution.
    const desired: Vector = {
      x: self.velX * dt,
      y: self.velY * dt,
      z: self.velZ * dt,
    };
    kcc.computeColliderMovement(collider, desired);
    const computed = kcc.computedMovement();

    // 8) Reset gravity accumulator when grounded (prevents build-up while
    //    standing still).
    if (kcc.computedGrounded() && self.velY < 0) {
      self.velY = 0;
    }

    // 9) Apply to the kinematic rigid body via `setNextKinematic*` so
    //    Rapier can estimate the kinematic velocity for any dynamic
    //    bodies we brush against.
    const cur = rigidBody.translation();
    const next: Vector = {
      x: cur.x + computed.x,
      y: cur.y + computed.y,
      z: cur.z + computed.z,
    };
    rigidBody.setNextKinematicTranslation(next);
  };

  const isInvulnerable = (): boolean => self.dodgeTimerMs > 0;
  const isDodging = (): boolean => self.dodgeTimerMs > 0;

  const consumeDodgeEdge = (): boolean => {
    const e = self.pendingDodgeEdge;
    self.pendingDodgeEdge = false;
    return e;
  };
  const consumeBasicAttackEdge = (): boolean => {
    const e = self.pendingBasicAttackEdge;
    self.pendingBasicAttackEdge = false;
    return e;
  };

  const getPlanarSpeed = (): number => Math.hypot(self.velX, self.velZ);

  const dispose = (): void => {
    world.removeCharacterController(kcc);
  };

  return {
    update,
    isInvulnerable,
    isDodging,
    consumeDodgeEdge,
    consumeBasicAttackEdge,
    getPlanarSpeed,
    dispose,
  };
}
