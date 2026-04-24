// Player HP bar. Top-left anchor with signature-color accent. Turns red
// when HP < 30% (DESIGN §12 visual rule — pair color with shape change
// for colorblind accessibility: the bar also shows a small ▼ glyph when
// critical, not color alone).

import { useAppStore } from '../../state/store';
import { useTeamColor } from '../colorblind';

const CRITICAL_HP_RATIO = 0.3;

export function HPBar() {
  const hp = useAppStore((s) => s.match.playerHp);
  const maxHp = useAppStore((s) => s.match.playerMaxHp);
  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);
  const signatureColor = useTeamColor('anansi'); // TODO: swap by current god in Phase 3 roster-aware HUD

  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const critical = ratio < CRITICAL_HP_RATIO;

  const fillColor = critical ? '#d44a4a' : signatureColor;
  const width = `${(ratio * 100).toFixed(1)}%`;
  const transition = reducedMotion ? '' : 'transition-all duration-150 ease-out';

  return (
    <div className="safe-top safe-left pointer-events-none absolute left-4 top-4 flex min-w-[14rem] flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-[color:var(--panth-ink-dim)]">
        <span className="flex items-center gap-1">
          {critical ? <span aria-hidden="true">▼</span> : null}
          <span>HP</span>
        </span>
        <span
          className={critical ? 'font-semibold text-[color:var(--panth-ink)]' : ''}
          aria-live="polite"
        >
          {Math.round(hp)} / {maxHp}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full border border-[color:var(--panth-ink-dim)]/30 bg-black/60"
        role="progressbar"
        aria-valuenow={Math.round(hp)}
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-label="Player health"
      >
        <div
          className={`h-full ${transition}`}
          style={{ width, background: fillColor }}
        />
      </div>
    </div>
  );
}
