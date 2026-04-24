// Tone.js two-layer adaptive music crossfader for PANTHÉON (T-300).
//
// Per DESIGN §11:
//   - Exploration (menu / ambient) layer: always playing while music is on.
//   - Combat layer: crosses in when combat heat rises.
//   - Transitions are Tone.CrossFade driven with 400 ms equal-power ramps.
//
// Signal graph:
//
//       [Player menu]  ── a ─┐
//                            ├─ Tone.CrossFade ── Gain (master) ── Destination
//       [Player combat] ── b ┘
//
// The Gain node after the crossfader lets us apply the store's
// (master × music) bus in linear units. We deliberately keep this out of
// Tone.Destination.volume so SFX (played via Howler on the separate
// WebAudio graph of howler's pooled AudioContext) don't get modulated by
// Tone's master. The two libs live on separate AudioContexts by default.
//
// Lazy-load behaviour:
//   - Construction of the Tone nodes happens on the first startMusic() call
//     so bundlers can tree-shake Tone until music is actually requested
//     and so the Tone AudioContext isn't created on page-load (browsers
//     would block it behind a user gesture anyway).
//   - After construction, node graph is retained for the session. stopMusic()
//     doesn't dispose — it just pauses playback. Reuse is cheaper than
//     re-allocating a full Tone chain.

import * as Tone from 'tone';
import { logger } from '../../../utils/logger';

export type MusicLayer = 'menu' | 'combat' | 'silent';

interface MusicMix {
  master: number;
  music: number;
}

const defaultMix: MusicMix = { master: 1, music: 0.8 };
const mix: MusicMix = { ...defaultMix };

// Tracks under /public/audio (see /docs/LICENSES.md §5).
const MENU_URL = '/audio/music-menu-ambient.ogg';
const COMBAT_URL = '/audio/music-combat.ogg';

// Crossfade defaults per DESIGN §11 ("400 ms ramps").
const DEFAULT_CROSSFADE_MS = 400;

interface MusicNodes {
  readonly menu: Tone.Player;
  readonly combat: Tone.Player;
  readonly crossFade: Tone.CrossFade;
  readonly gain: Tone.Gain;
}

let nodes: MusicNodes | null = null;
let currentLayer: MusicLayer = 'silent';
let started = false; // tracks whether players have been `.start()`-ed

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// Pure helper — exposed for tests and for reuse in store-bridge. Given the
// master and music bus values, compute the linear gain to apply to the
// crossfader's output.
export function computeMusicGain(masterVol: number, musicVol: number): number {
  return clamp01(masterVol) * clamp01(musicVol);
}

// Resolve the crossfader's target fade position for a given layer.
//   'menu'   → 0 (100% a)
//   'combat' → 1 (100% b)
//   'silent' → unchanged (handled by gain ramp elsewhere)
export function layerToFadeValue(layer: MusicLayer): number {
  if (layer === 'combat') return 1;
  return 0; // 'menu' or 'silent' both park the crossfader at 0
}

// Lazy constructor. Safe to call repeatedly — idempotent after the first.
function ensureNodes(): MusicNodes | null {
  if (nodes) return nodes;
  if (typeof window === 'undefined') return null;

  try {
    const menu = new Tone.Player({
      url: MENU_URL,
      loop: true,
      autostart: false,
      fadeIn: 0,
      fadeOut: 0,
    });
    const combat = new Tone.Player({
      url: COMBAT_URL,
      loop: true,
      autostart: false,
      fadeIn: 0,
      fadeOut: 0,
    });
    const crossFade = new Tone.CrossFade(0); // start at 'menu' side
    const gain = new Tone.Gain(computeMusicGain(mix.master, mix.music));

    menu.connect(crossFade.a);
    combat.connect(crossFade.b);
    crossFade.connect(gain);
    gain.toDestination();

    nodes = { menu, combat, crossFade, gain };
  } catch (err) {
    logger.warn('audio/music', 'failed to construct music graph', err);
    nodes = null;
  }
  return nodes;
}

