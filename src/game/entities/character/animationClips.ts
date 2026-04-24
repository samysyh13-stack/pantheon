// Clip-name mapping for the KayKit Rogue Anansi placeholder (T-301 AE).
//
// Maps every `CharacterState` the FSM can produce (idle / running /
// attacking / dodging / hit / dead) to one or more candidate clip names
// in the GLB's baked animation list. The map is authored as a
// *prioritized fallback list* per state — the first name that resolves
// against the loaded GLB wins, and if none of the prioritized names
// match, `pickClip` falls back to the `idle` candidates (which must
// always resolve or we have a bad asset).
//
// Why fallback lists instead of a single name?
//   - The research doc at /docs/research/T-201-anansi-mesh.md pinned
//     canonical KayKit clip names (e.g. `Idle_Inplace`, `1H_Melee_Attack_Chop`)
//     from the Unity-facing asset review, but the GLB we actually shipped
//     uses a slightly different subset — e.g. `Idle` (no `_Inplace`),
//     `Running_A` (not `Run`), `Dodge_Forward` (not `Roll_Forward`).
//     Naming has drifted across KayKit pack revisions. A prioritized list
//     makes us robust to the drift without re-authoring code.
//   - If we later retarget different animation sources (Mixamo, Quaternius)
//     onto the same rig, the same map handles it — extend the candidate
//     lists, no call-site edits.
//
// Fallback policy in `pickClip`:
//   1. Walk the candidate list in order; return the first clip that
//      exists in the mixer's clip pool.
//   2. If nothing matches, warn once per (state) via the warn-de-dupe
//      set and fall back to the first resolvable `idle` candidate.
//   3. If even idle can't resolve, return null — the caller's tick loop
//      handles that by skipping the crossfade (the character freezes in
//      whatever pose the skeleton's bind is, which is a visible but
//      non-crash failure mode).
//
// ADR-0006 determinism: clip selection is pure (state + available names),
// no wall clock, no RNG. Two instances with the same seed hit the same
// clip name for the same FSM state on the same tick.

import type { AnimationAction, AnimationClip, AnimationMixer } from 'three';

import type { CharacterState } from './types';

/**
 * Prioritized candidate clip names per FSM state. The first name that
 * resolves against the loaded GLB wins. If none resolve, `pickClip`
 * falls back to the `idle` candidates (which MUST always resolve).
 *
 * Candidates documented against the actual Anansi.glb at
 * /public/models/anansi/Anansi.glb (introspected 2026-04-24):
 * clip names include `Idle`, `Running_A`, `Walking_A`, `Walking_B`,
 * `Walking_C`, `1H_Melee_Attack_Chop`, `Dodge_Forward`, `Hit_A`, `Hit_B`,
 * `Death_A`, `Death_B`. Research doc at /docs/research/T-201-anansi-mesh.md
 * predicted a slightly different naming convention (`Idle_Inplace`,
 * `Roll_Forward`) — the actual GLB uses the names below.
 */
export const CLIP_MAP: Record<CharacterState, readonly string[]> = {
  // Idle: the GLB ships a plain 'Idle' clip. `Idle_Inplace` / `Unarmed_Idle`
  // are kept as forward-compat candidates for the cases where we later
  // retarget onto a different KayKit revision or a Quaternius base.
  idle: ['Idle', 'Idle_Inplace', 'Unarmed_Idle', 'Idle_A'],
  // Running: `Running_A` is the primary loop; `Running_B` is a variant.
  // `Walking_A` / `Walking_B` / `Walking_C` / `Walk` are backups for
  // lower-energy locomotion if we later tune Anansi's move feel slower.
  running: ['Running_A', 'Running_B', 'Walking_A', 'Walking_B', 'Walking_C', 'Walk', 'Run'],
  // Attacking: Silken Dart is a *cast* gesture, not a sword swing, but
  // the KayKit pack doesn't ship a generic ranged cast clip — we reuse
  // `1H_Melee_Attack_Chop` for the full-body motion and hide any weapon
  // children on the skeleton. Spellcast_Shoot is the better match if
  // we later swap the rig for a caster-focused one; kept as fallback.
  attacking: [
    '1H_Melee_Attack_Chop',
    'Spellcast_Shoot',
    'Spellcast_Raise',
    '1H_Melee_Attack_Slice_Diagonal',
    '1H_Ranged_Shoot',
  ],
  // Dodging: `Dodge_Forward` is KayKit's forward dodge clip. `Roll_Forward`
  // is a KayKit Skeletons-pack naming variant; kept for forward-compat
  // if the asset gets swapped.
  dodging: ['Dodge_Forward', 'Roll_Forward', 'Dodge_Backward'],
  // Hit: `Hit_A` for the primary chest reaction; `Hit_B` is a variant.
  // `Hit_Chest` is the name we predicted in T-201; kept as fallback.
  hit: ['Hit_A', 'Hit_B', 'Hit_Chest', 'Block_Hit'],
  // Dead: `Death_A` is the active dying animation (falls to the ground);
  // `Death_B` is a variant. `Death_A_Pose` is the terminal frozen pose
  // — we prefer the active anim because the FSM doesn't auto-advance out
  // of `dead` so the pose hold comes from the clip's own tail-frame
  // behavior (clampWhenFinished handles that in the caller).
  dead: ['Death_A', 'Death_B', 'Death_A_Pose', 'Death_B_Pose'],
};

