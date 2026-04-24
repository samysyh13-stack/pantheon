// PANTHÉON Results screen (T-005 UX stub).
//
// Real data wiring is T-106 in Phase 2 (damage-dealt / kills / totem-time).
// This stub renders the frame, banner, and stat grid with placeholder zeros
// so the screen can land now and be verified end-to-end against Screens.tsx
// routing. The three navigation buttons (Rematch / God Select / Main Menu)
// already route correctly via the store.

import { useAppStore } from '../../state/store';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

type Outcome = 'victory' | 'defeat';

interface Props {
  outcome?: Outcome;
  stats?: {
    damageDealt: number;
    damageTaken: number;
    durationSeconds: number;
    kills: number;
  };
}

export function Results({
  outcome = 'victory',
  stats = { damageDealt: 0, damageTaken: 0, durationSeconds: 0, kills: 0 },
}: Props) {
  const setScreen = useAppStore((s) => s.setScreen);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const rem = Math.floor(s % 60);
    return `${m}:${rem.toString().padStart(2, '0')}`;
  };

  // Outcome color is paired with a shape cue (chevron icon + text) — the
  // banner is never readable by color alone per DESIGN §13.
  const bannerAccent =
    outcome === 'victory' ? 'var(--panth-accent-gold)' : 'var(--panth-accent-ember)';
  const bannerGlyph = outcome === 'victory' ? '\u25B2' : '\u25BC';

  return (
    <div className="safe-top safe-bottom safe-left safe-right absolute inset-0 flex flex-col bg-black/60 backdrop-blur-md">
      <header className="flex flex-col items-center gap-2 px-6 py-8">
        <span
          aria-hidden
          className="text-4xl"
          style={{ color: bannerAccent }}
        >
          {bannerGlyph}
        </span>
        <h2
          className="text-5xl font-semibold uppercase tracking-widest"
          style={{ color: bannerAccent, fontFamily: '"Cinzel", Inter, system-ui, serif' }}
        >
          {outcome === 'victory' ? 'Victory' : 'Defeat'}
        </h2>
      </header>

      <div className="flex-1 overflow-y-auto px-6">
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-3">
          <StatTile label="Damage dealt" value={stats.damageDealt.toString()} />
          <StatTile label="Damage taken" value={stats.damageTaken.toString()} />
          <StatTile label="Duration" value={formatDuration(stats.durationSeconds)} />
          <StatTile label="Kills" value={stats.kills.toString()} />
        </div>
      </div>

      <footer className="flex flex-wrap justify-center gap-3 border-t border-white/10 px-6 py-4">
        <Button variant="primary" onClick={() => setScreen('loading')}>
          Rematch
        </Button>
        <Button variant="secondary" onClick={() => setScreen('god-select')}>
          God Select
        </Button>
        <Button variant="ghost" onClick={() => setScreen('menu')}>
          Main Menu
        </Button>
      </footer>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <span className="text-xs uppercase tracking-wide text-[color:var(--panth-ink-dim)]">
        {label}
      </span>
      <span className="text-3xl font-semibold tabular-nums text-[color:var(--panth-ink)]">
        {value}
      </span>
    </Card>
  );
}
