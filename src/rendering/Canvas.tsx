// PANTHÉON rendering canvas root.
// This file is intentionally a stub. T-002 (Rendering Specialist) will expand
// with the full postprocessing pipeline (outline + bloom + color grade + SSAO
// for desktop), stylized toon materials, HDRI environment loading, and the
// preset-driven graphics configuration described in /docs/ARCHITECTURE.md §9.

import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import type { GraphicsPreset } from '../state/store';
import { PRESETS, resolvePreset } from './presets';

interface Props {
  preset: GraphicsPreset;
}

export function GameCanvas({ preset }: Props) {
  const p = PRESETS[resolvePreset(preset)];
  return (
    <Canvas
      className="absolute inset-0"
      gl={{
        antialias: p.antialias,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
      }}
      dpr={p.dpr}
      shadows={p.shadows}
      camera={{ position: [0, 8, 12], fov: 45, near: 0.1, far: 200 }}
      frameloop="always"
    >
      <Suspense fallback={null}>
        <color attach="background" args={['#0f1218']} />
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[8, 12, 4]}
          intensity={1.2}
          castShadow={p.shadows}
          shadow-mapSize-width={p.shadowMapSize}
          shadow-mapSize-height={p.shadowMapSize}
        />
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#d4a24a" roughness={0.5} metalness={0.1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#233138" roughness={1} />
        </mesh>
      </Suspense>
    </Canvas>
  );
}
