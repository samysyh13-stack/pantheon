// Unit coverage for the character animation FSM (T-004 AE).
//
// The FSM is pure: no React, no three.js, no Rapier. Tests drive it with
// explicit `tick(dt)` calls where dt is in seconds (matching the 60 Hz
// loop convention from /src/game/engine/loop.ts). Every ms value in the
// FSM's duration constants is mirrored here so a refactor that bumps a
// duration has to update both sides in lockstep (intentional friction).

import { describe, expect, it } from 'vitest';
import {
  ATTACK_DURATION_MS,
  DODGE_DURATION_MS,
  HIT_DURATION_MS,
  createAnimationFSM,
} from '../../src/game/entities/character/animationFSM';
import type { CharacterState } from '../../src/game/entities/character/types';

const DT = 1 / 60; // seconds per tick — matches loop.ts TICK_DT
const DT_MS = (DT * 1000) as number; // ~16.6667 ms

/** Advance the FSM by N ticks. */
function tickN(fsm: ReturnType<typeof createAnimationFSM>, n: number): void {
  for (let i = 0; i < n; i++) fsm.tick(DT);
}

/** True iff the dodge i-frame predicate would match this FSM state. */
function isIFrame(state: CharacterState): boolean {
  return state === 'dodging';
}

describe('animation FSM — duration constants are the authoritative source', () => {
  it('attack duration is 450 ms per DESIGN §4', () => {
    expect(ATTACK_DURATION_MS).toBe(450);
  });
  it('dodge duration is 300 ms per DESIGN §4', () => {
    expect(DODGE_DURATION_MS).toBe(300);
  });
  it('hit duration is 250 ms per AE brief', () => {
    expect(HIT_DURATION_MS).toBe(250);
  });
});

describe('animation FSM — initial state', () => {
  it('starts in idle with zero timeInState', () => {
    const fsm = createAnimationFSM();
    expect(fsm.current).toBe('idle');
    expect(fsm.timeInState).toBe(0);
  });
});

describe('animation FSM — velocity-driven idle <-> running', () => {
  // The FSM itself only consumes `transition()` calls; the Character
  // component (not tested here) observes velocity and calls
  // `transition('running')` / `transition('idle')`. These tests verify
  // the FSM accepts those transitions cleanly — the velocity threshold
  // is the caller's concern.

  it('idle -> running on transition request (velocity > 0 case)', () => {
    const fsm = createAnimationFSM();
    expect(fsm.transition('running')).toBe(true);
    expect(fsm.current).toBe('running');
    expect(fsm.timeInState).toBe(0);
  });

  it('running -> idle on transition request (velocity -> 0 case)', () => {
    const fsm = createAnimationFSM();
    fsm.transition('running');
    tickN(fsm, 10);
    expect(fsm.transition('idle')).toBe(true);
    expect(fsm.current).toBe('idle');
  });
});

describe('animation FSM — attacking', () => {
  it('idle -> attacking on basicAttack transition', () => {
    const fsm = createAnimationFSM();
    expect(fsm.transition('attacking')).toBe(true);
    expect(fsm.current).toBe('attacking');
    expect(fsm.timeInState).toBe(0);
  });

  it('attacking auto-transitions to idle after 450 ms (tested at 600 ms / 36 ticks)', () => {
    const fsm = createAnimationFSM();
    fsm.transition('attacking');
    expect(fsm.current).toBe('attacking');
    // 36 ticks * 16.67ms = 600ms > 450ms → auto-elapses to idle.
    tickN(fsm, 36);
    expect(fsm.current).toBe('idle');
  });

  it('attacking holds until its 450 ms budget elapses — 25 ticks (~417 ms) is still attacking', () => {
    const fsm = createAnimationFSM();
    fsm.transition('attacking');
    // 25 ticks * 16.67ms = ~416.67ms < 450ms → still attacking.
    tickN(fsm, 25);
    expect(fsm.current).toBe('attacking');
  });

  it('attacking can be cancelled into dodging (dodge-cancel tech)', () => {
    const fsm = createAnimationFSM();
    fsm.transition('attacking');
    tickN(fsm, 5); // ~83 ms in
    expect(fsm.transition('dodging')).toBe(true);
    expect(fsm.current).toBe('dodging');
    expect(fsm.timeInState).toBe(0);
  });

  it('attacking blocks player-initiated exits to idle/running (no self-cancel)', () => {
    const fsm = createAnimationFSM();
    fsm.transition('attacking');
    tickN(fsm, 3);
    // Attacker cannot self-cancel into idle before the 450 ms elapses.
    expect(fsm.transition('idle')).toBe(false);
    expect(fsm.transition('running')).toBe(false);
    expect(fsm.current).toBe('attacking');
  });
});

