// AI bot types (T-105 AI — Enemy AI Engineer).
//
// The bot sits at the same seam as the human InputManager: it produces an
// `InputFrame` per tick that `Character.tsx` consumes via its `inputSource`
// prop. The difference is that the bot does not read a keyboard, mouse, or
// gamepad — it reads a `BotWorldSnapshot` describing self / opponent state
// and decides which buttons to "press". Everything here is pure typing;
// the behavior lives in `./behaviorTree.ts`, `./aim.ts`, `./movement.ts`,
// `./difficulties/*`, and `./gods/*`.
//
// Determinism (ADR-0006):
//   - All decisions are a pure function of (snapshot, tick, seed). No wall
//     clock, no `Math.random`. Randomness goes through `createRng` seeded
//     per-tick (see `./aim.ts`).
//   - Reaction windows are measured in ticks, not milliseconds-from-now:
//     the orchestrator feeds a monotone `tick` counter in the snapshot.
//     Reaction latency converts ms → ticks at call time via `TICK_HZ`.
//   - The returned `InputFrame`'s `source` is `'gamepad'`. This is a
//     deliberate white lie: a bot is not wired to a device, but the
//     Character controller only reads `source` for HUD hinting and the
//     input manager never assigns a real gamepad to an AI slot, so
//     tagging bots as gamepad-shaped input keeps the downstream FSM
//     happy without inventing a 4th `InputSource` variant.

import type { InputFrame, PlayerIndex } from '../input';

/** Supported god keys for the bot factory. v1 ships only Anansi. */
export type BotGod = 'anansi';

/** Three tuned tiers per DESIGN §5.1 + ADR-0003. */
export type BotDifficulty = 'easy' | 'normal' | 'hard';

/**
 * 2-vector for planar world-space positions. World Y is "up" — movement and
 * aim are XZ. We alias both fields as { x, y } rather than { x, z } because
 * that is the shape of the 2D-projected stick space the input manager
 * produces and keeps the bot's math isomorphic to the human's.
 *
 * Consumers map:   world X → `x`
 *                  world Z → `y`  (negated when the consumer flips for
 *                                  forward = -Z; see character controller).
 */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Self-side state the bot reads to decide actions. `abilityCdMs` is the
 * time remaining on the signature ability cooldown (0 = ready). `ultCharge`
 * is in [0, 1] — fraction of the ultimate bar filled; the Anansi ult is
 * charged on damage dealt + received (DESIGN §6.1), but the bot does not
 * need to know the source, only the normalized fill.
 */
export interface BotSelfState {
  pos: Vec2;
  hp: number;
  maxHp: number;
  /** ms remaining on Silken Dart / signature ability (0 = ready). */
  abilityCdMs: number;
  /** Normalized ultimate charge, [0, 1]. */
  ultCharge: number;
  /** True during dodge i-frames — bot should not stack another dodge. */
  isDodging: boolean;
}

/**
 * Opponent-side state the bot reads. `lastKnownVelocity` is in m/s; Hard
 * difficulty uses it for prediction lead (see `aim.ts`). Normal / Easy
 * ignore it.
 */
export interface BotOpponentState {
  pos: Vec2;
  hp: number;
  maxHp: number;
  /** Opponent planar velocity (m/s) — used by Hard for prediction lead. */
  lastKnownVelocity: Vec2;
  /**
   * Optional cue that the opponent is currently crowd-controlled (stun /
   * silence). Hard reads this to decide when to fire the ultimate. Easy
   * and Normal ignore it. Optional because mid-v1 CC hooks are still
   * landing in Phase 2 combat — absent = assume free.
   */
  isCrowdControlled?: boolean;
  /**
   * Optional cue that the opponent is currently mid-cast of a telegraphed
   * ability. Easy/Normal use this as a reaction trigger (bot dodges N ms
   * after cast start). Absent = no active cast.
   */
  castStartedAtTick?: number;
}

/**
 * The world snapshot the orchestrator hands the bot each tick. `tick` is
 * the monotone fixed-tick counter (from `src/game/engine/loop.ts`). `dt`
 * is in seconds and is constant (1/60) inside the deterministic sim —
 * included for symmetry with the character controller's `update(input, dt)`
 * signature and to allow non-sim harnesses (tests) to pass a custom dt.
 */