/**
 * Module-level set tracking which (state) keys have already warned about
 * an unresolvable clip. Keeps the log surface quiet even if the render
 * loop attempts the resolve every tick — one warn per dev session per
 * unmapped state is enough to surface the issue.
 */
const WARNED_STATES = new Set<CharacterState>();

/**
 * Reset the warn-de-dupe. Primarily for unit tests; not intended to be
 * called in production code. Keeps each test case's warn behavior
 * independent.
 */
export function resetClipWarnState(): void {
  WARNED_STATES.clear();
}

/**
 * Given a mixer (bound to a cloned skeleton root) and the full list of
 * `AnimationClip` objects available on the GLB, return the best-matching
 * `AnimationAction` for the requested FSM state — or null if no
 * candidate (nor the idle fallback) resolves.
 *
 * The returned action is created via `mixer.clipAction(clip)` which is
 * idempotent per (mixer, clip) pair: calling it twice with the same
 * clip returns the same cached action, so the crossfade / weight state
 * persists across calls. This is the standard three.js pattern — the
 * caller does NOT need to cache the returned action themselves.
 *
 * @param mixer the `AnimationMixer` bound to the per-instance cloned scene
 * @param clips the flat list of `AnimationClip` objects from the GLB
 * @param state the FSM state to resolve a clip for
 * @returns the resolved `AnimationAction`, or null if neither the
 *   state's candidates nor the idle fallback can be found in `clips`
 */
export function pickClip(
  mixer: AnimationMixer,
  clips: readonly AnimationClip[],
  state: CharacterState,
): AnimationAction | null {
  // Primary resolve: walk the state's candidate list.
  const primary = resolveClipByName(clips, CLIP_MAP[state]);
  if (primary !== null) {
    return mixer.clipAction(primary);
  }

  // Fallback: idle. Warn once per state so devs know the asset is
  // missing a clip. State === 'idle' branch: we warn once for 'idle'
  // itself and return null (there's nothing to fall back to).
  if (!WARNED_STATES.has(state)) {
    WARNED_STATES.add(state);
    console.warn(
      `[animationClips] no clip resolved for state '${state}' ` +
        `(candidates: ${CLIP_MAP[state].join(', ')}); falling back to idle`,
    );
  }

  if (state === 'idle') {
    // No further fallback — idle itself didn't resolve.
    return null;
  }

  const idleFallback = resolveClipByName(clips, CLIP_MAP.idle);
  if (idleFallback === null) return null;
  return mixer.clipAction(idleFallback);
}

/**
 * Walk `candidates` in order; return the first clip in `clips` whose
 * `name` matches. Pure helper, exported for tests that assert the
 * priority-order behavior without needing a live mixer.
 */
export function resolveClipByName(
  clips: readonly AnimationClip[],
  candidates: readonly string[],
): AnimationClip | null {
  for (const name of candidates) {
    const hit = clips.find((c) => c.name === name);
    if (hit !== undefined) return hit;
  }
  return null;
}