describe('animation FSM — dodging + i-frames', () => {
  it('transitioning to dodging sets state correctly', () => {
    const fsm = createAnimationFSM();
    fsm.transition('dodging');
    expect(fsm.current).toBe('dodging');
  });

  it('i-frame predicate is true ONLY during dodging\'s 300 ms', () => {
    const fsm = createAnimationFSM();
    // idle: no i-frames
    expect(isIFrame(fsm.current)).toBe(false);

    fsm.transition('dodging');
    expect(isIFrame(fsm.current)).toBe(true);

    // 15 ticks * 16.67ms = 250ms < 300ms → still dodging, still i-framed
    tickN(fsm, 15);
    expect(isIFrame(fsm.current)).toBe(true);

    // another 4 ticks (total 19 * 16.67ms = ~316ms > 300ms) → back to idle
    tickN(fsm, 4);
    expect(fsm.current).toBe('idle');
    expect(isIFrame(fsm.current)).toBe(false);
  });

  it('dodge auto-transitions to idle after 300 ms', () => {
    const fsm = createAnimationFSM();
    fsm.transition('dodging');
    // 20 ticks * 16.67ms = ~333ms > 300ms
    tickN(fsm, 20);
    expect(fsm.current).toBe('idle');
  });

  it('dodging cannot cancel into attacking (commits to i-frames)', () => {
    const fsm = createAnimationFSM();
    fsm.transition('dodging');
    expect(fsm.transition('attacking')).toBe(false);
    expect(fsm.current).toBe('dodging');
  });
});

describe('animation FSM — hit reaction', () => {
  it('hit interrupts attacking', () => {
    const fsm = createAnimationFSM();
    fsm.transition('attacking');
    tickN(fsm, 3);
    expect(fsm.transition('hit')).toBe(true);
    expect(fsm.current).toBe('hit');
  });

  it('hit auto-transitions to idle after 250 ms', () => {
    const fsm = createAnimationFSM();
    fsm.transition('hit');
    // 16 ticks * 16.67ms = ~267ms > 250ms
    tickN(fsm, 16);
    expect(fsm.current).toBe('idle');
  });

  it('hit cannot retrigger mid-hit (stun-lock guard)', () => {
    const fsm = createAnimationFSM();
    fsm.transition('hit');
    tickN(fsm, 3);
    const tAtAttempt = fsm.timeInState;
    expect(fsm.transition('hit')).toBe(false);
    // timeInState should not have reset
    expect(fsm.timeInState).toBe(tAtAttempt);
  });
});

describe('animation FSM — dead is terminal', () => {
  it('any state can transition to dead', () => {
    const states: CharacterState[] = ['idle', 'running', 'attacking', 'dodging', 'hit'];
    for (const s of states) {
      const fsm = createAnimationFSM();
      if (s !== 'idle') fsm.transition(s);
      expect(fsm.transition('dead')).toBe(true);
      expect(fsm.current).toBe('dead');
    }
  });

  it('dead rejects every transition (terminal)', () => {
    const fsm = createAnimationFSM();
    fsm.transition('dead');
    expect(fsm.transition('idle')).toBe(false);
    expect(fsm.transition('running')).toBe(false);
    expect(fsm.transition('attacking')).toBe(false);
    expect(fsm.transition('dodging')).toBe(false);
    expect(fsm.transition('hit')).toBe(false);
    expect(fsm.current).toBe('dead');
  });

  it('dead does not auto-transition on tick', () => {
    const fsm = createAnimationFSM();
    fsm.transition('dead');
    tickN(fsm, 1000);
    expect(fsm.current).toBe('dead');
  });
});

describe('animation FSM — timeInState accumulates correctly', () => {
  it('accumulates dt * 1000 per tick', () => {
    const fsm = createAnimationFSM();
    fsm.transition('running');
    expect(fsm.timeInState).toBe(0);
    fsm.tick(DT);
    expect(fsm.timeInState).toBeCloseTo(DT_MS, 4);
    fsm.tick(DT);
    expect(fsm.timeInState).toBeCloseTo(DT_MS * 2, 4);
    fsm.tick(DT);
    expect(fsm.timeInState).toBeCloseTo(DT_MS * 3, 4);
  });

  it('resets timeInState on transition', () => {
    const fsm = createAnimationFSM();
    fsm.transition('running');
    tickN(fsm, 10);
    expect(fsm.timeInState).toBeGreaterThan(0);
    fsm.transition('attacking');
    expect(fsm.timeInState).toBe(0);
  });

  it('ignores non-positive dt (defensive)', () => {
    const fsm = createAnimationFSM();
    fsm.transition('running');
    fsm.tick(0);
    fsm.tick(-0.5);
    expect(fsm.timeInState).toBe(0);
  });
});
