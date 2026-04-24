// PANTHÉON rendering canvas root (T-002 RS).
//
// Configured R3F Canvas per the resolved preset. Hosts the postprocessing
// pipeline (outline + bloom + color grade + SSAO per preset), the tiered
// environment, and a temporary demo scene (cube + ground) so App.tsx
// continues to render something useful during Phase 1 smoke testing. The
// Phase 2 god/arena content replaces the demo scene; this file's export
// surface (`{ GameCanvas }` with a `preset: GraphicsPreset` prop) stays
// stable.
//
// Renderer selection (ADR-0001):
//   - WebGL2 default. Uses R3F's built-in WebGLRenderer wiring.
//   - WebGPU opt-in: when `settings.renderer === 'webgpu'` AND the browser
//     exposes `navigator.gpu`, we swap in three's WebGPURenderer from
//     `three/webgpu`. The brief's reference to "three-stdlib" is an error —
//     three-stdlib does NOT re-export WebGPURenderer; the canonical path is
//     `three/webgpu`. We lazy-import so the ~500 KB WebGPU+TSL payload is
//     only pulled when the setting is actually on.
//   - Note: `postprocessing` (pmndrs) is a WebGL2-only library at time of
//     writing. When WebGPU is active we skip the postprocessing EffectStack
//     and rely on the renderer's output color as-is. A follow-up ADR will
//     track the three PostProcessing (node-based) migration if WebGPU
//     adoption grows.
//
// Accessibility hooks (honored here and in composer.tsx):
//   - reducedMotion: softens bloom baseline (composer.tsx); also used by
//     combat feel in Phase 2 (hit-confirm flash suppression).
//   - highContrast: scales outline thickness by +40% in composer.tsx.
//   - colorblindMode: NOT handled in this pass — ADR-worthy material-level
//     swap reserved for the UX layer (T-0xx, Phase 2).

import { Canvas } from '@react-three/fiber';
import type { GLProps, Renderer } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Suspense, useMemo, type ReactNode } from 'react';
import { NoToneMapping, WebGLRenderer } from 'three';
import type { WebGLRendererParameters } from 'three';

import type { GraphicsPreset } from '../state/store';
import { useAppStore } from '../state/store';
import { resolvePreset, PRESETS } from './presets';
import type { PresetConfig } from './presets';
import { EffectStack } from './postprocessing/composer';
import { GameEnvironment } from './environment';

interface Props {
  preset: GraphicsPreset;
  /**
   * Scene content rendered inside the <Physics> tree. When absent, a
   * minimal demo scene (cube + ground) is shown instead — useful as a
   * menu backdrop and for Phase 1 smoke tests.
   */
  children?: ReactNode;
}

function DemoScene() {
  return (
    <>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d4a24a" roughness={0.5} metalness={0.1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#233138" roughness={1} />
      </mesh>
    </>
  );
}

/**
 * Builds a `gl` function compatible with R3F's CanvasProps['gl']. For
 * WebGL2, we construct WebGLRenderer directly from three. For WebGPU, we
 * dynamic-import `three/webgpu` and await `renderer.init()` before
 * returning. R3F's `GLProps` accepts either a synchronous or a Promise
 * return (since R3F v8), so the same factory slot serves both paths.
 */
function buildGlFactory(useWebGPU: boolean, antialias: boolean): GLProps {
  const webglParams = {
    antialias,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: false,
  } satisfies Partial<WebGLRendererParameters>;

  const factory = (defaultProps: {
    canvas: HTMLCanvasElement | OffscreenCanvas;
  }): Renderer | Promise<Renderer> => {
    if (!useWebGPU) {
      return new WebGLRenderer({
        canvas: defaultProps.canvas as HTMLCanvasElement,
        ...webglParams,
      });
    }
    return importWebGPURenderer(defaultProps.canvas as HTMLCanvasElement, antialias);
  };
  // R3F's GLProps union is awkward — narrow via cast so strict mode accepts.
  return factory as unknown as GLProps;
}

async function importWebGPURenderer(
  canvas: HTMLCanvasElement,
  antialias: boolean,
): Promise<Renderer> {
  const webgpu = await import('three/webgpu');
  const renderer = new webgpu.WebGPURenderer({
    canvas,
    antialias,
    powerPreference: 'high-performance',
  });
  await renderer.init();
  return renderer as unknown as Renderer;
}

export function GameCanvas({ preset, children }: Props) {
  const accessibility = useAppStore((s) => s.settings.accessibility);
  const rendererPref = useAppStore((s) => s.settings.renderer);

  const p: PresetConfig = PRESETS[resolvePreset(preset)];

  // WebGPU opt-in gate. navigator.gpu is the feature detect per ADR-0001.
  const useWebGPU =
    rendererPref === 'webgpu' &&
    typeof navigator !== 'undefined' &&
    'gpu' in navigator &&
    navigator.gpu !== undefined;

  const glFactory = useMemo(
    () => buildGlFactory(useWebGPU, p.antialias),
    [useWebGPU, p.antialias],
  );

  // When WebGPU is active, we don't wire the composer (the pmndrs
  // EffectComposer requires WebGLRenderer). Tone mapping falls back to
  // the renderer's default which is NoToneMapping — consistent with the
  // composer baking tone map into its final effect on the WebGL2 path.
  const useComposer = !useWebGPU;

  return (
    <Canvas
      className="absolute inset-0"
      gl={glFactory}
      dpr={p.dpr}
      shadows={p.shadows}
      camera={{ position: [0, 8, 12], fov: 45, near: 0.1, far: 200 }}
      frameloop="always"
      flat // disables R3F's default ACES tone mapping — composer owns it
      onCreated={(state) => {
        // Compositor owns tone mapping when enabled; either way ensure the
        // renderer isn't double-applying it.
        state.gl.toneMapping = NoToneMapping;
      }}
    >
      <Suspense fallback={null}>
        <color attach="background" args={['#0f1218']} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[8, 12, 4]}
          intensity={1.1}
          castShadow={p.shadows}
          shadow-mapSize-width={p.shadowMapSize}
          shadow-mapSize-height={p.shadowMapSize}
        />
        <GameEnvironment preset={p} />
        <Physics timeStep={1 / 60}>{children || <DemoScene />}</Physics>
      </Suspense>
      {useComposer && <EffectStack preset={p} accessibility={accessibility} />}
    </Canvas>
  );
}
