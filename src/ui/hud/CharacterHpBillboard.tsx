// Floating HP bar above each character (Brawl-Stars feel pass v1.0.1).
//
// Renders a small world-space billboard quad above the character's head.
// Updates each frame from a getter; auto-faces the camera. Color shifts:
//   - green at >60% HP
//   - amber at 30–60%
//   - red at <30%
// Hidden when at full HP (de-clutters the field).

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Color, type Group } from 'three';
import { Billboard } from '@react-three/drei';
import type { CharacterHandle } from '../../game/entities/character/Character';

const HP_GOOD = new Color('#4ade80');
const HP_WARN = new Color('#fbbf24');
const HP_CRIT = new Color('#ef4444');

const BAR_WIDTH = 1.0; // metres
const BAR_HEIGHT = 0.08;
const Y_OFFSET = 1.5; // above the head — capsule is 2.6 m total, head ~ 1.4 m

interface Props {
  target: React.RefObject<CharacterHandle | null>;
  /** Pure getter for current HP — usually `() => matchCtl.getHp(playerIndex)`. */
  getHp: () => number;
  maxHp: number;
  /** Hide the bar entirely when HP is at max — reduces clutter. */
  hideAtFull?: boolean;
}

export function CharacterHpBillboard({ target, getHp, maxHp, hideAtFull = true }: Props) {
  const groupRef = useRef<Group | null>(null);
  const fillRef = useRef<Group | null>(null);
  const colorRef = useRef(new Color(HP_GOOD.getHex()));

  useFrame(() => {
    const handle = target.current;
    const group = groupRef.current;
    const fill = fillRef.current;
    if (!handle || !group || !fill) return;

    const pos = handle.getWorldPosition();
    group.position.set(pos.x, pos.y + Y_OFFSET, pos.z);

    const hp = getHp();
    const ratio = Math.max(0, Math.min(1, hp / maxHp));

    // Hide-at-full
    if (hideAtFull && ratio >= 0.999) {
      group.visible = false;
      return;
    }
    group.visible = true;

    // Width scales with ratio; we lock the LEFT edge by translating the fill
    // group by -((1 - ratio) * width / 2). Cheap layout trick.
    fill.scale.x = ratio;
    fill.position.x = -((1 - ratio) * BAR_WIDTH) / 2;

    // Color tier
    const colorTarget =
      ratio >= 0.6 ? HP_GOOD : ratio >= 0.3 ? HP_WARN : HP_CRIT;
    colorRef.current.lerp(colorTarget, 0.2); // smooth transitions on damage
  });

  return (
    <Billboard ref={groupRef as unknown as React.Ref<Group>}>
      {/* Background bar (full width, dim) */}
      <mesh>
        <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
        <meshBasicMaterial color="#0a0e14" transparent opacity={0.85} />
      </mesh>
      {/* Border/outline */}
      <mesh position={[0, 0, -0.001]}>
        <planeGeometry args={[BAR_WIDTH + 0.04, BAR_HEIGHT + 0.04]} />
        <meshBasicMaterial color="#0a0e14" transparent opacity={0.6} />
      </mesh>
      {/* Fill (color, scales by HP ratio) */}
      <group ref={fillRef as unknown as React.Ref<Group>}>
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT * 0.7]} />
          <meshBasicMaterial color={colorRef.current} transparent opacity={0.95} />
        </mesh>
      </group>
    </Billboard>
  );
}
