// Match timer (top-center). Reads timerMs from the match slice — updated
// by the Phase 2 match state machine. For Phase 1/2 scaffold, a local
// display-only tick runs alongside to animate the digits; the simulation
// owns the authoritative number.

import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/store';

function formatMmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

export function MatchTimer() {
  const timerMs = useAppStore((s) => s.match.timerMs);
  const [displayed, setDisplayed] = useState(timerMs);

  // Display ticks at 10 Hz while in match. The store value is authoritative;
  // we just pull every 100 ms so re-renders stay cheap.
  useEffect(() => {
    const t = window.setInterval(() => {
      setDisplayed(useAppStore.getState().match.timerMs);
    }, 100);
    return () => window.clearInterval(t);
  }, []);

  // Keep in sync if store updates faster than our 100 ms tick.
  useEffect(() => {
    setDisplayed(timerMs);
  }, [timerMs]);

  return (
    <div
      className="safe-top pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-md bg-black/50 px-4 py-1 font-mono text-lg text-[color:var(--panth-ink)] tabular-nums"
      role="timer"
      aria-label="Match timer"
    >
      {formatMmss(displayed)}
    </div>
  );
}
