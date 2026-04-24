// Movement-direction computation (approach / strafe / kite / disengage).
//
// Returns a unit-ish vector in stick space (the same coordinate system
// `aim.ts` uses). The character controller maps stick-Y-up → world -Z, so
// sign conventions are the same as `aim.ts`:
//
//   - `Vec2.x` maps to world +X
//   - `Vec2.y` maps to world -Z
//
// All helpers return `{ x, y }` with `hypot(x, y) ≤ 1`. If the bot has no
// reason to move this tick, it returns `{ x: 0, y: 0 }` — the controller
// handles zero-input as "decelerate to rest".

import type { BotWorldSnapshot, Vec2 } from './types';

/** Strategic mode the movement layer executes. */
export type MoveMode = 'hold' | 'approach' | 'strafe' | 'kite' | 'disengage';

/** Unit planar vector from self → opponent. */
function unitTo(self: Vec2, target: Vec2): { x: number; y: number; mag: number } {
  const dx = target.x - self.x;
  const dy = target.y - self.y;
  const m = Math.hypot(dx, dy);
  if (m < 1e-6) return { x: 0, y: 0, mag: 0 };
  return { x: dx / m, y: dy / m, mag: m };
}

/**
 * Approach — close the gap to `preferredDistance` metres. Strafes out
 * once at or inside the preferred distance so the bot doesn't walk into
 * melee while holding a ranged profile. `strafeSign` is +1 or -1 and
 * picks which side to strafe on (callers flip it every few seconds to
 * create motion variety).
 */
export function approach(
  snap: BotWorldSnapshot,
  preferredDistance: number,
  strafeSign: 1 | -1,
): { x: number; y: number } {
  const u = unitTo(snap.self.pos, snap.opponent.pos);
  if (u.mag < 1e-6) return { x: 0, y: 0 };
  // Once inside preferred distance, blend into strafe; outside, move straight in.
  const gap = u.mag - preferredDistance;
  if (gap <= 0) {
    // Already at or inside preferred distance — strafe, don't push further in.
    return strafe(snap, strafeSign);
  }
  // Smooth blend: as we approach preferred distance, taper move magnitude so
  // the bot doesn't overshoot on the last tick. 1.5 m taper width.
  const taper = Math.min(1, gap / 1.5);
  return { x: u.x * taper, y: u.y * taper };
}

/**
 * Strafe perpendicular to the self→opponent axis. Used when the bot is
 * at preferred range and wants to present a moving target rather than
 * stand still.
 */
export function strafe(snap: BotWorldSnapshot, sign: 1 | -1): { x: number; y: number } {
  const u = unitTo(snap.self.pos, snap.opponent.pos);
  if (u.mag < 1e-6) return { x: 0, y: 0 };
  // Perpendicular to (u.x, u.y) in 2D is (-u.y, u.x). Sign picks the side.
  return { x: -u.y * sign, y: u.x * sign };
}

/**
 * Kite — move away from the opponent at full speed. Used when Normal
 * drops below `retreatHpRatio` HP; distinct from `disengage` (Hard) in
 * that the bot still faces the opponent to return fire while moving.
 */
export function kite(snap: BotWorldSnapshot): { x: number; y: number } {
  const u = unitTo(snap.self.pos, snap.opponent.pos);
  if (u.mag < 1e-6) return { x: 0, y: 0 };
  return { x: -u.x, y: -u.y };
}

/**
 * Disengage — move directly away from the opponent; caller typically
 * pairs this with a dodge edge to open gap faster (see Hard BT).
 */
export function disengage(snap: BotWorldSnapshot): { x: number; y: number } {
  return kite(snap);
}
