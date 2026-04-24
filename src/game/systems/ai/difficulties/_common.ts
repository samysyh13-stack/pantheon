// Shared BT leaf helpers used across easy / normal / hard trees.
//
// Each helper returns a ready-to-use `ActionNode` or `ConditionNode`. No
// state is held inside the closure itself — leaves read/write the per-bot
// `BotRuntime` carried on `BTContext.bot`. This keeps the factories
// idempotent: calling `aimAtOpponent()` twice doesn't create a second
// piece of state.

import { TICK_HZ } from '../../../engine/loop';
import { approach, disengage, kite, strafe } from '../movement';
import { computeAim } from '../aim';
import type { ActionNode, ConditionNode } from '../behaviorTree';
import { Action, Condition } from '../behaviorTree';

/** Convert milliseconds to an integer tick count (60 Hz). */
export const msToTicks = (ms: number): number => Math.round((ms * TICK_HZ) / 1000);

/**
 * Writes aim fields onto the frame, using `computeAim()` with the bot's
 * persistent seed (threaded via `rngSeed`). Always returns success so it
 * can slot into a sequence without gating it.
 */
export function aimAtOpponent(): ActionNode {
  return Action((ctx): 'success' => {
    const aim = computeAim(ctx.snapshot, ctx.profile, ctx.rngSeed);
    ctx.frame.aimX = aim.x;
    ctx.frame.aimY = aim.y;
    ctx.frame.aimMagnitude = aim.mag;
    return 'success';
  }, 'aimAtOpponent');
}

/**
 * Fires the basic attack (sets frame.basicAttack = true) if the
 * per-god fire-rate gate is clear. Uses `minIntervalTicks` (default 1 —
 * the controller handles rising-edge detection, so pressing every tick
 * would not produce extra attacks, but we throttle explicitly to avoid
 * button-mashing flicker on other consumers / HUD).
 */
export function fireBasicAttack(minIntervalTicks = 1): ActionNode {
  return Action((ctx): 'success' | 'failure' => {
    const tick = ctx.snapshot.tick;
    if (tick - ctx.bot.lastBasicFireTick < minIntervalTicks) return 'failure';
    ctx.frame.basicAttack = true;
    ctx.bot.lastBasicFireTick = tick;
    return 'success';
  }, 'fireBasicAttack');
}

/** Presses the signature ability when cooldown permits. */
export function fireAbility(): ActionNode {
  return Action((ctx): 'success' | 'failure' => {
    if (ctx.snapshot.self.abilityCdMs > 0) return 'failure';
    ctx.frame.ability = true;
    ctx.bot.lastAbilityFireTick = ctx.snapshot.tick;
    return 'success';
  }, 'fireAbility');
}

/**
 * Presses the ultimate if ult charge is ≥ the profile threshold. Does
 * NOT check opponent HP or CC here — those are composed by the caller as
 * sibling Conditions so Hard's combo-window logic (HP OR CC) can OR the
 * gates instead of AND-ing them with opponent HP.
 */
export function fireUltimate(): ActionNode {
  return Action((ctx): 'success' | 'failure' => {
    if (ctx.snapshot.self.ultCharge < ctx.profile.ultChargeThreshold) return 'failure';
    ctx.frame.ultimate = true;
    ctx.bot.lastUltimateFireTick = ctx.snapshot.tick;
    return 'success';
  }, 'fireUltimate');
}

/**
 * Press dodge once. Subject to self.isDodging guard (don't stack dodges).
 */
export function pressDodge(): ActionNode {
  return Action((ctx): 'success' | 'failure' => {
    if (ctx.snapshot.self.isDodging) return 'failure';
    ctx.frame.dodge = true;
    return 'success';
  }, 'pressDodge');
}

// ── Movement action leaves ─────────────────────────────────────────────

