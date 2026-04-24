// Store → audio bridge for PANTHÉON (T-300).
//
// The audio systems (sfx.ts / music.ts) own plain module-scope state so
// they stay usable from non-React surfaces (combat tick, VFX impact,
// engine loop). This bridge is the *only* place that reads from the
// zustand store and pushes the derived mix values into the audio layers.
//
// Two surfaces:
//   - `connectAudioStoreBridge(store)` — imperative; called once from
//     initAudio() at app boot. Returns an `unsubscribe` to tear down.
//   - `useAudioStoreBridge()` — React hook equivalent for tests / HMR
//     scenarios where a component lifecycle owns the subscription.
//
// The bridge is idempotent: calling connect twice hands back the same
// unsubscribe token and does not double-subscribe.
//
// Store read path is strictly one-way — settings → audio. Audio NEVER
// writes to the store (per T-300 constraint: "audio reads settings,
// doesn't mutate").

import { useEffect } from 'react';
import { useAppStore } from '../../../state/store';
import type { AudioSettings } from '../../../state/store';
import { setVolumes as setSfxVolumes, setMono as setSfxMono } from './sfx';
import { setVolumes as setMusicVolumes } from './music';

export interface AudioBridgeHandle {
  unsubscribe: () => void;
}

// Track the live subscription so duplicate connect calls are a no-op.
let activeHandle: AudioBridgeHandle | null = null;

// Extract the fields we care about so diffing is stable and we don't
// fire downstream updates on unrelated settings changes (e.g., a graphics
// preset flip).
interface AudioMix {
  master: number;
  sfx: number;
  music: number;
  mono: boolean;
}

function pickMix(audio: AudioSettings): AudioMix {
  return {
    master: audio.master,
    sfx: audio.sfx,
    music: audio.music,
    mono: audio.mono,
  };
}

function applyMix(prev: AudioMix | null, next: AudioMix): void {
  if (prev === null || prev.master !== next.master || prev.sfx !== next.sfx) {
    setSfxVolumes(next.master, next.sfx);
  }
  if (prev === null || prev.master !== next.master || prev.music !== next.music) {
    setMusicVolumes(next.master, next.music);
  }
  if (prev === null || prev.mono !== next.mono) {
    setSfxMono(next.mono);
  }
}

// Imperative connect. Subscribes to the store and pushes an initial
// snapshot immediately so the audio layers are in sync the moment the
// bridge comes up.
export function connectAudioStoreBridge(): AudioBridgeHandle {
  if (activeHandle) return activeHandle;

  let prev: AudioMix | null = null;
  const pushSnapshot = () => {
    const next = pickMix(useAppStore.getState().settings.audio);
    applyMix(prev, next);
    prev = next;
  };

  pushSnapshot();

  const unsub = useAppStore.subscribe((state, prevState) => {
    // Zustand fires subscribe on every set() — filter to audio changes
    // only to avoid unnecessary work in the audio nodes.
    if (state.settings.audio === prevState.settings.audio) return;
    const next = pickMix(state.settings.audio);
    applyMix(prev, next);
    prev = next;
  });

  const handle: AudioBridgeHandle = {
    unsubscribe: () => {
      unsub();
      if (activeHandle === handle) activeHandle = null;
    },
  };
  activeHandle = handle;
  return handle;
}

// React-hook form. Mounts the bridge on render, tears it down on unmount.
// This is the shape App.tsx could use if it prefers effect-based wiring;
// today App.tsx calls `initAudio()` which uses the imperative form above.
export function useAudioStoreBridge(): void {
  const master = useAppStore((s) => s.settings.audio.master);
  const sfx = useAppStore((s) => s.settings.audio.sfx);
  const music = useAppStore((s) => s.settings.audio.music);
  const mono = useAppStore((s) => s.settings.audio.mono);

  useEffect(() => {
    setSfxVolumes(master, sfx);
    setMusicVolumes(master, music);
    setSfxMono(mono);
  }, [master, sfx, music, mono]);
}

// Test / HMR hook. Clears the singleton so a subsequent
// connectAudioStoreBridge() rebuilds from a clean slate.
export function __resetStoreBridgeForTests(): void {
  if (activeHandle) activeHandle.unsubscribe();
  activeHandle = null;
}
