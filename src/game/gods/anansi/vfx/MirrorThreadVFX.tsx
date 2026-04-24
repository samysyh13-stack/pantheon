// PANTHÉON — Anansi Mirror Thread clone shimmer (T-102 RS).
//
// Attached to the clone's character capsule as a thin overlay mesh. The
// spawn telegraph (per T-100 CB kit's 0.3-1.0 s cast-time range; we
// default to 300 ms since T-100 hasn't landed a specific value) is:
//
//   1. scale-in from 0 → 1 over 300 ms,
//   2. fresnel pulse (uIntensity ramps 2.5 → 0.8) over the same window.
//
// After the telegraph the clone shimmer settles at the steady-state
// pulse. Reduced motion disables the pulse (constant 0.6 intensity).

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';

import { useAppStore } from '../../../../state/store';
import { CloneShimmer } from '../../../../vfx';

const SPAWN_TELEGRAPH_MS = 300; // Default per T-100 CB kit (cast telegraph 0.3-1.0 s).
const ANANSI_HIGHLIGHT = 0xffd48a;

export interface MirrorThreadVFXProps {
  /** World position of the clone capsule root. */
  position: readonly [number, number, number];
  /**
   * When true, starts the spawn telegraph. Once complete, the shimmer
   * settles at steady state. Flip back to false to scale the shimmer
   * down (useful on despawn).
   */
  active: boolean;
  /** Optional capsule dimensions — defaults mirror Character.tsx. */
  capsuleRadius?: number;
  capsuleHalfHeight?: number;
}

/**
 * Overlay VFX for Anansi's Mirror Thread clone. Mounts a CloneShimmer
 * wrapped in a scaling Group so we can animate the spawn telegraph
 * without rebuilding the material.
 */
export function MirrorThreadVFX(props: MirrorThreadVFXProps) {
  const {
    position,
    active,
    capsuleRadius = 0.44,
    capsuleHalfHeight = 0.96,
  } = props;

  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);
  const groupRef = useRef<Group | null>(null);
  const elapsedMsRef = useRef(0);
  const [intensity, setIntensity] = useState(2.5);

  useEffect(() => {
    // Reset telegraph clock on activate/deactivate.
    elapsedMsRef.current = 0;
  }, [active]);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    elapsedMsRef.current += dt * 1000;

    if (active) {
      // Scale-in from 0 → 1 over SPAWN_TELEGRAPH_MS.
      const t = Math.min(1, elapsedMsRef.current / SPAWN_TELEGRAPH_MS);
      const scale = reducedMotion ? 1 : t;
      groupRef.current.scale.set(scale, scale, scale);

      // Fresnel pulse: 2.5 → 0.8 over the same window.
      if (!reducedMotion) {
        const startI = 2.5;
        const endI = 0.8;
        const iPulse = startI + (endI - startI) * t;
        setIntensity(iPulse);
      } else {
        setIntensity(0.6);
      }
    } else {
      // Scale-out on deactivate (faster: ~150 ms).
      const t = Math.min(1, elapsedMsRef.current / 150);
      const scale = reducedMotion ? 1 - t : Math.max(0, 1 - t);
      groupRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group ref={groupRef} position={[position[0], position[1], position[2]]}>
      <CloneShimmer
        color={ANANSI_HIGHLIGHT}
        intensity={intensity}
        fresnelPower={3.0}
        capsuleRadius={capsuleRadius}
        capsuleHalfHeight={capsuleHalfHeight}
      />
    </group>
  );
}
