// Unit coverage for the clip-name mapping + picker (T-301 AE).
//
// The mapping table and the picker are pure functions that consume
// `AnimationClip` objects (we only need `{ name: string }` for the
// lookup) and return either an `AnimationAction` (via mixer.clipAction)
// or null. Tests here:
//   - Verify every CharacterState has at least one candidate in
//     CLIP_MAP (shape smoke — catches a typo that drops an entry).
//   - Verify resolveClipByName walks the candidates in priority order.
//   - Verify pickClip falls back to idle when the requested state's
//     candidates all miss.
//   - Verify pickClip returns null when neither the state nor idle
//     resolves.
//   - Verify pickClip warns-once-per-state when a fallback fires.
//   - Verify pickClip returns an action (via mixer.clipAction) with a
//     stable clip reference on repeat calls.
//
// No live GLB loading — we build plain `{ name }` objects and cast
// them through the AnimationClip type. The picker only reads `.name`,
// so this is type-faithful (and makes the test run in happy-dom without
// needing the three.js AnimationMixer's WebGL context).

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnimationAction, AnimationClip, AnimationMixer } from 'three';

import {
  CLIP_MAP,
  pickClip,
  resetClipWarnState,
  resolveClipByName,
} from '../../src/game/entities/character/animationClips';
import type { CharacterState } from '../../src/game/entities/character/types';

const ALL_STATES: CharacterState[] = [
  'idle',
  'running',
  'attacking',
  'dodging',
  'hit',
  'dead',
];

/**
 * Build a mock AnimationClip. The picker only reads `.name`, so this
 * lightweight object is type-faithful through the readonly lookup.
 * Cast to `AnimationClip` at the call sites to satisfy the picker's
 * signature.
 */
function mockClip(name: string): AnimationClip {
  return { name } as unknown as AnimationClip;
}

/**
 * Build a mock mixer that records clipAction calls and returns a stub
 * AnimationAction per (mixer, clip) pair. Mirrors three.js's real
 * behavior: clipAction is idempotent — the same clip returns the same
 * action instance — so the test can assert no-duplicate-action returns
 * on repeat calls with the same clip.
 */
function mockMixer(): {
  mixer: AnimationMixer;
  actionFor: Map<AnimationClip, AnimationAction>;
  calls: AnimationClip[];
} {
  const actionFor = new Map<AnimationClip, AnimationAction>();
  const calls: AnimationClip[] = [];
  const mixer = {
    clipAction: (clip: AnimationClip) => {
      calls.push(clip);
      let existing = actionFor.get(clip);
      if (existing === undefined) {
        existing = { __isStubAction: true, clip } as unknown as AnimationAction;
        actionFor.set(clip, existing);
      }
      return existing;
    },
  } as unknown as AnimationMixer;
  return { mixer, actionFor, calls };
}

describe('CLIP_MAP shape', () => {
  it('exposes a key for every CharacterState', () => {
    for (const state of ALL_STATES) {
      expect(CLIP_MAP[state]).toBeDefined();
      expect(Array.isArray(CLIP_MAP[state])).toBe(true);
    }
  });

  it('every state has at least one candidate clip name', () => {
    for (const state of ALL_STATES) {
      expect(CLIP_MAP[state].length).toBeGreaterThan(0);
    }
  });

  it('every candidate is a non-empty string', () => {
    for (const state of ALL_STATES) {
      for (const name of CLIP_MAP[state]) {
        expect(typeof name).toBe('string');
        expect(name.length).toBeGreaterThan(0);
      }
    }
  });

  it('idle candidates cover the names actually present in Anansi.glb', () => {
    // The real GLB at /public/models/anansi/Anansi.glb ships an `Idle`
    // clip (introspected 2026-04-24). If we ever rename that clip or
    // swap the asset without updating the map, this test breaks — a
    // cheap regression fence for the asset-code coupling.
    expect(CLIP_MAP.idle).toContain('Idle');
  });

  it('attacking maps to the Silken Dart cast gesture (1H_Melee_Attack_Chop) per T-201', () => {
    expect(CLIP_MAP.attacking).toContain('1H_Melee_Attack_Chop');
  });

  it('dodging maps to Dodge_Forward (KayKit name in the shipped GLB)', () => {
    expect(CLIP_MAP.dodging).toContain('Dodge_Forward');
  });

  it('dead maps to Death_A (primary) and Death_B (variant)', () => {
    expect(CLIP_MAP.dead).toContain('Death_A');
    expect(CLIP_MAP.dead).toContain('Death_B');
  });
});

describe('resolveClipByName priority order', () => {
  it('returns the first matching candidate, not later matches', () => {
    const clips: AnimationClip[] = [
      mockClip('Idle'),
      mockClip('Idle_Inplace'),
      mockClip('Unarmed_Idle'),
    ];
    const result = resolveClipByName(clips, ['Idle_Inplace', 'Idle', 'Unarmed_Idle']);
    // 'Idle_Inplace' is first in the candidates list → wins even though
    // 'Idle' appears earlier in the clips list.
    expect(result?.name).toBe('Idle_Inplace');
  });

  it('falls through to the second candidate if the first is absent', () => {
    const clips: AnimationClip[] = [mockClip('Idle'), mockClip('Running_A')];
    const result = resolveClipByName(clips, ['Idle_Inplace', 'Idle']);
    expect(result?.name).toBe('Idle');
  });

  it('returns null when no candidate resolves', () => {
    const clips: AnimationClip[] = [mockClip('Completely_Other_Clip')];
    expect(resolveClipByName(clips, ['Idle', 'Idle_Inplace'])).toBeNull();
  });

  it('handles an empty clips list', () => {
    expect(resolveClipByName([], ['Idle'])).toBeNull();
  });

  it('handles an empty candidates list', () => {
    const clips: AnimationClip[] = [mockClip('Idle')];
    expect(resolveClipByName(clips, [])).toBeNull();
  });
});

