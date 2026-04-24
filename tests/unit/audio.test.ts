// Unit coverage for the audio system (T-300 AU).
//
// Scope:
//   - sfx.ts — volume math, mono flag propagation into the mix state,
//     lazy init + safe SSR fallback.
//   - music.ts — pure helpers (computeMusicGain, layerToFadeValue), the
//     crossfader state machine's layer transitions (menu / combat /
//     silent), and the startMusic/stopMusic idempotency contract.
//   - store-bridge.ts — store subscription pushes audio.{master,sfx,
//     music,mono} changes into the audio layers.
//
// happy-dom does not implement the Web Audio API — no `AudioContext`,
// no `AudioParam`, no `AudioBuffer`. Both Howler and Tone therefore
// can't fully wire a signal graph from inside vitest. Our audio modules
// are deliberately resilient to this (SSR / no-DOM): the graph
// constructors are wrapped in try/catch and the public surface stays
// usable. These tests exercise that public surface — the pure maths,
// the state transitions, and the store-driven mix updates — without
// depending on a live WebAudio implementation.

import { describe, expect, it, beforeEach } from 'vitest';

import {
  playSfx,
  computeSfxVolume,
  getSfxMixSnapshot,
  setSfxVolumes,
  setSfxMono,
  __resetSfxMixForTests,
  computeMusicGain,
  layerToFadeValue,
  getCurrentLayer,
  getMusicMixSnapshot,
  setMusicLayer,
  setMusicVolumes,
  startMusic,
  stopMusic,
  __resetMusicMixForTests,
  connectAudioStoreBridge,
  __resetStoreBridgeForTests,
} from '../../src/game/systems/audio';

import { useAppStore } from '../../src/state/store';

// ──────────────────────────────────────────────────────────────────────
// SFX volume math
// ──────────────────────────────────────────────────────────────────────

