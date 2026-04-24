// Match state machine (T-303 orchestrator).
//
// Drives the Duel mode round loop per DESIGN §5.1:
//   - Best-of-three rounds. Each round 90 s.
//   - Both players spawn at opposite ends. First to reduce opponent to
//     0 HP wins the round.
//   - Draw at 90 s → higher-HP player wins.
//   - Tied HP → sudden-death (shrinking arena + all damage doubled) is
//     flagged for Phase 4 polish; v1 awards the round to the defender.
//
// Determinism (ADR-0006): all transitions are tick-indexed via the
// scheduler. No wall-clock, no Math.random.
//
// The store owns HUD-facing fields (score, timer, HP mirrors). This
// state machine pushes to the store on transitions; the store is the
// single source of truth for UI reads.

import { useAppStore } from '../../state/store';

export type MatchPhase = 'intro' | 'active' | 'round-end' | 'match-end';
export type MatchMode = 'duel' | 'totem_rush';

export interface RoundResult {
  winner: 0 | 1 | 'draw';
  playerHp: number;
  opponentHp: number;
  durationMs: number;
}

export interface MatchConfig {
  mode: MatchMode;
  roundDurationMs: number; // 90_000 for Duel
  roundsToWin: number; // 2 for best-of-3
  startingHp: number; // 320 for Anansi mirror
}

const DEFAULT_CONFIG: MatchConfig = {
  mode: 'duel',
  roundDurationMs: 90_000,
  roundsToWin: 2,
  startingHp: 320,
};

interface MatchRuntime {
  config: MatchConfig;
  phase: MatchPhase;
  round: number;
  playerHp: number;
  opponentHp: number;
  scoreP0: number;
  scoreP1: number;
  roundStartTick: number;
  currentTick: number;
}

export interface MatchController {
  start: () => void;
  tick: (dt: number) => void;
  applyDamage: (targetPlayerIndex: 0 | 1, dmg: number) => void;
  getPhase: () => MatchPhase;
  getRound: () => number;
  getScore: () => [number, number];
  getHp: (playerIndex: 0 | 1) => number;
  getMatchEndWinner: () => 0 | 1 | null;
  reset: () => void;
}

export function createMatchController(config: Partial<MatchConfig> = {}): MatchController {
  const cfg: MatchConfig = { ...DEFAULT_CONFIG, ...config };
  const rt: MatchRuntime = {
    config: cfg,
    phase: 'intro',
    round: 1,
    playerHp: cfg.startingHp,
    opponentHp: cfg.startingHp,
    scoreP0: 0,
    scoreP1: 0,
    roundStartTick: 0,
    currentTick: 0,
  };

  const syncHud = () => {
    const { setMatchHudState } = useAppStore.getState();
    const timerMs = Math.max(0, cfg.roundDurationMs - (rt.currentTick - rt.roundStartTick) * (1000 / 60));
    setMatchHudState({
      playerHp: rt.playerHp,
      playerMaxHp: cfg.startingHp,
      scoreP0: rt.scoreP0,
      scoreP1: rt.scoreP1,
      timerMs,
    });
  };

  const startRound = () => {
    rt.phase = 'active';
    rt.playerHp = cfg.startingHp;
    rt.opponentHp = cfg.startingHp;
    rt.roundStartTick = rt.currentTick;
    syncHud();
  };

  const endRound = (winner: 0 | 1 | 'draw') => {
    rt.phase = 'round-end';
    if (winner === 0) rt.scoreP0 += 1;
    else if (winner === 1) rt.scoreP1 += 1;
    syncHud();

    if (rt.scoreP0 >= cfg.roundsToWin || rt.scoreP1 >= cfg.roundsToWin) {
      rt.phase = 'match-end';
      // Phase 3 hook: orchestrator reads getMatchEndWinner() and flips
      // the store screen to 'results'.
      return;
    }

    // Queue next round after a short delay handled by orchestrator.
    rt.round += 1;
  };

  return {
    start() {
      rt.phase = 'intro';
      rt.round = 1;
      rt.scoreP0 = 0;
      rt.scoreP1 = 0;
      rt.currentTick = 0;
      rt.roundStartTick = 0;
      startRound();
    },

    tick(dt: number) {
      rt.currentTick += 1;
      if (rt.phase !== 'active') return;

      const elapsedMs = (rt.currentTick - rt.roundStartTick) * (1000 / 60);

      // Win-by-HP check.
      if (rt.playerHp <= 0 && rt.opponentHp <= 0) endRound('draw');
      else if (rt.playerHp <= 0) endRound(1);
      else if (rt.opponentHp <= 0) endRound(0);
      else if (elapsedMs >= cfg.roundDurationMs) {
        // Timeout — higher HP wins; tie awards defender (p0 by convention).
        if (rt.playerHp > rt.opponentHp) endRound(0);
        else if (rt.opponentHp > rt.playerHp) endRound(1);
        else endRound(0);
      } else {
        syncHud();
      }
      void dt; // dt reserved for future tick-rate-independent scaling
    },

    applyDamage(targetPlayerIndex, dmg) {
      if (rt.phase !== 'active') return;
      if (targetPlayerIndex === 0) rt.playerHp = Math.max(0, rt.playerHp - dmg);
      else rt.opponentHp = Math.max(0, rt.opponentHp - dmg);
      syncHud();
    },

    getPhase: () => rt.phase,
    getRound: () => rt.round,
    getScore: () => [rt.scoreP0, rt.scoreP1],
    getHp: (playerIndex) => (playerIndex === 0 ? rt.playerHp : rt.opponentHp),
    getMatchEndWinner: () => {
      if (rt.phase !== 'match-end') return null;
      return rt.scoreP0 > rt.scoreP1 ? 0 : 1;
    },

    reset() {
      rt.phase = 'intro';
      rt.round = 1;
      rt.scoreP0 = 0;
      rt.scoreP1 = 0;
      rt.playerHp = cfg.startingHp;
      rt.opponentHp = cfg.startingHp;
      rt.currentTick = 0;
      rt.roundStartTick = 0;
      syncHud();
    },
  };
}