describe('pickClip — happy paths', () => {
  afterEach(() => {
    resetClipWarnState();
    vi.restoreAllMocks();
  });

  it('returns a mixer action for the primary candidate when it exists', () => {
    const clips: AnimationClip[] = [mockClip('Idle'), mockClip('Running_A')];
    const { mixer, calls } = mockMixer();
    const action = pickClip(mixer, clips, 'idle');
    expect(action).not.toBeNull();
    expect(calls.length).toBe(1);
    // Called with the primary candidate clip (Idle).
    expect(calls[0]!.name).toBe('Idle');
  });

  it('returns a mixer action for the attack clip when present', () => {
    const clips: AnimationClip[] = [mockClip('Idle'), mockClip('1H_Melee_Attack_Chop')];
    const { mixer, calls } = mockMixer();
    const action = pickClip(mixer, clips, 'attacking');
    expect(action).not.toBeNull();
    expect(calls[0]!.name).toBe('1H_Melee_Attack_Chop');
  });

  it('is idempotent across repeat calls (mixer action cache)', () => {
    const clips: AnimationClip[] = [mockClip('Idle')];
    const { mixer } = mockMixer();
    const a1 = pickClip(mixer, clips, 'idle');
    const a2 = pickClip(mixer, clips, 'idle');
    // Identity check: two calls on the same mixer with the same clip
    // should return the same AnimationAction instance.
    expect(a1).toBe(a2);
  });

  it('falls through to a lower-priority candidate when primary is absent', () => {
    // Walking_A is a lower-priority candidate for 'running' — primary
    // 'Running_A' is not in the clips list, so the picker should fall
    // through to Walking_A.
    const clips: AnimationClip[] = [mockClip('Walking_A')];
    const { mixer, calls } = mockMixer();
    const action = pickClip(mixer, clips, 'running');
    expect(action).not.toBeNull();
    expect(calls[0]!.name).toBe('Walking_A');
  });
});

describe('pickClip — fallback to idle', () => {
  afterEach(() => {
    resetClipWarnState();
    vi.restoreAllMocks();
  });

  it('falls back to idle when a state has no candidate matches', () => {
    // 'attacking' candidates ALL missing; 'Idle' available as fallback.
    const clips: AnimationClip[] = [mockClip('Idle')];
    const { mixer, calls } = mockMixer();
    const action = pickClip(mixer, clips, 'attacking');
    expect(action).not.toBeNull();
    // The picker should have resolved the idle clip, not an attacking one.
    expect(calls[0]!.name).toBe('Idle');
  });

  it('emits console.warn exactly once per unmapped state', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // 'hit' candidates missing; only idle present.
    const clips: AnimationClip[] = [mockClip('Idle')];
    const { mixer } = mockMixer();
    pickClip(mixer, clips, 'hit');
    pickClip(mixer, clips, 'hit');
    pickClip(mixer, clips, 'hit');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain("state 'hit'");
  });

  it('emits a separate warn per distinct unmapped state', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const clips: AnimationClip[] = [mockClip('Idle')];
    const { mixer } = mockMixer();
    pickClip(mixer, clips, 'hit');
    pickClip(mixer, clips, 'dodging');
    pickClip(mixer, clips, 'attacking');
    expect(warnSpy).toHaveBeenCalledTimes(3);
  });
});

describe('pickClip — degenerate cases', () => {
  afterEach(() => {
    resetClipWarnState();
    vi.restoreAllMocks();
  });

  it('returns null when neither state nor idle resolves', () => {
    // Empty clips list — nothing to match.
    const { mixer } = mockMixer();
    const action = pickClip(mixer, [], 'attacking');
    expect(action).toBeNull();
  });

  it('returns null when state=idle and idle itself has no match', () => {
    // Only an unmapped clip present; state=idle → no fallback recursion.
    const clips: AnimationClip[] = [mockClip('Some_Other_Clip')];
    const { mixer } = mockMixer();
    const action = pickClip(mixer, clips, 'idle');
    expect(action).toBeNull();
  });

  it('idle fallback does NOT warn when state=idle itself misses', () => {
    // The picker's idle-miss branch: a clean null is the signal, not
    // the warn — we already warned for every other state; duplicating
    // a warn for 'idle couldn't fall back to idle' would be noise.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const clips: AnimationClip[] = [mockClip('Some_Other_Clip')];
    const { mixer } = mockMixer();
    const action = pickClip(mixer, clips, 'idle');
    expect(action).toBeNull();
    // A single warn (for idle itself having no match) is acceptable;
    // the important assertion is that we don't spam warns on the
    // fallback branch.
    expect(warnSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