export interface BotWorldSnapshot {
  self: BotSelfState;
  opponent: BotOpponentState;
  /** Current fixed-tick counter (monotone; 60 Hz). */
  tick: number;
  /** Seconds per tick (1/60 at runtime). */
  dt: number;
}

/**
 * Per-bot configuration. The factory ingests this once; difficulty and
 * seed are immutable for the bot's lifetime (a match cannot change
 * difficulty mid-round).
 */
export interface BotConfig {
  difficulty: BotDifficulty;
  /**
   * RNG seed root. The bot derives per-tick RNG via `createRng(seed + tick)`
   * — see `./aim.ts`. Same seed + same snapshot stream ⇒ identical
   * InputFrame stream (ADR-0006 determinism).
   */
  seed: number;
  /** Which player slot the bot occupies. Tagged into every emitted frame. */
  playerIndex: PlayerIndex;
  god: BotGod;
}

/**
 * The snapshot-style InputSource the bot exposes. The same shape
 * `Character.tsx` accepts — `snapshot(playerIndex)` returns the bot's
 * last-computed frame. `update(snapshot)` is the push channel the
 * orchestrator calls each sim tick with the latest world state; the bot
 * consumes that, runs its BT, and caches a new frame for the next
 * `snapshot(...)` read.
 */
export interface BotInputSource {
  snapshot(playerIndex: PlayerIndex): InputFrame;
  update(snapshot: BotWorldSnapshot): void;
}

/**
 * Per-difficulty tuning surface, resolved by `resolveDifficultyProfile`.
 * Keeping every knob visible here rather than scattered across files means
 * the tuning table itself is the spec — if a playtester says "Hard feels
 * too twitchy", we change one number here, not three branches in a BT.
 */
export interface DifficultyProfile {
  difficulty: BotDifficulty;
  /** Reaction window (ms) — opponent cast start → bot reacts. */
  reactionMs: number;
  /** Telegraph window (ms) — bot "thinks visibly" before committing. */
  telegraphMs: number;
  /** Aim noise radius in radians (Gaussian-ish via box-Muller from rng). */
  aimNoiseRad: number;
  /** Velocity-prediction lead, seconds. 0 = no lead. */
  aimLeadSec: number;
  /** Minimum ult charge to fire. Easy 0.8, Normal 0.6, Hard 0.4 + gating. */
  ultChargeThreshold: number;
  /** HP ratio at or below which the bot kites (Normal) or disengages (Hard). */
  retreatHpRatio: number;
  /** Only fire ult when opponent HP ratio is at or below this (Hard combo). */
  ultOpponentHpRatio: number;
  /** Desired engagement distance, metres. Anansi (ranged) ≈ 7 m. */
  preferredDistance: number;
}

/** Knobs table — authored here for readability; single source of tuning. */
export const DIFFICULTY_PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  easy: {
    difficulty: 'easy',
    reactionMs: 500,
    telegraphMs: 200,
    aimNoiseRad: 0.4, // ≈ 23°
    aimLeadSec: 0,
    ultChargeThreshold: 0.8,
    retreatHpRatio: 0, // easy never kites
    ultOpponentHpRatio: 1, // any HP
    preferredDistance: 7,
  },
  normal: {
    difficulty: 'normal',
    reactionMs: 250,
    telegraphMs: 0,
    aimNoiseRad: 0.15, // ≈ 8.6°
    aimLeadSec: 0,
    ultChargeThreshold: 0.6,
    retreatHpRatio: 0.4,
    ultOpponentHpRatio: 1,
    preferredDistance: 7,
  },
  hard: {
    difficulty: 'hard',
    reactionMs: 100,
    telegraphMs: 0,
    aimNoiseRad: 0.05, // ≈ 2.9°
    aimLeadSec: 0.2,
    ultChargeThreshold: 0.4,
    retreatHpRatio: 0.3,
    ultOpponentHpRatio: 0.4, // combo-only: opponent must be low-HP or CC'd
    preferredDistance: 7,
  },
};

export const resolveDifficultyProfile = (d: BotDifficulty): DifficultyProfile =>
  DIFFICULTY_PROFILES[d];