export function moveApproach(): ActionNode {
  return Action((ctx): 'success' => {
    // Flip strafe sign roughly every 1.5 s so the strafe inside approach
    // doesn't stall at a fixed side.
    const STRAFE_FLIP_TICKS = Math.round(1.5 * TICK_HZ);
    if (ctx.snapshot.tick - ctx.bot.lastStrafeFlipTick >= STRAFE_FLIP_TICKS) {
      ctx.bot.strafeSign = ctx.bot.strafeSign === 1 ? -1 : 1;
      ctx.bot.lastStrafeFlipTick = ctx.snapshot.tick;
    }
    const v = approach(ctx.snapshot, ctx.profile.preferredDistance, ctx.bot.strafeSign);
    ctx.frame.moveX = v.x;
    ctx.frame.moveY = v.y;
    return 'success';
  }, 'moveApproach');
}

export function moveStrafe(): ActionNode {
  return Action((ctx): 'success' => {
    const STRAFE_FLIP_TICKS = Math.round(1.5 * TICK_HZ);
    if (ctx.snapshot.tick - ctx.bot.lastStrafeFlipTick >= STRAFE_FLIP_TICKS) {
      ctx.bot.strafeSign = ctx.bot.strafeSign === 1 ? -1 : 1;
      ctx.bot.lastStrafeFlipTick = ctx.snapshot.tick;
    }
    const v = strafe(ctx.snapshot, ctx.bot.strafeSign);
    ctx.frame.moveX = v.x;
    ctx.frame.moveY = v.y;
    return 'success';
  }, 'moveStrafe');
}

export function moveKite(): ActionNode {
  return Action((ctx): 'success' => {
    const v = kite(ctx.snapshot);
    ctx.frame.moveX = v.x;
    ctx.frame.moveY = v.y;
    return 'success';
  }, 'moveKite');
}

export function moveDisengage(): ActionNode {
  return Action((ctx): 'success' => {
    const v = disengage(ctx.snapshot);
    ctx.frame.moveX = v.x;
    ctx.frame.moveY = v.y;
    return 'success';
  }, 'moveDisengage');
}

// ── Condition leaves ────────────────────────────────────────────────────

/** True iff self HP ratio is at or below `threshold`. */
export function hpBelow(threshold: number): ConditionNode {
  return Condition((ctx) => {
    const { hp, maxHp } = ctx.snapshot.self;
    return hp / Math.max(1, maxHp) <= threshold;
  }, `hpBelow(${threshold})`);
}

/** True iff opponent HP ratio is at or below `threshold`. */
export function opponentHpBelow(threshold: number): ConditionNode {
  return Condition((ctx) => {
    const { hp, maxHp } = ctx.snapshot.opponent;
    return hp / Math.max(1, maxHp) <= threshold;
  }, `opponentHpBelow(${threshold})`);
}

/** True iff opponent is currently crowd-controlled (stun / silence). */
export function opponentIsCC(): ConditionNode {
  return Condition(
    (ctx) => Boolean(ctx.snapshot.opponent.isCrowdControlled),
    'opponentIsCC',
  );
}

/**
 * Telegraph pause — succeeds only after `profile.telegraphMs` have elapsed
 * since `telegraphStartTick`. Used by Easy to "think visibly" before
 * first-attacking. The first call latches `telegraphStartTick`; subsequent
 * calls compare against it.
 */
export function telegraphElapsed(): ConditionNode {
  return Condition((ctx) => {
    const telegraphTicks = msToTicks(ctx.profile.telegraphMs);
    if (telegraphTicks <= 0) return true;
    if (ctx.bot.telegraphStartTick === -Infinity) {
      ctx.bot.telegraphStartTick = ctx.snapshot.tick;
      return false;
    }
    return ctx.snapshot.tick - ctx.bot.telegraphStartTick >= telegraphTicks;
  }, 'telegraphElapsed');
}

/**
 * Reaction-to-cast — succeeds only after `profile.reactionMs` have
 * elapsed since the opponent's cast-start tick. Used by Easy/Normal to
 * schedule a dodge N ms after the opponent commits to a telegraphed
 * ability.
 */
export function reactionElapsed(): ConditionNode {
  return Condition((ctx) => {
    const castStart = ctx.snapshot.opponent.castStartedAtTick;
    if (castStart === undefined) return false;
    const reactionTicks = msToTicks(ctx.profile.reactionMs);
    return ctx.snapshot.tick - castStart >= reactionTicks;
  }, 'reactionElapsed');
}
