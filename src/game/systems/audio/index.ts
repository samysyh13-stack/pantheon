// Audio system public surface for PANTHÉON (T-300).
//
// Consumers (UI, engine, VFX) import from here; the submodules are
// implementation detail. One entry-point, `initAudio()`, is called from
// App.tsx inside a `useEffect` on mount — browser autoplay policies
// require a user gesture for audio playback to resume, and mount is the
// earliest point where we can safely wire up the subscription and
// pre-warm the SFX bank.
//
// What initAudio() does (and deliberately does not do):
//   - Connects the store bridge so live Settings.audio mutations flow
//     into Howler and Tone.
//   - Lazy-initialises the Howler SFX bank (buffers decoded in the
//     background).
//   - Does NOT auto-start music. The menu screen decides when to call
//     startMusic() — e.g., after the first UI click on the landing page
//     so autoplay policies are satisfied.

import { initSfx } from './sfx';
import { connectAudioStoreBridge, type AudioBridgeHandle } from './store-bridge';

export type { SfxName, PlaySfxOptions } from './sfx';
export {
  playSfx,
  initSfx,
  disposeSfx,
  computeSfxVolume,
  getMixSnapshot as getSfxMixSnapshot,
  setVolumes as setSfxVolumes,
  setMono as setSfxMono,
  __resetSfxMixForTests,
} from './sfx';

export type { MusicLayer } from './music';
export {
  startMusic,
  stopMusic,
  setMusicLayer,
  disposeMusic,
  computeMusicGain,
  layerToFadeValue,
  getCurrentLayer,
  getMusicMixSnapshot,
  setVolumes as setMusicVolumes,
  __resetMusicMixForTests,
} from './music';

export type { AudioBridgeHandle } from './store-bridge';
export {
  connectAudioStoreBridge,
  useAudioStoreBridge,
  __resetStoreBridgeForTests,
} from './store-bridge';

// Track the active bootstrap so repeated initAudio() calls (e.g., Fast
// Refresh in dev) return the same handle rather than stacking multiple
// store subscriptions.
let bootstrap: AudioBridgeHandle | null = null;

// Single entry-point called by App.tsx. Safe to call multiple times —
// subsequent invocations are a no-op and hand back the same handle.
export function initAudio(): AudioBridgeHandle {
  if (bootstrap) return bootstrap;
  if (typeof window === 'undefined') {
    // SSR / node environment — return a stub handle so callers don't
    // branch on window themselves. The audio layers already feature-
    // detect internally.
    const stub: AudioBridgeHandle = {
      unsubscribe: () => {
        bootstrap = null;
      },
    };
    bootstrap = stub;
    return stub;
  }

  // Pre-warm the SFX bank. Music is deferred to first startMusic() call
  // to honour autoplay policies and to keep the initial-load audio cost
  // at just the four SFX one-shots (< 200 KB after CC0-original decode).
  initSfx();

  const handle = connectAudioStoreBridge();
  const wrapped: AudioBridgeHandle = {
    unsubscribe: () => {
      handle.unsubscribe();
      bootstrap = null;
    },
  };
  bootstrap = wrapped;
  return wrapped;
}

// Test / HMR hook. Releases the bootstrap singleton.
export function __resetAudioBootstrapForTests(): void {
  if (bootstrap) bootstrap.unsubscribe();
  bootstrap = null;
}
