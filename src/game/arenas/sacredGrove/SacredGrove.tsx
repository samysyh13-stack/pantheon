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

/**
 * Central tree anchored on the dais. Phase-2 T-104 polish per user spec:
 * destroyable prop with 500 HP — hp-tagged but the visible-mesh + collider
 * swap to a destroyed-stump on 0 HP is the Phase 3 combat-layer job. For
 * Phase 2 we render the trunk + a simple lofted canopy so the arena has a
 * visual landmark and a LOS-breaking centerpiece.
 */
function CentralTree() {
  return (
    <RigidBody type="fixed" colliders="cuboid" name="arena-central-tree" userData={{ hp: 500 }}>
      {/* Trunk */}
      <mesh position={[0, 1.75, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.5, 3, 12]} />
        <meshStandardMaterial color="#4a3a2c" roughness={1} metalness={0} />
      </mesh>
      {/* Canopy — two overlapping cones for a stylized lofted silhouette. */}
      <mesh position={[0, 4, 0]} castShadow>
        <coneGeometry args={[2.2, 2.2, 10]} />
        <meshStandardMaterial color="#48624a" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 5, 0]} castShadow>
        <coneGeometry args={[1.6, 1.8, 10]} />
        <meshStandardMaterial color="#3a5440" roughness={0.95} metalness={0} />
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

      {/* Central dais. Convex-hull collider on the cylinder gives clean
         character step-on without the cuboid bounding weirdness. */}
      <RigidBody type="fixed" colliders="hull" name="arena-dais">
        <mesh position={[0, daisHeight / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[daisRadius, daisRadius, daisHeight, 48]} />
          <meshStandardMaterial color="#8b7860" roughness={0.8} metalness={0.05} />
        </mesh>
      </RigidBody>

      {/* Central tree — visible landmark + LOS breaker + destroyable 500 HP */}
      <CentralTree />

      {/* Shrines at cardinal compass points (breakable, 300 HP each). */}
      {SHRINES.map((s) => (
        <Prop key={s.name} def={s} color="#5c5c5c" />
      ))}

      {/* Standing stones at 45° offsets (unbreakable line-of-sight breakers). */}
      {STANDING_STONES.map((s) => (
        <Prop key={s.name} def={s} color="#4a5545" />
      ))}

      {/* Storm boundary — translucent pushback ring. Visible in Phase 2;
         force-and-damage wiring is Phase 3 match-state integration. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[stormRadius - 0.4, stormRadius, 96]} />
        <meshBasicMaterial color="#8aa2b5" transparent opacity={0.35} />
      </mesh>
      {/* Inner faint ring hinting at pickup-spawn radius for playtest feedback. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[6.5, 6.7, 64]} />
        <meshBasicMaterial color="#c9c4b7" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}
