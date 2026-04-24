// Howler.js SFX layer for PANTHÉON (T-300).
//
// Contracts:
//   - Pre-loads the four v1 SFX one-shots from /public/audio (see
//     /docs/LICENSES.md §5).
//   - Lazy-initialised on first playSfx call so browsers that block eager
//     audio graph allocation until a user gesture don't log warnings.
//   - Respects the store's Settings.audio.{master, sfx, mono}:
//       final volume  = clamp01(master * sfx * optVolume)
//       mono fallback = stereoPan(0) on every active sound id
//   - Exposes setVolumes()/setMono() surgical updaters so the store-bridge
//     effect can push live store changes into the audio graph.
//
// The Howl instances are kept behind a module-local registry rather than a
// class so the consumers (React components, combat tick, VFX impact) can
// call `playSfx('hit')` without threading a handle.

import { Howl } from 'howler';
import { logger } from '../../../utils/logger';

export type SfxName = 'ui_click' | 'hit' | 'whoosh' | 'whisper';

export interface PlaySfxOptions {
  // Per-call volume multiplier in [0, 1]. Final volume is
  // master × sfx × opts.volume, clamped to [0, 1].
  volume?: number;
  // Playback rate (pitch + speed). 1 = normal. Howler accepts any positive.
  rate?: number;
}

// Kept in module scope so volume updates applied while a sound is playing
// don't require re-reading the store synchronously from inside
// `playSfx`. Initialised by `initSfx()` and mutated by `setVolumes` /
// `setMono` from the store-bridge.
interface SfxMix {
  master: number;
  sfx: number;
  mono: boolean;
}

const defaultMix: SfxMix = { master: 1, sfx: 1, mono: false };
const mix: SfxMix = { ...defaultMix };

interface SfxEntry {
  readonly name: SfxName;
  readonly howl: Howl;
}

// Asset manifest — single source of truth for the SFX bank. Paths are
// absolute from the Vite public root (DESIGN §11, LICENSES §5).
const SFX_MANIFEST: ReadonlyArray<{ readonly name: SfxName; readonly src: string }> = [
  { name: 'ui_click', src: '/audio/sfx-ui-click.wav' },
  { name: 'hit', src: '/audio/sfx-hit-impact.ogg' },
  { name: 'whoosh', src: '/audio/sfx-anansi-whoosh.flac' },
  { name: 'whisper', src: '/audio/sfx-anansi-whisper.wav' },
];

let bank: Map<SfxName, SfxEntry> | null = null;
let initialised = false;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

// Compute the mixed volume in [0, 1] for a playSfx call, respecting the
// store's master × sfx buses and the caller's optional per-sound volume.
export function computeSfxVolume(
  masterVol: number,
  sfxVol: number,
  optVolume: number | undefined,
): number {
  const perCall = optVolume === undefined ? 1 : optVolume;
  return clamp01(masterVol * sfxVol * perCall);
}

// Re-exported for the store-bridge and for tests that want to drive the
// mix directly without a full Howl bank.
export function setVolumes(master: number, sfx: number): void {
  mix.master = clamp01(master);
  mix.sfx = clamp01(sfx);
}

export function setMono(mono: boolean): void {
  mix.mono = mono;
  if (!bank) return;
  // Apply to every active sound id of every loaded Howl — Howler's
  // stereo(0) forces both channels equal (mono-safe per DESIGN §11).
  // Future plays pick it up because playSfx re-applies stereo each play.
  for (const entry of bank.values()) {
    const active = readActiveIds(entry.howl);
    for (const id of active) entry.howl.stereo(mono ? 0 : 0, id);
  }
}

// Read-only surface for the store-bridge so it can reason about the live
// mix without poking module internals directly.
export function getMixSnapshot(): Readonly<SfxMix> {
  return { master: mix.master, sfx: mix.sfx, mono: mix.mono };
}

// Lazy bootstrap. Called implicitly on the first playSfx(); the public
// `initAudio()` (see ./index.ts) can also invoke it from a user-gesture
// effect if the caller wants to pre-warm the decoded buffers ahead of
// the first UI click.
export function initSfx(): void {
  if (initialised) return;
  initialised = true;

  if (typeof window === 'undefined') {
    // SSR / node test env without DOM — skip silently. The `hasAudio()`
    // guard in playSfx will short-circuit subsequent calls.
    bank = null;
    return;
  }

  const loaded = new Map<SfxName, SfxEntry>();
  for (const { name, src } of SFX_MANIFEST) {
    const howl = new Howl({
      src: [src],
      preload: true,
      // One-shots — no loop.
      loop: false,
      // Baseline howl volume; per-call volume is passed through play().
      volume: 1,
      onloaderror: (_id, err) => {
        logger.warn('audio/sfx', `failed to load ${name} (${src})`, err);
      },
      onplayerror: (_id, err) => {
        logger.warn('audio/sfx', `playback error on ${name}`, err);
      },
    });
    loaded.set(name, { name, howl });
  }
  bank = loaded;
}

// Plays a one-shot SFX. Safe to call from SSR / test envs without audio:
// returns a noop null id rather than throwing.
export function playSfx(name: SfxName, opts?: PlaySfxOptions): number | null {
  if (typeof window === 'undefined') return null;
  if (!initialised) initSfx();
  if (!bank) return null;

  const entry = bank.get(name);
  if (!entry) {
    logger.warn('audio/sfx', `unknown sfx name: ${name}`);
    return null;
  }

  const id = entry.howl.play();
  const vol = computeSfxVolume(mix.master, mix.sfx, opts?.volume);
  entry.howl.volume(vol, id);
  if (opts?.rate !== undefined) entry.howl.rate(opts.rate, id);
  // Mono fallback: pan = 0 places the voice dead-centre, balancing L/R
  // to equal level (DESIGN §13 accessibility mono audio).
  if (mix.mono) entry.howl.stereo(0, id);
  return id;
}

// Tear-down hook for hot-reload / test teardown.
export function disposeSfx(): void {
  if (bank) {
    for (const entry of bank.values()) entry.howl.unload();
    bank.clear();
  }
  bank = null;
  initialised = false;
  mix.master = defaultMix.master;
  mix.sfx = defaultMix.sfx;
  mix.mono = defaultMix.mono;
}

// Internal: Howler doesn't expose a typed "list all active ids" API; the
// canonical way is `playing()` per-id which requires having the ids in
// hand. We keep a best-effort accessor that reflects on the private
// `_sounds` field at runtime. Narrowed here so we don't leak `any`
// anywhere else in the codebase.
interface HowlSoundsInternal {
  _sounds?: ReadonlyArray<{ _id: number }>;
}
function readActiveIds(h: Howl): number[] {
  const sounds = (h as unknown as HowlSoundsInternal)._sounds;
  if (!sounds || sounds.length === 0) return [];
  return sounds.map((s) => s._id);
}

// Test-only reset hook. Unit tests that need a clean mix (see
// tests/unit/audio.test.ts) use this to avoid re-running disposeSfx's
// full bank unload and instead just reset the volume bus state.
export function __resetSfxMixForTests(): void {
  mix.master = defaultMix.master;
  mix.sfx = defaultMix.sfx;
  mix.mono = defaultMix.mono;
}
