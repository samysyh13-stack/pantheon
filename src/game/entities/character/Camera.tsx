// Tracking camera (T-004 AE).
//
// An isometric-ish third-person follow camera. The camera lives at a
// fixed offset from the tracked character and uses critically-damped
// `damp` (from /src/utils/math.ts) to interpolate each axis
// independently. No overshoot, no snap — per AE brief: "no snap, no
// overshoot".
//
// Why "isometric-ish" rather than true isometric?
//   - True iso is orthographic; we keep a 45° perspective projection
//     because the DESIGN §7 Sacred Grove has standing stones whose
//     vertical foreshortening reads better with perspective depth cues.
//   - The camera's pitch angle (~45°) is mocked up in §4's controls
//     table (WASD translates in the XZ plane relative to the camera's
//     yaw).
//
// Camera offset:
//   - Height = 10 m above the character's feet.
//   - Horizontal distance = 14 m behind (positive Z) and looking toward
//     the character. The resulting pitch is ~atan2(10, 14) ≈ 35° —
//     slightly shallower than true iso (30° / 60°) to keep the arena
//     floor visible without squashing character silhouettes.
//
// Damping lambda chosen empirically:
//   - LAMBDA = 6.0 gives ~99% approach in ~0.76 s — smooth but
//     responsive. Higher feels twitchy on mobile; lower feels "chasing
//     a laggy character".
//   - Same lambda is used on both position and look-at so the camera
//     never "leads" or "lags" the target in framing.

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';

import { damp } from '../../../utils/math';
import type { CharacterHandle } from './Character';

/**
 * World-space camera offset from the target (metres). +Y = up, +Z = back.
 *
 * v1.0.1 Brawl-Stars-feel pass: previous offset (0, 10, 14) gave ~35° pitch
 * which read as third-person Diablo, not top-down brawler. Bumped to
 * (0, 16, 11) → pitch atan2(16, 11) ≈ 55° — closer to BS's 55–65° baseline
 * (per docs/research/BRAWL-STARS-COMPARISON.md). FOV narrowed in tandem so
 * the arena reads more orthographically (less foreground-bloat on the
 * player Anansi).
 */
export const CAMERA_OFFSET: [number, number, number] = [0, 16, 11];
/** Look-at offset from the character's origin (we aim slightly above feet). */
export const CAMERA_LOOK_AT_OFFSET: [number, number, number] = [0, 0.8, 0];
/**
 * Damping lambda for position + look-at interpolation.
 *
 * Lowered from 6.0 → 4.0 so the camera lags the player slightly when they
 * dash — gives the BS "the camera is filming the action, not glued to the
 * brawler" feel.
 */
export const CAMERA_LAMBDA = 4.0;
/**
 * Perspective FOV in degrees.
 *
 * Lowered from 45° → 35° (telephoto) so the near-far disparity is reduced.
 * Brawl Stars uses ~30–35° for the near-orthographic "everything at one
 * scale" read.
 */
export const CAMERA_FOV_DEG = 35;
/** Near / far clipping planes. */
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 200;

/** Props for the tracking camera. `target` is a ref to the CharacterHandle. */
export interface TrackingCameraProps {
  /**
   * Ref object carrying the character handle (set by Character.tsx's
   * `onHandleReady`). Nullable because refs settle a tick after mount.
   */
  target: React.RefObject<CharacterHandle | null>;
  /** Override the default offset (metres). */
  offset?: [number, number, number];
  /** Override the default look-at offset (metres). */
  lookAtOffset?: [number, number, number];
  /** Override the default damping lambda. */
  lambda?: number;
}

const SCRATCH_TARGET = new Vector3();
const SCRATCH_LOOK_AT = new Vector3();

export function TrackingCamera(props: TrackingCameraProps) {
  const {
    target,
    offset = CAMERA_OFFSET,
    lookAtOffset = CAMERA_LOOK_AT_OFFSET,
    lambda = CAMERA_LAMBDA,
  } = props;

  const { camera } = useThree();
  // Remember the current-tracked point so `damp()` has a previous
  // sample to interpolate from when the first tick fires. Initialized
  // below.
  const currentLookAt = useRef(new Vector3(0, 1, 0));

  // On first mount, snap the camera to the offset above the target's
  // initial position (no interpolation — avoids the one-frame "camera
  // starting at origin and racing to the player" glitch).
  useEffect(() => {
    const handle = target.current;
    if (!handle) return;
    const p = handle.getWorldPosition();
    camera.position.set(p.x + offset[0], p.y + offset[1], p.z + offset[2]);
    currentLookAt.current.set(
      p.x + lookAtOffset[0],
      p.y + lookAtOffset[1],
      p.z + lookAtOffset[2],
    );
    camera.lookAt(currentLookAt.current);
    // Ensure the camera's FOV / near / far are in sync if the parent
    // Canvas defaulted differently.
    if ((camera as PerspectiveCamera).isPerspectiveCamera) {
      const pc = camera as PerspectiveCamera;
      pc.fov = CAMERA_FOV_DEG;
      pc.near = CAMERA_NEAR;
      pc.far = CAMERA_FAR;
      pc.updateProjectionMatrix();
    }
    // Intentional one-shot — we only snap on first mount. Subsequent
    // target swaps would reset this, but we don't expect those in v1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((_state, dt) => {
    const handle = target.current;
    if (!handle) return;
    const p = handle.getWorldPosition();
    // Desired camera position = target + offset.
    SCRATCH_TARGET.set(p.x + offset[0], p.y + offset[1], p.z + offset[2]);
    // Critically-damped interpolation on each axis.
    camera.position.x = damp(camera.position.x, SCRATCH_TARGET.x, lambda, dt);
    camera.position.y = damp(camera.position.y, SCRATCH_TARGET.y, lambda, dt);
    camera.position.z = damp(camera.position.z, SCRATCH_TARGET.z, lambda, dt);

    // Interpolate the look-at target the same way so the framing
    // doesn't whip when the character dashes.
    SCRATCH_LOOK_AT.set(
      p.x + lookAtOffset[0],
      p.y + lookAtOffset[1],
      p.z + lookAtOffset[2],
    );
    currentLookAt.current.x = damp(currentLookAt.current.x, SCRATCH_LOOK_AT.x, lambda, dt);
    currentLookAt.current.y = damp(currentLookAt.current.y, SCRATCH_LOOK_AT.y, lambda, dt);
    currentLookAt.current.z = damp(currentLookAt.current.z, SCRATCH_LOOK_AT.z, lambda, dt);
    camera.lookAt(currentLookAt.current);
  });

  // No JSX — the tracking camera drives the R3F default camera in-place
  // rather than mounting a second perspective camera and switching
  // active. This keeps the Canvas.tsx integration (which sets up its
  // own camera) stable.
  return null;
}