export function setVolumes(master: number, music: number): void {
  mix.master = clamp01(master);
  mix.music = clamp01(music);
  if (!nodes) return;
  // When silent, don't push audio through at all (regardless of bus levels).
  const target = currentLayer === 'silent' ? 0 : computeMusicGain(mix.master, mix.music);
  // Tone's AudioParam-backed Gain takes a ramp duration in seconds.
  nodes.gain.gain.rampTo(target, 0.05);
}

export function getMusicMixSnapshot(): Readonly<MusicMix> {
  return { master: mix.master, music: mix.music };
}

export function getCurrentLayer(): MusicLayer {
  return currentLayer;
}

// Start the music layer. If already started this is a gain-only un-mute.
// Caller must have a user gesture in the call stack for Tone's underlying
// AudioContext to resume (see App.tsx initAudio() hook).
export async function startMusic(): Promise<void> {
  const n = ensureNodes();
  if (!n) return;

  // Tone.start() resumes the underlying AudioContext. Idempotent.
  try {
    await Tone.start();
  } catch (err) {
    logger.warn('audio/music', 'Tone.start() failed (no user gesture yet?)', err);
  }

  if (!started) {
    try {
      n.menu.start();
      n.combat.start();
    } catch (err) {
      // `.start()` throws if the buffer isn't loaded yet; Tone fires a
      // pending scheduled start once the buffer lands, so this is rarely
      // a real failure. Swallow and log.
      logger.debug('audio/music', 'player start deferred (buffer pending)', err);
    }
    started = true;
  }

  // If we were in 'silent' state, coming back up means re-applying the
  // mix to the post-crossfader gain.
  if (currentLayer === 'silent') {
    currentLayer = 'menu';
    n.crossFade.fade.value = layerToFadeValue('menu');
  }
  n.gain.gain.rampTo(computeMusicGain(mix.master, mix.music), 0.05);
}

// Pause all music playback and zero the post-crossfader gain. Nodes are
// kept for a future startMusic().
export function stopMusic(): void {
  if (!nodes) {
    currentLayer = 'silent';
    return;
  }
  nodes.gain.gain.rampTo(0, 0.05);
  try {
    if (started) {
      nodes.menu.stop();
      nodes.combat.stop();
    }
  } catch (err) {
    logger.debug('audio/music', 'stop during pending start — safe to ignore', err);
  }
  started = false;
  currentLayer = 'silent';
}

// Transition to a target layer over `crossfadeMs` milliseconds. The ramp
// is an equal-power crossfade (Tone.CrossFade default) which sounds
// natural on most source pairs.
//
// 'silent' fades the post-crossfader gain to zero; the two players keep
// running at silent gain so a later transition back to 'menu' or
// 'combat' can resume without a stitch.
export function setMusicLayer(
  layer: MusicLayer,
  crossfadeMs: number = DEFAULT_CROSSFADE_MS,
): void {
  const n = ensureNodes();
  if (!n) {
    currentLayer = layer;
    return;
  }
  const seconds = Math.max(0, crossfadeMs) / 1000;

  if (layer === 'silent') {
    n.gain.gain.rampTo(0, seconds);
    currentLayer = 'silent';
    return;
  }

  // Coming out of silent: first restore the master gain, then slide the
  // crossfader. Both ramps are the same duration so they land together.
  const targetGain = computeMusicGain(mix.master, mix.music);
  n.gain.gain.rampTo(targetGain, seconds);
  n.crossFade.fade.rampTo(layerToFadeValue(layer), seconds);
  currentLayer = layer;
}

// Tear-down hook for hot-reload / tests. Disposes the entire Tone graph.
export function disposeMusic(): void {
  if (nodes) {
    try {
      if (started) {
        nodes.menu.stop();
        nodes.combat.stop();
      }
    } catch {
      /* ignore — disposal path */
    }
    nodes.menu.dispose();
    nodes.combat.dispose();
    nodes.crossFade.dispose();
    nodes.gain.dispose();
  }
  nodes = null;
  started = false;
  currentLayer = 'silent';
  mix.master = defaultMix.master;
  mix.music = defaultMix.music;
}

// Test hook — resets just the bus state without rebuilding the graph.
export function __resetMusicMixForTests(): void {
  mix.master = defaultMix.master;
  mix.music = defaultMix.music;
  currentLayer = 'silent';
  started = false;
}
