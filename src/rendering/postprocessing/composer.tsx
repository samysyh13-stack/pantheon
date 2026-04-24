// PANTHÉON post-processing composer (T-002 RS).
//
// Assembles the `postprocessing` (pmndrs) EffectComposer inside an R3F
// scene. This component is the React-side bridge that:
//
//   1. constructs an `EffectComposer` bound to the active WebGLRenderer
//   2. prepends a `RenderPass` of the main scene
//   3. conditionally attaches a `NormalPass` when SSAO is enabled
//   4. instantiates each enabled effect per /docs/ARCHITECTURE.md §9's
//      per-preset composition table
//   5. collapses them into a single `EffectPass` (one fullscreen draw
//      carrying every effect), which is how pmndrs recommends chaining
//      multiple `Effect`s
//   6. appends a `ToneMappingEffect` (ACES or Linear) last, so tone
//      mapping is the final color-space step in the pipeline
//   7. drives the composer via `useFrame` at priority 1 (overrides the
//      default R3F render) and disables automatic auto-render on the
//      renderer so we don't double-render each tick
//
// Because the tone mapping is baked into the composer's final effect, we
// deliberately set `gl.toneMapping = NoToneMapping` on the renderer — see
// Canvas.tsx's `flat` prop. This avoids a double tone-map.
//
// `@react-three/postprocessing` is NOT installed in this repo (see the
// T-002 brief). This component is the in-house replacement.
//
// All `postprocessing` types are consumed from the library directly; no
// `any` is used anywhere.

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  EffectComposer,
  EffectPass,
  NormalPass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import type { Effect } from 'postprocessing';
import { HalfFloatType } from 'three';
import type { Camera, Scene, Texture, WebGLRenderer } from 'three';

import type { PresetConfig } from '../presets';
import type { AccessibilitySettings } from '../../state/store';
import { createOutlineEffect } from './outline';
import { createBloomEffect } from './bloom';
import { createColorGradeEffect } from './colorGrade';
import { createSSAOEffect } from './ssao';

export interface EffectStackProps {
  preset: PresetConfig;
  accessibility: AccessibilitySettings;
}

// An Effect with a writable `normalBuffer`. `postprocessing`'s SSAOEffect
// exposes this slot at runtime, and we pass the NormalPass texture in.
type WithNormalBuffer = Effect & { normalBuffer: Texture | null };

/**
 * Builds the postprocessing EffectComposer for the given preset + a11y
 * settings. Returns the assembled composer AND the ordered list of
 * `Effect` instances so the caller can dispose them cleanly on unmount.
 */
function assembleComposer(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  preset: PresetConfig,
  accessibility: AccessibilitySettings,
): { composer: EffectComposer; disposeEffects: Effect[] } {
  const composer = new EffectComposer(renderer, {
    frameBufferType: HalfFloatType,
    multisampling: preset.antialias ? 4 : 0,
  });

  // Base scene render.
  composer.addPass(new RenderPass(scene, camera));

  // SSAO needs a normal buffer. We only instantiate when the preset
  // actually enables SSAO (Ultra tier only at T-002 time).
  let normalPass: NormalPass | null = null;
  if (preset.ssao) {
    normalPass = new NormalPass(scene, camera);
    composer.addPass(normalPass);
  }

  // Build the ordered effect chain honoring §9 table.
  const effects: Effect[] = [];

  // Outline first — silhouettes establish the cel look before color work.
  const outlineThickness = accessibility.highContrast
    ? preset.outlineThicknessPx * 1.4
    : preset.outlineThicknessPx;
  effects.push(createOutlineEffect(outlineThickness));

  // Bloom — gated on emissive luminance. Reduced motion suppresses
  // flashes at the combat layer (hit events); here we simply soften the
  // baseline intensity so the scene is visually calmer.
  if (preset.bloom) {
    const intensity = accessibility.reducedMotion ? 0.55 : 0.9;
    effects.push(createBloomEffect({ threshold: 0.9, intensity }));
  }

  // Color grade (LUT). Null lut = passthrough; real textures land in
  // Phase 2 (T-104 arena polish).
  if (preset.colorGrade) {
    effects.push(createColorGradeEffect(null));
  }

  // SSAO last of the conditional chain, then tone-map.
  if (preset.ssao && normalPass !== null) {
    const ssao = createSSAOEffect() as WithNormalBuffer;
    ssao.normalBuffer = normalPass.texture;
    effects.push(ssao);
  }

  // Tone map terminates the chain.
  const toneMapping = new ToneMappingEffect({
    mode: preset.tonemap === 'aces' ? ToneMappingMode.ACES_FILMIC : ToneMappingMode.LINEAR,
    whitePoint: 4.0,
    middleGrey: 0.6,
  });
  effects.push(toneMapping);

  composer.addPass(new EffectPass(camera, ...effects));

  return { composer, disposeEffects: effects };
}

export function EffectStack({ preset, accessibility }: EffectStackProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const { composer, disposeEffects } = useMemo(
    () => assembleComposer(gl, scene, camera, preset, accessibility),
    [gl, scene, camera, preset, accessibility],
  );

  // Keep composer sized to the canvas.
  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size.width, size.height]);

  // Dispose on unmount / preset change.
  useEffect(() => {
    return () => {
      for (const effect of disposeEffects) {
        effect.dispose();
      }
      composer.dispose();
    };
  }, [composer, disposeEffects]);

  // Drive the composer at priority 1 — this overrides R3F's default
  // render loop (priority 0). Returning out of this callback with
  // `composer.render(delta)` means R3F skips its own gl.render call.
  useFrame((_, delta) => {
    composer.render(delta);
  }, 1);

  return null;
}
