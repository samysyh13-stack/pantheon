// Unit coverage for the Anansi bot (T-105 AI).
//
// The bot is a pure function of (BotWorldSnapshot, tick, seed). No React,
// no three.js, no Rapier, no wall clock — per ADR-0006. Tests drive it
// by hand-constructing snapshots and asserting the emitted InputFrame.
//
// Every `msToTicks` reference here is the bot's authoritative mapping
// (60 Hz per `src/game/engine/loop.ts`), so a loop-rate change would
// force us to update these expectations in lockstep.

import { describe, expect, it } from 'vitest';
import {
  createAnansiBot,
  DIFFICULTY_PROFILES,
  type BotConfig,
  type BotWorldSnapshot,
  type Vec2,
} from '../../src/game/systems/ai';
import { TICK_HZ } from '../../src/game/engine/loop';

// ── Helpers ─────────────────────────────────────────────────────────────

const msToTicks = (ms: number): number => Math.round((ms * TICK_HZ) / 1000);

function v(x: number, y: number): Vec2 {
  return { x, y };
}

interface SnapshotOpts {
  selfPos?: Vec2;
  oppPos?: Vec2;
  selfHp?: number;
  oppHp?: number;
  selfMaxHp?: number;
  oppMaxHp?: number;
  abilityCdMs?: number;
  ultCharge?: number;
  isDodging?: boolean;
  oppVel?: Vec2;
  oppCC?: boolean;
  castStartedAtTick?: number;
  tick: number;
}

function makeSnap(o: SnapshotOpts): BotWorldSnapshot {
  return {
    self: {
      pos: o.selfPos ?? v(0, 0),
      hp: o.selfHp ?? 320,
      maxHp: o.selfMaxHp ?? 320,
      abilityCdMs: o.abilityCdMs ?? 0,
      ultCharge: o.ultCharge ?? 0,
      isDodging: o.isDodging ?? false,
    },
    opponent: {
      pos: o.oppPos ?? v(10, 0),
      hp: o.oppHp ?? 320,
      maxHp: o.oppMaxHp ?? 320,
      lastKnownVelocity: o.oppVel ?? v(0, 0),
      ...(o.oppCC !== undefined ? { isCrowdControlled: o.oppCC } : {}),
      ...(o.castStartedAtTick !== undefined ? { castStartedAtTick: o.castStartedAtTick } : {}),
    },
    tick: o.tick,
    dt: 1 / TICK_HZ,
  };
}

const BASE_CONFIG = (difficulty: BotConfig['difficulty'], seed = 1337): BotConfig => ({
  difficulty,
  seed,
  playerIndex: 1,
  god: 'anansi',
});

// ── Tests ───────────────────────────────────────────────────────────────

describe('createAnansiBot — factory contract', () => {
  it('returns a BotInputSource with snapshot + update', () => {
    const bot = createAnansiBot(BASE_CONFIG('normal'));
    expect(typeof bot.snapshot).toBe('function');
    expect(typeof bot.update).toBe('function');
  });

  it('rejects non-Anansi god at construction', () => {
    // @ts-expect-error — typescript blocks this path; runtime also guards.
    expect(() => createAnansiBot({ ...BASE_CONFIG('normal'), god: 'brigid' })).toThrow();
  });

  it('snapshot before update returns a zeroed InputFrame (no undefined fields)', () => {
    const bot = createAnansiBot(BASE_CONFIG('normal'));
    const frame = bot.snapshot(1);
    expect(frame.moveX).toBe(0);
    expect(frame.moveY).toBe(0);
    expect(frame.basicAttack).toBe(false);
    expect(frame.ability).toBe(false);
    expect(frame.ultimate).toBe(false);
    expect(frame.dodge).toBe(false);
    expect(frame.playerIndex).toBe(1);
  });

  it('snapshot with the wrong playerIndex returns an empty frame (defensive)', () => {
    const bot = createAnansiBot(BASE_CONFIG('normal'));
    bot.update(makeSnap({ tick: 0 }));
    const frame = bot.snapshot(0); // wrong — bot is at index 1
    expect(frame.playerIndex).toBe(0);
    expect(frame.basicAttack).toBe(false);
  });
});

