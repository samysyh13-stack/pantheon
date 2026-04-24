// Aim-direction computation with difficulty-scaled noise + prediction.
//
// The bot outputs the same InputFrame aim fields the human does: `aimX`
// and `aimY` are a 2D unit-ish vector in stick space, with magnitude in
// [0, 1]. `aimMagnitude` reflects commitment (released = 0, full push = 1).
//
// Determinism (ADR-0006):
//   - All noise draws go through `createRng(matchSeed + tick)`. Given the
//     same inputs, the returned aim vector is byte-identical run-to-run.
//   - No `Math.random`, no wall-clock. Prediction lead is `profile.aimLeadSec
//     * velocity` — the 0.2 s Hard lead is documented in `/docs/agents/T-105.md`.
//
// Coordinate convention (matches controller.ts, which flips stick Y → world -Z):
//   - `Vec2.x` maps to world +X
//   - `Vec2.y` maps to world -Z  (stick-up = forward = -Z)
//   So if the opponent is at world (+5, 0, +3) relative to self, the
//   self→opponent vector in world is (+5, -, +3); in stick space it is
//   (+5, -3). The caller provides positions in XY already mapped from
//   world XZ — see `types.ts` `Vec2` docstring.

import { createRng, type Rng } from '../../engine/random';
import type { BotWorldSnapshot, DifficultyProfile, Vec2 } from './types';

export interface AimResult {
  /** Unit-vector x component in stick space. */
  x: number;
  /** Unit-vector y component in stick space. */
  y: number;
  /** Magnitude in [0, 1]; 0 = not committed. */
  mag: number;
}

/**
 * Box-Muller draws a Gaussian sample from two uniform draws. We use this
 * for aim noise so the noise distribution is smooth (no hard edge like
 * uniform-in-disc). The `stdDev` is the profile's `aimNoiseRad`; at
 * stdDev=0.4 rad, ~99% of samples fall within ±1.2 rad — noisy enough
 * that Easy missed-shots feel credible.
 */
function gaussian(rng: Rng, stdDev: number): number {
  // u1 is drawn in (0, 1] so log is defined. rng.next returns [0, 1); flip.
  const u1 = 1 - rng.next();
  const u2 = rng.next();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * stdDev;
}

/**
 * Compute the aim vector from self → opponent, apply Hard's velocity lead,
 * then apply difficulty-scaled Gaussian angular noise.
 *
 * `matchSeed` is the bot's persistent seed (typically `BotConfig.seed`).
 * Combined with `snap.tick`, it keys the per-tick RNG so the noise is
 * byte-identical run-to-run (ADR-0006) and two bots with different seeds
 * do not draw identical noise.
 *
 * Returned magnitude is 1.0 when the opponent is "targeted" (distance > 0);
 * returns 0-mag when opponent is at the same position (nothing to aim at).
 */
export function computeAim(
  snap: BotWorldSnapshot,
  profile: DifficultyProfile,
  matchSeed: number,
): AimResult {
  const self = snap.self;
  const opp = snap.opponent;

  // 1) Predict opponent's position forward by profile.aimLeadSec. Hard uses
  //    0.2 s; Easy/Normal use 0. No clamp on velocity — the sim already caps
  //    movement speeds.
  const leadX = opp.pos.x + opp.lastKnownVelocity.x * profile.aimLeadSec;
  const leadY = opp.pos.y + opp.lastKnownVelocity.y * profile.aimLeadSec;

  const dx = leadX - self.pos.x;
  const dy = leadY - self.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) {
    return { x: 0, y: 0, mag: 0 };
  }

  // 2) Base aim direction. Uses atan2(x, y) convention so the returned
  //    vector maps directly into InputFrame.aimX / aimY (which the
  //    character controller consumes as stick-space x-right / y-up).
  const baseAngle = Math.atan2(dx, dy);

  // 3) Angular noise. Seed per-tick keyed by (matchSeed + tick) so
  //    determinism holds (ADR-0006). Zero-noise profiles skip the draw
  //    entirely — the RNG advance would otherwise be a measurable no-op.
  const noisyAngle =
    profile.aimNoiseRad > 0
      ? baseAngle + gaussian(createRng(matchSeed + snap.tick), profile.aimNoiseRad)
      : baseAngle;

  return {
    x: Math.sin(noisyAngle),
    y: Math.cos(noisyAngle),
    mag: 1,
  };
}

/** Convenience for tests — vector distance in XY plane. */
export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