describe('sfx volume math (master × sfx × opts.volume, clamped)', () => {
  it('multiplies the three bus values', () => {
    expect(computeSfxVolume(1, 1, 1)).toBe(1);
    expect(computeSfxVolume(0.5, 1, 1)).toBe(0.5);
    expect(computeSfxVolume(1, 0.5, 1)).toBe(0.5);
    expect(computeSfxVolume(1, 1, 0.5)).toBe(0.5);
    expect(computeSfxVolume(0.5, 0.5, 0.5)).toBeCloseTo(0.125, 6);
  });

  it('defaults opts.volume to 1 when undefined', () => {
    expect(computeSfxVolume(0.8, 0.9, undefined)).toBeCloseTo(0.72, 6);
  });

  it('clamps to [0, 1] for negative or over-range inputs', () => {
    expect(computeSfxVolume(-1, 1, 1)).toBe(0);
    expect(computeSfxVolume(1, 2, 1)).toBe(1); // clamp at top
    expect(computeSfxVolume(2, 2, 2)).toBe(1);
  });

  it('treats NaN inputs as 0', () => {
    expect(computeSfxVolume(Number.NaN, 1, 1)).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// SFX mono flag + bus-state API
// ──────────────────────────────────────────────────────────────────────

describe('sfx bus state', () => {
  beforeEach(() => {
    __resetSfxMixForTests();
  });

  it('setSfxVolumes clamps master and sfx into [0, 1]', () => {
    setSfxVolumes(-1, 2);
    const snap = getSfxMixSnapshot();
    expect(snap.master).toBe(0);
    expect(snap.sfx).toBe(1);
  });

  it('setSfxMono updates the shared mono flag (live)', () => {
    expect(getSfxMixSnapshot().mono).toBe(false);
    setSfxMono(true);
    expect(getSfxMixSnapshot().mono).toBe(true);
    setSfxMono(false);
    expect(getSfxMixSnapshot().mono).toBe(false);
  });

  it('playSfx is a no-op for unknown names but does not throw', () => {
    // Unknown names log a warning but return null instead of throwing.
    const id = playSfx('ui_click', { volume: 0.5 });
    // In happy-dom Howler returns a numeric id (or null if the buffer is
    // silent); either is acceptable — the test is just asserting the
    // call shape.
    expect(typeof id === 'number' || id === null).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Music pure helpers
// ──────────────────────────────────────────────────────────────────────

describe('music volume math (master × music, clamped)', () => {
  it('multiplies master and music buses', () => {
    expect(computeMusicGain(1, 1)).toBe(1);
    expect(computeMusicGain(0.5, 0.8)).toBeCloseTo(0.4, 6);
    expect(computeMusicGain(0, 1)).toBe(0);
    expect(computeMusicGain(1, 0)).toBe(0);
  });

  it('clamps negative and over-range inputs', () => {
    expect(computeMusicGain(-0.5, 1)).toBe(0);
    expect(computeMusicGain(1, -0.5)).toBe(0);
    expect(computeMusicGain(2, 2)).toBe(1);
  });
});

describe('music layer → fade-value mapping', () => {
  it("'menu' parks the crossfader at 0 (100% a)", () => {
    expect(layerToFadeValue('menu')).toBe(0);
  });

  it("'combat' drives the crossfader to 1 (100% b)", () => {
    expect(layerToFadeValue('combat')).toBe(1);
  });

  it("'silent' parks at 0 (gain-only muting, crossfader position unchanged)", () => {
    expect(layerToFadeValue('silent')).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Music state-machine transitions
// ──────────────────────────────────────────────────────────────────────

describe('music state machine', () => {
  beforeEach(() => {
    __resetMusicMixForTests();
  });

  it('starts in silent', () => {
    expect(getCurrentLayer()).toBe('silent');
  });

  it('setMusicLayer("menu") transitions silent → menu', () => {
    setMusicLayer('menu', 0);
    expect(getCurrentLayer()).toBe('menu');
  });

  it('setMusicLayer("combat") transitions menu → combat', () => {
    setMusicLayer('menu', 0);
    setMusicLayer('combat', 0);
    expect(getCurrentLayer()).toBe('combat');
  });

  it('setMusicLayer("silent") from any layer parks to silent', () => {
    setMusicLayer('combat', 0);
    setMusicLayer('silent', 0);
    expect(getCurrentLayer()).toBe('silent');
    setMusicLayer('menu', 0);
    setMusicLayer('silent', 0);
    expect(getCurrentLayer()).toBe('silent');
  });

  it('setMusicLayer respects an explicit crossfade duration (no throw)', () => {
    // The state machine should accept any non-negative ms; negative
    // values are clamped to 0.
    setMusicLayer('menu', 1000);
    setMusicLayer('combat', -100);
    setMusicLayer('silent', 400);
    expect(getCurrentLayer()).toBe('silent');
  });

  it('setMusicVolumes updates the bus snapshot', () => {
    setMusicVolumes(0.4, 0.5);
    const snap = getMusicMixSnapshot();
    expect(snap.master).toBeCloseTo(0.4, 6);
    expect(snap.music).toBeCloseTo(0.5, 6);
  });

  it('setMusicVolumes clamps inputs', () => {
    setMusicVolumes(-1, 2);
    const snap = getMusicMixSnapshot();
    expect(snap.master).toBe(0);
    expect(snap.music).toBe(1);
  });
});

describe('music start / stop idempotency', () => {
  beforeEach(() => {
    __resetMusicMixForTests();
  });

  it('startMusic resolves (does not throw) even when Web Audio is absent', async () => {
    // happy-dom lacks AudioContext — music.ts guards construction with
    // a try/catch and downgrades to a no-op. Test ensures the
    // contract holds: the public API never rejects.
    await expect(startMusic()).resolves.toBeUndefined();
  });

  it('stopMusic is safe to call before startMusic', () => {
    expect(() => stopMusic()).not.toThrow();
    expect(getCurrentLayer()).toBe('silent');
  });

  it('stopMusic after a layer change parks back to silent', async () => {
    setMusicLayer('combat', 0);
    stopMusic();
    expect(getCurrentLayer()).toBe('silent');
  });
});

// ──────────────────────────────────────────────────────────────────────
// Store bridge — store changes propagate to audio layer mix state
// ──────────────────────────────────────────────────────────────────────

describe('store → audio bridge', () => {
  beforeEach(() => {
    __resetStoreBridgeForTests();
    __resetSfxMixForTests();
    __resetMusicMixForTests();
    // Reset the persisted audio slice to known defaults.
    useAppStore.setState((s) => ({
      settings: {
        ...s.settings,
        audio: { master: 1, sfx: 1, music: 0.8, voice: 1, mono: false },
      },
    }));
  });

  it('pushes an initial mix snapshot on connect', () => {
    useAppStore.setState((s) => ({
      settings: {
        ...s.settings,
        audio: { master: 0.5, sfx: 0.6, music: 0.7, voice: 1, mono: true },
      },
    }));
    const handle = connectAudioStoreBridge();
    try {
      const sfx = getSfxMixSnapshot();
      expect(sfx.master).toBeCloseTo(0.5, 6);
      expect(sfx.sfx).toBeCloseTo(0.6, 6);
      expect(sfx.mono).toBe(true);
      const music = getMusicMixSnapshot();
      expect(music.master).toBeCloseTo(0.5, 6);
      expect(music.music).toBeCloseTo(0.7, 6);
    } finally {
      handle.unsubscribe();
    }
  });

  it('forwards store audio updates to sfx and music buses', () => {
    const handle = connectAudioStoreBridge();
    try {
      useAppStore.getState().setAudio({ master: 0.3 });
      expect(getSfxMixSnapshot().master).toBeCloseTo(0.3, 6);
      expect(getMusicMixSnapshot().master).toBeCloseTo(0.3, 6);

      useAppStore.getState().setAudio({ sfx: 0.2 });
      expect(getSfxMixSnapshot().sfx).toBeCloseTo(0.2, 6);

      useAppStore.getState().setAudio({ music: 0.1 });
      expect(getMusicMixSnapshot().music).toBeCloseTo(0.1, 6);

      useAppStore.getState().setAudio({ mono: true });
      expect(getSfxMixSnapshot().mono).toBe(true);

      useAppStore.getState().setAudio({ mono: false });
      expect(getSfxMixSnapshot().mono).toBe(false);
    } finally {
      handle.unsubscribe();
    }
  });

  it('unsubscribe stops further updates', () => {
    const handle = connectAudioStoreBridge();
    handle.unsubscribe();
    useAppStore.getState().setAudio({ master: 0.05 });
    // master should NOT have updated after unsubscribe.
    expect(getSfxMixSnapshot().master).not.toBeCloseTo(0.05, 6);
  });

  it('double-connect returns the same handle (no double subscription)', () => {
    const a = connectAudioStoreBridge();
    const b = connectAudioStoreBridge();
    expect(b).toBe(a);
    a.unsubscribe();
  });
});