describe('Normal bot — ultimate policy', () => {
  it('does not press ultimate when charge < threshold (0.6)', () => {
    const bot = createAnansiBot(BASE_CONFIG('normal'));
    bot.update(makeSnap({ tick: 10, ultCharge: 0.5 }));
    expect(bot.snapshot(1).ultimate).toBe(false);
  });

  it('presses ultimate once charge ≥ threshold (0.6)', () => {
    const bot = createAnansiBot(BASE_CONFIG('normal'));
    bot.update(makeSnap({ tick: 10, ultCharge: 0.6, selfHp: 320 /* healthy */ }));
    expect(bot.snapshot(1).ultimate).toBe(true);
  });
});

describe('Easy bot — 200 ms telegraph pause', () => {
  it('does not fire basic attack within 200 ms of first update', () => {
    const bot = createAnansiBot(BASE_CONFIG('easy'));
    // Use a snapshot where ability/ult cannot take the selector slot.
    const baseSnap = (tick: number) =>
      makeSnap({ tick, abilityCdMs: 1000, ultCharge: 0.1, oppPos: v(8, 0) });

    // First tick — the telegraphElapsed condition latches its start here.
    bot.update(baseSnap(0));
    expect(bot.snapshot(1).basicAttack).toBe(false);

    // Halfway through the pause — still no fire.
    const half = Math.floor(msToTicks(DIFFICULTY_PROFILES.easy.telegraphMs) / 2);
    bot.update(baseSnap(half));
    expect(bot.snapshot(1).basicAttack).toBe(false);
  });

  it('fires once the 200 ms telegraph pause elapses', () => {
    const bot = createAnansiBot(BASE_CONFIG('easy'));
    // Ability CD and ult charge gated off for the whole run so the attack
    // branch is the only one that can succeed — otherwise fireAbility
    // would claim the selector slot and telegraphElapsed would never latch.
    bot.update(makeSnap({ tick: 0, abilityCdMs: 1000, ultCharge: 0.1, oppPos: v(8, 0) }));
    expect(bot.snapshot(1).basicAttack).toBe(false); // first tick latches start

    const after = msToTicks(DIFFICULTY_PROFILES.easy.telegraphMs) + 1;
    bot.update(
      makeSnap({ tick: after, abilityCdMs: 1000, ultCharge: 0.1, oppPos: v(8, 0) }),
    );
    expect(bot.snapshot(1).basicAttack).toBe(true);
  });
});

describe('Aim prediction — Hard leads opponent motion', () => {
  it('diverges from Normal when opponent velocity is non-zero', () => {
    // Stationary opponent, moving velocity: both bots aim the same (prediction
    // lead is 0.2 m offset; noise differs but with seed=0, we can subtract
    // noise by using many samples at the same tick and comparing means).

    // Simpler: use a single tick and a large velocity so the 0.2-s lead
    // dwarfs the Normal noise radius at that distance. Velocity perpendicular
    // to the line-of-sight is the cleanest signal.
    const snap: BotWorldSnapshot = makeSnap({
      tick: 0,
      selfPos: v(0, 0),
      oppPos: v(10, 0),
      oppVel: v(0, 20), // 20 m/s perpendicular — big enough lead
      ultCharge: 0, // no ult pressure
      abilityCdMs: 999,
    });

    const hard = createAnansiBot(BASE_CONFIG('hard'));
    const normal = createAnansiBot(BASE_CONFIG('normal'));
    hard.update(snap);
    normal.update(snap);

    const hardFrame = hard.snapshot(1);
    const normalFrame = normal.snapshot(1);

    // Both targeted something; both have mag ≈ 1.
    expect(hardFrame.aimMagnitude).toBeGreaterThan(0.9);
    expect(normalFrame.aimMagnitude).toBeGreaterThan(0.9);

    // Hard's aim should deviate in the +Y direction (the lead). The base
    // aim is roughly +X (sin = 1, cos = 0). After a 0.2 * 20 = 4 m +Y
    // lead on a 10 m baseline, the base angle shifts by atan(4/10) ≈
    // 0.38 rad. That's an order of magnitude larger than Hard's 0.05-rad
    // noise. The Normal bot has no lead, so Hard.aimY >> Normal.aimY.
    expect(hardFrame.aimY).toBeGreaterThan(normalFrame.aimY + 0.1);
  });
});

