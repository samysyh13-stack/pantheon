// Character animation state machine (T-004 AE).
//
// Deterministic, pure-TypeScript FSM covering the six `CharacterState`
// values. Time is tracked in milliseconds because:
//   * DESIGN_DOCUMENT §4 specifies durations in ms (450 ms attack, 300 ms
//     dodge, 250 ms hit reaction).
//   * The loop drives `tick(dt)` with dt in *seconds* (loop.ts TICK_DT =
//     1/60 = 0.01667 s), so we convert once at the boundary instead of
//     sprinkling `* 1000` through every caller.
//
// Interrupt rules (from /docs/AGENTS.md §3 AE brief):
//   - `attacking` can be cancelled into `dodging` (dodge-cancel is a
//     standard brawler tech; DESIGN §8 hit-confirm pipeline relies on
//     dodge-cancel to escape committed attacks).
//   - `hit` interrupts `attacking` (hit reactions always trump offensive
//     commitment — otherwise chain-CC feels bad).
//   - `dead` interrupts everything and is terminal (no transition out).
//   - Anything else is blocked by the time budget in the current state.
//
// Input handling note: `hit` and `dead` are externally triggered via
// `transition()` — the FSM does not consume InputFrame directly; the
// controller reads the InputFrame, decides actions (basicAttack edge,
// dodge), and calls `transition()` on the FSM. The FSM owns durations
// and veto-on-interrupt rules only.
//
// ADR-0006 determinism: no wall clock. tick() accepts dt; no Math.random;
// no Date.now / performance.now.

import type { CharacterState } from './types';

// Duration constants in milliseconds. Exported so tests and the controller
// can reference the single source of truth rather than redefine magic
// numbers.
export const ATTACK_DURATION_MS = 450;
export const DODGE_DURATION_MS = 300;
export const HIT_DURATION_MS = 250;

/**
 * State machine handle returned by `createAnimationFSM`. Callers read
 * `current` and `timeInState` (both reactive to `tick()` calls), request
 * transitions via `transition(to)`, and advance the time budget via
 * `tick(dt)` where dt is in seconds (matching the engine loop convention).
 */
export interface AnimationFSM {
  /** The current state. */
  readonly current: CharacterState;
  /** Accumulated time in the *current* state, in milliseconds. */
  readonly timeInState: number;
  /**
   * Request a transition. Returns `true` if the transition was applied,
   * `false` if the current state's interrupt rules rejected it. The
   * caller (controller) can use the return value to decide whether an
   * input edge was consumed — e.g., if `transition('attacking')` returns
   * false because the character is mid-dodge, the controller should NOT
   * swallow the basicAttack press (the player may re-buffer it).
   */
  transition: (to: CharacterState) => boolean;
  /**
   * Advance the time-in-state budget by dt seconds. If the budget elapses
   * and the current state has a natural resting transition (attacking →
   * idle; dodging → idle; hit → idle), fire that transition automatically.
   * `dead` is terminal and never auto-transitions.
   */
  tick: (dt: number) => void;
}

interface FSMInternal {
  state: CharacterState;
  timeInStateMs: number;
}

/**
 * Returns `true` if `next` is a legal transition from `prev` under the
 * interrupt rules. The veto-on-block policy here is what gives the FSM
 * its responsiveness:
 *
 *   dead   -> (nothing; terminal)
 *   hit    -> any state except… well, anything, since hit is short and
 *             the controller should not be re-entering hit from hit (the
 *             Phase 2 combat layer handles stacking via damage-queue, not
 *             FSM re-entry). For simplicity allow any transition out of
 *             hit; let time-budget auto-transition handle the common
 *             case.
 *   dodging   -> allowed: idle, running, dodging (re-entry rejected —
 *                 the dash cooldown is enforced by the controller, not
 *                 here). Cannot cancel mid-dodge into attacking (brawler
 *                 convention: dodge commits).
 *   attacking -> allowed: dodging (cancel), hit (external damage), dead,
 *                 idle/running ONLY via time-elapsed auto-transition
 *                 (not external). Player cannot self-cancel attack into
 *                 idle/running — that would drop combos.
 *   idle / running  -> free to transition to anything.
 */
