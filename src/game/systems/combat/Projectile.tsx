// Silken Dart projectile (combat MVP).
//
// Simple ballistic: moves along a fixed direction at a fixed speed, expires
// after a lifetime OR on hit. Collision is a cheap sphere-sphere distance
// check against the target's world position — good enough for Phase 3 MVP.
// Phase 4 polish can promote to a real Rapier sensor if false positives
// show up in playtest.

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { type Mesh, Vector3 } from 'three';
import type { CharacterHandle } from '../../entities/character/Character';

export interface ProjectileProps {
  origin: [number, number, number];
  direction: [number, number, number]; // unit vector, world space XZ
  speed: number; // m/s
  color: string;
  emissiveColor?: string;
  lifetimeSec: number;
  hitRadius?: number;
  targetRef: React.RefObject<CharacterHandle | null>;
  onExpire: () => void;
  onHit: () => void;
}

const SCRATCH = new Vector3();
const DEFAULT_HIT_RADIUS = 0.9; // pairs with Anansi's 0.4 m capsule + slack

export function Projectile({
  origin,
  direction,
  speed,
  color,
  emissiveColor,
  lifetimeSec,
  hitRadius = DEFAULT_HIT_RADIUS,
  targetRef,
  onExpire,
  onHit,
}: ProjectileProps) {
  const meshRef = useRef<Mesh | null>(null);
  const pos = useRef(new Vector3(origin[0], origin[1], origin[2]));
  const ageRef = useRef(0);
  const consumedRef = useRef(false);

  useFrame((_state, dt) => {
    if (consumedRef.current) return;
    ageRef.current += dt;
    if (ageRef.current > lifetimeSec) {
      consumedRef.current = true;
      onExpire();
      return;
    }
    pos.current.x += direction[0] * speed * dt;
    pos.current.y += direction[1] * speed * dt;
    pos.current.z += direction[2] * speed * dt;
    const m = meshRef.current;
    if (m) m.position.copy(pos.current);

    const target = targetRef.current;
    if (target) {
      const tp = target.getWorldPosition();
      SCRATCH.copy(pos.current).sub(tp);
      if (SCRATCH.length() < hitRadius) {
        consumedRef.current = true;
        onHit();
      }
    }
  });

  return (
    <mesh ref={meshRef} position={origin} castShadow>
      <sphereGeometry args={[0.15, 8, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={emissiveColor ?? color}
        emissiveIntensity={1.2}
      />
    </mesh>
  );
}
