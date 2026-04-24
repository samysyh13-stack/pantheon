// PANTHÉON colorblind-safe color helpers (T-005 UX).
//
// The three signature god colors from DESIGN §6 map to per-mode safe
// equivalents so the "team" / "signature-color" affordance remains legible
// under protanopia, deuteranopia, and tritanopia.
//
// Per DESIGN §13, color is never the sole carrier of meaning — UI layers
// also ship an icon/shape cue (accent bar, position, glyph). This palette
// table is the COLOR half of that pairing; callers must ensure the shape
// half too.
//
// The hex values are hand-picked to retain perceived hue-distinctness in
// each dichromacy:
//   - protanopia   (no L-cones)  — reds shift to ochre, greens darken
//   - deuteranopia (no M-cones)  — red/green confusion, blue/yellow intact
//   - tritanopia   (no S-cones)  — blue/yellow confusion, red/green intact
// The "none" column reproduces the DESIGN §6 signature colors exactly.

import { useAppStore } from '../state/store';
import type { ColorblindMode } from '../state/store';

export type TeamKey = 'anansi' | 'brigid' | 'susanoo' | 'neutral';

/** Canonical signature hexes from DESIGN §6. */
export const SIGNATURE_COLORS = {
  anansi: '#D4A24A', // deep gold
  brigid: '#E8662A', // ember orange
  susanoo: '#2E9FB5', // storm cyan
  neutral: '#E8E4DC', // --panth-ink
} as const;

/**
 * Per-mode safe palettes. `none` is the identity baseline.
 * Values chosen to maximize perceived separation in each dichromacy while
 * preserving brand recognition (the anansi=warm-gold cue, brigid=warm-red
 * cue, susanoo=cool cue carry through all modes).
 */
export const COLORBLIND_PALETTE: Record<ColorblindMode, Record<TeamKey, string>> = {
  none: {
    anansi: SIGNATURE_COLORS.anansi,
    brigid: SIGNATURE_COLORS.brigid,
    susanoo: SIGNATURE_COLORS.susanoo,
    neutral: SIGNATURE_COLORS.neutral,
  },
  protanopia: {
    anansi: '#E0B84C', // lifted gold — protans perceive warmth better via yellow shift
    brigid: '#C8824A', // shifted toward yellow-brown (pure red indistinguishable)
    susanoo: '#3FB6C6', // cool cyan preserved — unaffected axis
    neutral: '#E8E4DC',
  },
  deuteranopia: {
    anansi: '#E7C04A',
    brigid: '#D87038', // pushed toward orange, away from red-green axis
    susanoo: '#2FA6B7',
    neutral: '#E8E4DC',
  },
  tritanopia: {
    anansi: '#D8A850', // gold retains warmth on red-green axis (tritans still read it)
    brigid: '#E86A2A',
    susanoo: '#5AA5A8', // pulled away from pure blue to reduce yellow/blue confusion
    neutral: '#E8E4DC',
  },
};

/** Resolve a team accent color for the current accessibility mode. */
export function teamColor(team: TeamKey, mode: ColorblindMode): string {
  return COLORBLIND_PALETTE[mode][team];
}

/** React hook variant — reads the active colorblind mode from the store. */
export function useTeamColor(team: TeamKey): string {
  const mode = useAppStore((s) => s.settings.accessibility.colorblindMode);
  return teamColor(team, mode);
}

export const COLORBLIND_MODES: readonly ColorblindMode[] = [
  'none',
  'protanopia',
  'deuteranopia',
  'tritanopia',
];
