// Sacred Grove — v1 arena gray-box blockout.
//
// Neutral overcast palette per ADR-0012: cool gray-green terrain, warmer
// sandstone on the dais, slate on shrines, moss-green stone on standing stones.
// Uses stock MeshStandardMaterial for blockout; T-104 (Phase 2 WA polish) swaps
// to ToonMaterial + stylized polish, adds shrine runes, banner geometry, and
// storm-boundary particle ring.

import { RigidBody } from '@react-three/rapier';
import {
  ARENA_LAYOUT,
  SHRINES,
  STANDING_STONES,
  type ColliderDef,
} from './colliders';

function Prop({ def, color }: { def: ColliderDef; color: string }) {
  const { position, dimensions } = def;
  return (
    <RigidBody type="fixed" colliders="cuboid" name={def.name}>
      <mesh
        position={[position.x, dimensions.height / 2, position.z]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.05} />
      </mesh>
    </RigidBody>
  );
}

export function SacredGrove() {
  const { groundSize, daisRadius, daisHeight, stormRadius } = ARENA_LAYOUT;

  return (
    <group name="arena-sacred-grove">
      {/* Ground. Thin box rather than plane to keep the physics collider
         cheap (infinite plane is surprisingly costly in Rapier). */}
      <RigidBody type="fixed" colliders="cuboid" name="arena-ground">
        <mesh position={[0, -0.25, 0]} receiveShadow>
          <boxGeometry args={[groundSize, 0.5, groundSize]} />
          <meshStandardMaterial color="#3a4540" roughness={0.95} metalness={0} />
        </mesh>
      </RigidBody>

      {/* Central dais: warm sandstone circle. Approximated with a low-sided
         cylinder; collider auto-generated as cuboid bounding, acceptable for
         blockout. T-104 swaps to a proper convex hull. */}
      <RigidBody type="fixed" colliders="hull" name="arena-dais">
        <mesh position={[0, daisHeight / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[daisRadius, daisRadius, daisHeight, 48]} />
          <meshStandardMaterial color="#8b7860" roughness={0.8} metalness={0.05} />
        </mesh>
      </RigidBody>

      {/* Shrines at cardinal compass points (breakable, 300 HP each). */}
      {SHRINES.map((s) => (
        <Prop key={s.name} def={s} color="#5c5c5c" />
      ))}

      {/* Standing stones at 45° offsets (unbreakable line-of-sight breakers). */}
      {STANDING_STONES.map((s) => (
        <Prop key={s.name} def={s} color="#4a5545" />
      ))}

      {/* Storm boundary — purely visual in Phase 1. Phase 2 adds pushback force
         + 10 dmg/s damage zone (DESIGN §7). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[stormRadius - 0.4, stormRadius, 96]} />
        <meshBasicMaterial color="#8aa2b5" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}