describe('Determinism — same seed + snapshot sequence yield identical frames', () => {
  it('two bots run in lockstep given identical inputs', () => {
    const snaps = Array.from({ length: 120 }, (_, t) =>
      makeSnap({
        tick: t,
        selfPos: v(0, 0),
        oppPos: v(6 + 0.1 * t, 0),
        oppVel: v(0.1, 0),
        ultCharge: Math.min(1, t / 100),
        abilityCdMs: t < 60 ? 500 : 0,
      }),
    );
    const a = createAnansiBot(BASE_CONFIG('hard', 42));
    const b = createAnansiBot(BASE_CONFIG('hard', 42));
    for (const s of snaps) {
      a.update(s);
      b.update(s);
      const fa = a.snapshot(1);
      const fb = b.snapshot(1);
      expect(fa.moveX).toBe(fb.moveX);
      expect(fa.moveY).toBe(fb.moveY);
      expect(fa.aimX).toBe(fb.aimX);
      expect(fa.aimY).toBe(fb.aimY);
      expect(fa.aimMagnitude).toBe(fb.aimMagnitude);
      expect(fa.basicAttack).toBe(fb.basicAttack);
      expect(fa.ability).toBe(fb.ability);
      expect(fa.ultimate).toBe(fb.ultimate);
      expect(fa.dodge).toBe(fb.dodge);
    }
  });

  it('different seeds produce different aim noise at non-trivial tick', () => {
    const snap = makeSnap({
      tick: 5,
      oppPos: v(10, 0),
      ultCharge: 0,
      abilityCdMs: 999,
    });
    const a = createAnansiBot(BASE_CONFIG('easy', 1));
    const b = createAnansiBot(BASE_CONFIG('easy', 2));
    a.update(snap);
    b.update(snap);
    const fa = a.snapshot(1);
    const fb = b.snapshot(1);
    // Easy has 0.4 rad noise — seed change should produce visibly
    // different aim vectors.
    expect(fa.aimX).not.toBe(fb.aimX);
  });
});

describe('Hard bot — disengage below 30% HP', () => {
  it('moveX/moveY point away from the opponent when HP < 30%', () => {
    const bot = createAnansiBot(BASE_CONFIG('hard'));
    // Opponent is at +X=10; self is at origin; self HP is 20% of max.
    bot.update(
      makeSnap({
        tick: 100,
        selfPos: v(0, 0),
        oppPos: v(10, 0),
        selfHp: 60,
        selfMaxHp: 320,
        ultCharge: 0,
        abilityCdMs: 999,
      }),
    );
    const frame = bot.snapshot(1);
    // "Away" from +X means moveX < 0.
    expect(frame.moveX).toBeLessThan(-0.5);
  });

  it('approaches when HP is above threshold', () => {
    const bot = createAnansiBot(BASE_CONFIG('hard'));
    bot.update(
      makeSnap({
        tick: 100,
        selfPos: v(0, 0),
        oppPos: v(10, 0),
        selfHp: 320,
        selfMaxHp: 320,
        ultCharge: 0,
        abilityCdMs: 999,
      }),
    );
    const frame = bot.snapshot(1);
    // Approaching +X means moveX > 0.
    expect(frame.moveX).toBeGreaterThan(0);
  });
});

describe('Aim noise — sampled variance matches difficulty spec', () => {
  // With a Gaussian noise of stdDev = sigma (radians), the variance of
  // the aim *angle* should be ~sigma^2. We sample 1000 ticks on a
  // stationary opponent at 10 m, compute atan2(aimX, aimY) residual
  // against the ground-truth angle (0 rad — pure +X), and check that
  // the sample stdDev is within ±20% of the spec value.

  function sampleStdDev(difficulty: BotConfig['difficulty'], samples: number): number {
    const bot = createAnansiBot(BASE_CONFIG(difficulty, 0xdeadbeef));
    const opp = v(10, 0);
    let sumSq = 0;
    let n = 0;
    for (let t = 0; t < samples; t++) {
      bot.update(
        makeSnap({
          tick: t,
          selfPos: v(0, 0),
          oppPos: opp,
          ultCharge: 0,
          abilityCdMs: 999,
        }),
      );
      const f = bot.snapshot(1);
      const angle = Math.atan2(f.aimX, f.aimY);
      // ground-truth angle = atan2(10, 0) = π/2
      const residual = angle - Math.PI / 2;
      sumSq += residual * residual;
      n++;
    }
    return Math.sqrt(sumSq / n);
  }

  it('easy is ~0.4 rad (±20%)', () => {
    const sd = sampleStdDev('easy', 1000);
    expect(sd).toBeGreaterThan(0.32);
    expect(sd).toBeLessThan(0.48);
  });

  it('normal is ~0.15 rad (±20%)', () => {
    const sd = sampleStdDev('normal', 1000);
    expect(sd).toBeGreaterThan(0.12);
    expect(sd).toBeLessThan(0.18);
  });

  it('hard is ~0.05 rad (±25%) — tighter spec, allow more slop at 1k samples', () => {
    const sd = sampleStdDev('hard', 1000);
    expect(sd).toBeGreaterThan(0.035);
    expect(sd).toBeLessThan(0.065);
  });
});

