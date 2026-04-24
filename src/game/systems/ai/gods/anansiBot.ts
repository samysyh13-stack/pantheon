// Anansi-specific bot composition (T-105 AI).
//
// Wraps the shared difficulty trees with Anansi kit knowledge — see
// `DESIGN_DOCUMENT.md §6.1`:
//   - Basic attack: Silken Dart (10 m range, 0.4 s fire rate → ~24 ticks).
//   - Signature: Mirror Thread (8 s cooldown). Placed defensively when the
//     opponent closes distance (distance < threshold).
//   - Ultimate: Eight-Strand Dome. Policy per-difficulty (Easy any-HP once
//     charged; Normal save when kiting; Hard combo-only).
//
// The factory returns a `BotInputSource`, which is compatible with
// `Character.tsx`'s `inputSource` prop (the structural `{ snapshot }` type).
// Consumers also call `update(snapshot)` each sim tick to refresh the
// internal InputFrame cache — see the integration notes at the end of
// `/docs/agents/T-105.md`.

import { createEmptyFrame, type InputFrame, type PlayerIndex } from '../../input';

import type {
  BotConfig,
  BotInputSource,
  BotWorldSnapshot,
} from '../types';
import { resolveDifficultyProfile } from '../types';
import {
  createBotRuntime,
  tickNode,
  type BotRuntime,
  type BTContext,
  type BTNode,
} from '../behaviorTree';
import { createEasyTree } from '../difficulties/easy';
import { createNormalTree } from '../difficulties/normal';
import { createHardTree } from '../difficulties/hard';
import { distance } from '../aim';
import { TICK_HZ } from '../../../engine/loop';

/**
 * Build the Anansi BT per difficulty. Wraps the generic difficulty tree
 * with Anansi-specific overrides in the *_common* helpers by passing
 * tuning numbers through the profile table — there is no kit-specific
 * BT node today because the ability / ult inputs are abstract in the
 * Character controller (the action is "press ability"; what the ability
 * *does* is T-100 scope).
 *
 * Why a switch over three trees rather than a parameterized single tree:
 *   - Per-difficulty tree shape differs (Easy adds telegraph pause; Hard
 *     adds react-dodge + combo gate). Attempting to build one tree with
 *     every branch gated behind `profile.difficulty === 'hard'` would be
 *     readable but denser; three trees is cheaper to reason about and
 *     matches the brief 1:1.
 */
function buildTree(difficulty: BotConfig['difficulty']): BTNode {
  switch (difficulty) {
    case 'easy':
      return createEasyTree();
    case 'normal':
      return createNormalTree();
    case 'hard':
      return createHardTree();
  }
}

/**
 * Anansi-specific close-range override: if the opponent is inside 3 m
 * (roughly melee range), pre-empt the normal attack sub-branch to drop
 * a Mirror Thread for misdirection. This is applied *after* the
 * difficulty tree writes the frame, so it can override the ability bit
 * when the condition is tight. Implemented as a post-pass rather than a
 * BT leaf because the logic is single-god-specific.
 */
const CLOSE_RANGE_METRES = 3.0;

function anansiPostPass(
  frame: InputFrame,
  snap: BotWorldSnapshot,
  bot: BotRuntime,
): void {
  // Mirror Thread on close: only if ability is ready AND we haven't just
  // used it (the LastAbilityFireTick guard prevents a double-press when
  // the BT also tried to fire ability this tick — we coalesce to one
  // press edge).
  if (
    distance(snap.self.pos, snap.opponent.pos) < CLOSE_RANGE_METRES &&
    snap.self.abilityCdMs <= 0 &&
    snap.tick - bot.lastAbilityFireTick > 1
  ) {
    frame.ability = true;
    bot.lastAbilityFireTick = snap.tick;
  }
}

export function createAnansiBot(config: BotConfig): BotInputSource {
  if (config.god !== 'anansi') {
    throw new Error(`createAnansiBot: expected god=anansi, got ${config.god}`);
  }
  const profile = resolveDifficultyProfile(config.difficulty);
  const tree = buildTree(config.difficulty);
  const bot = createBotRuntime();

  // Cached last-emitted frame. `snapshot()` returns this; `update(snap)`
  // recomputes it. If `snapshot()` is called before `update()` (edge case
  // at match-start), we hand back a zeroed frame so the character
  // controller stays idle.
  let cached: InputFrame = createEmptyFrame(config.playerIndex, 'gamepad');

  const update = (snap: BotWorldSnapshot): void => {
    // Build a fresh frame each tick rather than resetting the cached one
    // in-place: if a consumer held a reference to the previous `cached`
    // (shouldn't happen — contract is read-by-copy — but better safe),
    // they won't observe torn state.
    const frame = createEmptyFrame(config.playerIndex, 'gamepad');
    const ctx: BTContext = {
      snapshot: snap,
      profile,
      frame,
      rngSeed: config.seed,
      bot,
    };
    tickNode(tree, ctx);
    anansiPostPass(frame, snap, bot);
    cached = frame;
  };

  const snapshot = (playerIndex: PlayerIndex): InputFrame => {
    // Ignore the queried playerIndex if it doesn't match — the caller
    // (Character.tsx) always passes its own `playerIndex`, but if the
    // match harness inadvertently swaps, returning a zeroed frame is
    // safer than returning a frame tagged with the wrong index.
    if (playerIndex !== config.playerIndex) {
      return createEmptyFrame(playerIndex, 'gamepad');
    }
    return cached;
  };

  return { snapshot, update };
}

/**
 * Exported for tests / diagnostics. Not part of the public API, but keeps
 * the TICK_HZ import live for downstream harnesses that want to convert
 * ticks ↔ seconds without importing from `engine/loop` themselves.
 */
export const BOT_TICK_HZ = TICK_HZ;
