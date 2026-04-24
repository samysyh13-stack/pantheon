// Hard-difficulty Anansi behavior tree (T-105 AI).
//
// Design intent (DESIGN §5.1 + T-105 brief):
//   - Predicts player movement (leads shots): aimLeadSec = 0.2 s, applied
//     in `aim.ts::computeAim`.
//   - 95% aim accuracy — aimNoiseRad = 0.05 rad (≈ 2.9°).
//   - 100 ms reaction latency (very tight).
//   - Conserves ultimate for combos: only fires when opponent HP ≤ 40%
//     OR opponent is CC'd (profile.ultOpponentHpRatio = 0.4).
//   - Disengages when HP < 30%: dash + kite away to pick up a shard.
//
// Tree shape:
//
//   Root (Parallel, minSuccess=1)
//   ├── AimAtOpponent (with 0.2 s lead inside aim.ts)
//   ├── ReactionDodge     (if opponent mid-cast && reactionElapsed → dodge)
//   ├── AttackSelector
//   │     ├─ UltCombo    (fireUltimate; charge + (oppLow OR oppCC))
//   │     ├─ Ability     (fireAbility on cooldown)
//   │     └─ BasicAttack
//   └── MoveSelector
//         ├─ DisengageBranch  (if hpBelow(0.3)) → pressDodge + moveDisengage
//         └─ Approach         (default)

import { Parallel, Selector, Sequence, type BTNode, Condition } from '../behaviorTree';
import {
  aimAtOpponent,
  fireAbility,
  fireBasicAttack,
  fireUltimate,
  hpBelow,
  moveApproach,
  moveDisengage,
  opponentHpBelow,
  opponentIsCC,
  pressDodge,
  reactionElapsed,
} from './_common';

/**
 * Extra Hard-only gate: "opponent is combo-able" — either low HP or
 * currently CC'd. `fireUltimate()` already gates on HP via the profile's
 * `ultOpponentHpRatio`; we combine it here with a Selector so "CC'd"
 * is an equally-valid commit reason even at higher HP.
 */
const combo = () =>
  Selector(
    [opponentHpBelow(0.4), opponentIsCC()],
    'comboWindow',
  );

export function createHardTree(): BTNode {
  return Parallel(
    [
      aimAtOpponent(),

      // Reaction-dodge: if the opponent has been casting for >= reactionMs,
      // press dodge. Inside the 100 ms window on Hard this triggers ~6 ticks
      // after the opponent started casting.
      Sequence([reactionElapsed(), pressDodge()], 'reactiveDodge'),

      Selector(
        [
          Sequence([combo(), fireUltimate()], 'ultCombo'),
          fireAbility(),
          fireBasicAttack(),
        ],
        'hard-actions',
      ),

      Selector(
        [
          Sequence(
            [
              hpBelow(0.3),
              // Dash away first tick; move-disengage every subsequent tick.
              Selector([pressDodge(), Condition(() => true, 'always')], 'dashOrContinue'),
              moveDisengage(),
            ],
            'disengageWhenCritical',
          ),
          moveApproach(),
        ],
        'hard-move',
      ),
    ],
    1,
    'hard-root',
  );
}
