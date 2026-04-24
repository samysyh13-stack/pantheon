// Score row — two pills on opposite top corners. For Duel mode this
// displays the best-of-three round tally; for Totem Rush it'd be
// cumulative-totem-seconds (mode-aware display is Phase 2 T-106 wiring).

import { useAppStore } from '../../state/store';

export function ScoreBar() {
  const p0 = useAppStore((s) => s.match.scoreP0);
  const p1 = useAppStore((s) => s.match.scoreP1);

  return (
    <>
      <div
        className="safe-top pointer-events-none absolute right-4 top-16 flex items-center gap-2 rounded-md bg-black/50 px-3 py-1 text-sm text-[color:var(--panth-ink)]"
        aria-label={`You: ${p0} points`}
      >
        <span className="text-[color:var(--panth-accent-gold)]">●</span>
        <span>You</span>
        <span className="font-mono tabular-nums">{p0}</span>
      </div>
      <div
        className="safe-top pointer-events-none absolute left-[18rem] top-16 flex items-center gap-2 rounded-md bg-black/50 px-3 py-1 text-sm text-[color:var(--panth-ink)]"
        aria-label={`Opponent: ${p1} points`}
      >
        <span className="text-[color:var(--panth-accent-storm)]">●</span>
        <span>Bot</span>
        <span className="font-mono tabular-nums">{p1}</span>
      </div>
    </>
  );
}
