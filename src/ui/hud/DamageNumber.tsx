// Floating damage number — spawns at hit point, rises 1.2 m over 1 s,
// fades out. World-space billboard so it's always readable.
//
// Brawl-Stars-feel pass v1.0.1: this was DESIGN §13 toggleable, never
// actually wired in v1.0.0. MatchScene now spawns one per hit confirm.

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import type { Group } from 'three';

interface Props {
  origin: [number, number, number];
  value: number;
  /** 'incoming' = damage TO the player (red); 'outgoing' = damage TO the bot (gold). */
  flavor: 'incoming' | 'outgoing';
  durationSec?: number;
  riseMetres?: number;
  onExpire: () => void;
}

const COLORS = {
  incoming: '#ff5b5b',
  outgoing: '#ffd266',
} as const;

export function DamageNumber({
  origin,
  value,
  flavor,
  durationSec = 1.0,
  riseMetres = 1.2,
  onExpire,
}: Props) {
  const groupRef = useRef<Group | null>(null);
  const [opacity, setOpacity] = useState(1);
  const ageRef = useRef(0);
  const consumedRef = useRef(false);

  useEffect(() => {
    return () => {
      consumedRef.current = true;
    };
  }, []);

  useFrame((_state, dt) => {
    if (consumedRef.current) return;
    ageRef.current += dt;
    const t = ageRef.current / durationSec;
    if (t >= 1) {
      consumedRef.current = true;
      onExpire();
      return;
    }
    const g = groupRef.current;
    if (!g) return;
    g.position.set(
      origin[0],
      origin[1] + riseMetres * t,
      origin[2],
    );
    // Fade-in fast, fade-out slow (curve)
    const a = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    setOpacity(Math.max(0, Math.min(1, a)));
  });

  return (
    <Billboard ref={groupRef as unknown as React.Ref<Group>} position={origin}>
      <Text
        fontSize={0.45}
        color={COLORS[flavor]}
        outlineWidth={0.04}
        outlineColor="#0a0e14"
        anchorX="center"
        anchorY="middle"
        fillOpacity={opacity}
        outlineOpacity={opacity}
      >
        {flavor === 'incoming' ? `-${value}` : value.toString()}
      </Text>
    </Billboard>
  );
}
