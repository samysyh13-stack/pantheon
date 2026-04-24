// Easy-difficulty Anansi behavior tree (T-105 AI).
//
// Design intent (DESIGN §5.1 + T-105 brief):
//   - Telegraphs every action: 200 ms "thinking pause" before an action
//     fires. The `telegraphElapsed` condition gates every action sub-branch
//     (it's shared state on `ctx.bot.telegraphStartTick`, so the first
//     update latches the pause and subsequent updates clear it once the
//     window elapses).
//   - 60% aim accuracy — implemented as aimNoiseRad = 0.4 rad (≈ 23°).
//   - 500 ms reaction latency on opponent casts.
//   - Ultimate only when charge > 80% (profile.ultChargeThreshold = 0.8).
//   - Target selection: fixed to the single opponent in the snapshot
//     (1v1 mirror match; DESIGN §5.1 Duel mode).
//
// Tree shape (parallel: attack + move layers tick independently every
// frame — they write different InputFrame fields):
//
//   Root (Parallel, minSuccess=1)
//   ├── AimAtOpponent         (always sets aim)
//   ├── Sequence [telegraphElapsed → AttackSelector]
//   │     └─ Ultimate       (charge ≥ 0.8)
//   │     └─ Ability        (CD ready)
//   │     └─ BasicAttack
//   └── MoveApproach         (always — Easy never kites)

import { Parallel, Selector, Sequence, type BTNode } from '../behaviorTree';
import {
  aimAtOpponent,
  fireAbility,
  fireBasicAttack,
  fireUltimate,
  moveApproach,
  telegraphElapsed,
} from './_common';

/** Build the Easy tree. Pure construction — safe to call per-bot. */
export function createEasyTree(): BTNode {
  return Parallel(
    [
      aimAtOpponent(),

      // Pause 200 ms before ANY action fires. `telegraphElapsed` guards the
      // entire attack Selector, so all three choices (ult / ability / basic)
      // wait out the same telegraph window. The Selector inside picks the
      // highest-priority action for the tick.
      Sequence(
        [
          telegraphElapsed(),
          Selector(
            [
              fireUltimate(),
              fireAbility(),
              fireBasicAttack(),
            ],
            'easy-pick',
          ),
        ],
        'easy-attack-with-telegraph',
      ),

      // Always approach/strafe toward preferred range. Easy never kites.
      moveApproach(),
    ],
    1,
    'easy-root',
  );
}