describe('Normal bot — kites when HP < 40%', () => {
  it('moves away from opponent when HP is low', () => {
    const bot = createAnansiBot(BASE_CONFIG('normal'));
    bot.update(
      makeSnap({
        tick: 50,
        selfPos: v(0, 0),
        oppPos: v(10, 0),
        selfHp: 100,
        selfMaxHp: 320, // ~31% → below 40% threshold
        ultCharge: 0,
        abilityCdMs: 999,
      }),
    );
    expect(bot.snapshot(1).moveX).toBeLessThan(-0.5);
  });

  it('approaches when HP is healthy', () => {
    const bot = createAnansiBot(BASE_CONFIG('normal'));
    bot.update(
      makeSnap({
        tick: 50,
        selfPos: v(0, 0),
        oppPos: v(10, 0),
        selfHp: 320,
        selfMaxHp: 320,
        ultCharge: 0,
        abilityCdMs: 999,
      }),
    );
    expect(bot.snapshot(1).moveX).toBeGreaterThan(0);
  });
});

describe('Normal bot — uses abilities on cooldown', () => {
  it('presses ability when CD is clear', () => {
    const bot = createAnansiBot(BASE_CONFIG('normal'));
    bot.update(
      makeSnap({
        tick: 10,
        abilityCdMs: 0,
        ultCharge: 0,
        oppPos: v(10, 0), // far — close-range post-pass stays quiet
      }),
    );
    expect(bot.snapshot(1).ability).toBe(true);
  });

  it('does not press ability while CD is non-zero', () => {
    const bot = createAnansiBot(BASE_CONFIG('normal'));
    bot.update(
      makeSnap({
        tick: 10,
        abilityCdMs: 2000,
        ultCharge: 0,
        oppPos: v(10, 0),
      }),
    );
    expect(bot.snapshot(1).ability).toBe(false);
  });
});

describe('Hard bot — combo-gated ultimate', () => {
  it('does NOT ult even at full charge when opponent is healthy and uncrowded', () => {
    const bot = createAnansiBot(BASE_CONFIG('hard'));
    bot.update(
      makeSnap({
        tick: 10,
        ultCharge: 1.0,
        oppHp: 320,
        oppMaxHp: 320, // 100% hp
        oppCC: false,
        oppPos: v(10, 0),
        abilityCdMs: 999,
      }),
    );
    expect(bot.snapshot(1).ultimate).toBe(false);
  });

  it('ults when opponent is CC-locked (combo window)', () => {
    const bot = createAnansiBot(BASE_CONFIG('hard'));
    bot.update(
      makeSnap({
        tick: 10,
        ultCharge: 1.0,
        oppHp: 320,
        oppMaxHp: 320,
        oppCC: true,
        oppPos: v(10, 0),
        abilityCdMs: 999,
      }),
    );
    expect(bot.snapshot(1).ultimate).toBe(true);
  });

  it('ults when opponent HP is below 40%', () => {
    const bot = createAnansiBot(BASE_CONFIG('hard'));
    bot.update(
      makeSnap({
        tick: 10,
        ultCharge: 1.0,
        oppHp: 100,
        oppMaxHp: 320, // 31%
        oppPos: v(10, 0),
        abilityCdMs: 999,
      }),
    );
    expect(bot.snapshot(1).ultimate).toBe(true);
  });
});