function canTransition(prev: CharacterState, next: CharacterState): boolean {
  // Dead is terminal. Once dead, no transitions land.
  if (prev === 'dead') return false;

  // Dead interrupts every non-dead state.
  if (next === 'dead') return true;

  // Hit: short lock. External `hit` re-calls during hit are a no-op
  // (self-retrigger blocked to avoid clipping audio/visual effects).
  // This must be checked BEFORE the `next === 'hit'` universal-allow
  // below — otherwise a hit-spam would reset the FSM timer.
  if (prev === 'hit' && next === 'hit') return false;

  // Hit interrupts attacking (and idle/running/dodging, trivially).
  // Hit during dead already handled above. Dodging-to-hit is also
  // allowed (an i-frame miss still shouldn't stunlock, but Phase 2
  // combat will gate the damage application before calling transition
  // here — so if we reach this point we want the state change).
  if (next === 'hit') return true;

  // Attacking: dodge-cancel allowed; idle/running blocked (use tick() to
  // elapse); attacking re-entry blocked (no double-buffer — Phase 2
  // combo system will layer on top).
  if (prev === 'attacking') {
    if (next === 'dodging') return true;
    if (next === 'attacking') return false;
    // idle/running transitions from attacking only happen via auto
    // time-elapse.
    return false;
  }

  // Dodging: i-frames commit. The dodge cannot be cancelled into
  // attacking or back into dodging. Hit/dead are handled above and
  // short-circuit before this.
  if (prev === 'dodging') {
    if (next === 'attacking') return false;
    if (next === 'dodging') return false;
    // idle/running from dodging only via auto time-elapse; explicit
    // external transitions back to idle are permitted as an escape hatch
    // (e.g., round-reset).
    return next === 'idle' || next === 'running';
  }

  // From here prev ∈ { idle, running, hit } and next ∈ { idle, running,
  // attacking, dodging }. All allowed — idle/running have free movement,
  // and hit-to-any-non-hit is explicitly allowed by the interrupt rule.
  return true;
}

/**
 * Builds a fresh FSM. Initial state is `idle` with `timeInState = 0`.
 */
export function createAnimationFSM(): AnimationFSM {
  const self: FSMInternal = { state: 'idle', timeInStateMs: 0 };

  const transition = (to: CharacterState): boolean => {
    if (!canTransition(self.state, to)) return false;
    // No-op transition to the same state leaves timeInState alone — this
    // matters for the running <-> running case where the controller
    // updates velocity every tick but timeInState is a running total.
    if (self.state === to) return true;
    self.state = to;
    self.timeInStateMs = 0;
    return true;
  };

  const tick = (dt: number): void => {
    // Guard against NaN / negative dt defensively. The loop contract
    // (loop.ts) always feeds TICK_DT = 1/60, but tests and tooling might
    // pass odd values.
    if (!(dt > 0)) return;
    self.timeInStateMs += dt * 1000;

    // Auto time-elapse transitions. These fire only when the time budget
    // has run out; they bypass `canTransition` because the rules above
    // explicitly forbid some self-authored "I'm done" exits (e.g. attack
    // -> idle).
    switch (self.state) {
      case 'attacking':
        if (self.timeInStateMs >= ATTACK_DURATION_MS) {
          self.state = 'idle';
          self.timeInStateMs = 0;
        }
        break;
      case 'dodging':
        if (self.timeInStateMs >= DODGE_DURATION_MS) {
          self.state = 'idle';
          self.timeInStateMs = 0;
        }
        break;
      case 'hit':
        if (self.timeInStateMs >= HIT_DURATION_MS) {
          self.state = 'idle';
          self.timeInStateMs = 0;
        }
        break;
      // idle, running, dead: no time-budget-driven transitions. running
      // <-> idle is velocity-driven by the controller. dead is terminal.
      default:
        break;
    }
  };

  return {
    get current() {
      return self.state;
    },
    get timeInState() {
      return self.timeInStateMs;
    },
    transition,
    tick,
  };
}
