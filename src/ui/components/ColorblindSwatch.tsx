// PANTHÉON ColorblindSwatch primitive (T-005 UX).
//
// Preview a single team accent color side-by-side across all four modes
// (none / protanopia / deuteranopia / tritanopia). Used in SettingsMenu's
// Accessibility tab so the player can see what the team accent *actually*
// looks like under their setting before committing to it.
//
// Each swatch carries its mode label below it — that's the shape/position
// cue that satisfies "never encode info in color alone" (DESIGN §13).

import { COLORBLIND_MODES, COLORBLIND_PALETTE, type TeamKey } from '../colorblind';
import type { ColorblindMode } from '../../state/store';

interface Props {
  team: TeamKey;
  label: string;
  /** Optional — highlight the currently active mode's swatch. */
  activeMode?: ColorblindMode;
}

export function ColorblindSwatch({ team, label, activeMode }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-[color:var(--panth-ink-dim)]">{label}</span>
      <div className="flex gap-2">
        {COLORBLIND_MODES.map((mode) => {
          const isActive = mode === activeMode;
          return (
            <div key={mode} className="flex flex-1 flex-col items-center gap-1">
              <div
                aria-hidden
                className={`h-10 w-full rounded-md border ${
                  isActive
                    ? 'border-[color:var(--panth-accent-gold)] ring-2 ring-[color:var(--panth-accent-gold)]'
                    : 'border-white/20'
                }`}
                style={{ backgroundColor: COLORBLIND_PALETTE[mode][team] }}
              />
              <span className="text-[10px] uppercase tracking-wide text-[color:var(--panth-ink-dim)]">
                {mode === 'none' ? 'default' : mode.slice(0, 5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
