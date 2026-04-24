// Normal-difficulty Anansi behavior tree (T-105 AI).
//
// Design intent (DESIGN §5.1 + T-105 brief):
//   - Uses abilities on cooldown (no hoarding).
//   - 80% aim accuracy — aimNoiseRad = 0.15 rad (≈ 8.6°).
//   - 250 ms reaction latency on opponent casts.
//   - Kites when HP < 40%: moves away from opponent, keeps firing,
//     saves ult.
//
// Tree shape:
//
//   Root (Parallel, minSuccess=1)
//   ├── AimAtOpponent
//   ├── AttackSelector
//   │     ├─ Ability            (fireAbility on cooldown)
//   │     ├─ Ultimate           (only when not kiting — save for aggressive phase)
//   │     └─ BasicAttack        (no telegraph)
//   └── MoveSelector
//         ├─ KiteBranch         (if hpBelow(retreatHpRatio)) → moveKite
//         └─ Approach           (default)

import { Parallel, Selector, Sequence, Inverter, type BTNode } from '../behaviorTree';
import {
  aimAtOpponent,
  fireAbility,
  fireBasicAttack,
  fireUltimate,
  hpBelow,
  moveApproach,
  moveKite,
} from './_common';

export function createNormalTree(): BTNode {
  // Attack layer is a Parallel (minSuccess=0 → never short-circuits): each
  // action's gate runs independently, so the bot can press ability + ult +
  // basic on the same tick if all three are ready. The InputFrame has one
  // bit per action, so concurrent presses are a free lunch.
  //
  // Basic attack sits behind an Inverter(fireAbility) sentinel? No —
  // aggregate: every leaf writes to its own InputFrame bit, no contention.
  return Parallel(
    [
      aimAtOpponent(),

      Parallel(
        [
          // Ability always goes on cooldown — keeps Mirror Thread on the
          // field for misdirection even while kiting.
          fireAbility(),

          // Ultimate only when *not* low HP — Normal "saves ult" when
          // retreating; the hpBelow inverter enforces that.
          Sequence(
            [Inverter(hpBelow(0.4), 'notLowHp'), fireUltimate()],
            'ultWhenHealthy',
          ),

          // Basic attack — no telegraph; every tick it's ready.
          fireBasicAttack(),
        ],
        0,
        'normal-actions',
      ),

      Selector(
        [
          Sequence([hpBelow(0.4), moveKite()], 'kiteWhenLow'),
          moveApproach(),
        ],
        'normal-move',
      ),
    ],
    1,
    'normal-root',
  );
}
