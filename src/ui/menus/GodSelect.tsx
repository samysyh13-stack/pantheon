// PANTHÉON God Select screen (T-005 UX).
//
// Three cards — Anansi (playable), Brigid + Susanoo ("Coming soon" locked
// per v1 scope). Signature-color accent bar per card pulls from DESIGN §6
// (gold / ember / storm cyan) via the colorblind-safe `useTeamColor` so the
// accent stays legible under any colorblind setting (DESIGN §13).
//
// Layout:
//   - Mobile: vertical stack, full-width cards
//   - Desktop (md+): three-column row
//
// Locked cards:
//   - Visually muted (grayscale), disabled pointer, "Coming soon" tag
//   - If `availableGods` excludes a slot, that card hides entirely — lets
//     Path C (1-god scope at Day 7 gate) render a single card cleanly

import { useState } from 'react';
import { useAppStore } from '../../state/store';
import { useTeamColor, type TeamKey } from '../colorblind';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

interface GodSpec {
  key: TeamKey;
  name: string;
  role: string;
  hp: number;
  unlocked: boolean;
  narrativeLine: string;
}

const GODS: readonly GodSpec[] = [
  {
    key: 'anansi',
    name: 'Anansi',
    role: 'Ranged trickster · zone-control',
    hp: 320,
    unlocked: true,
    narrativeLine: 'West African — Akan-Ashanti',
  },
  {
    key: 'brigid',
    name: 'Brigid',
    role: 'Zone-control firecaster · anchor',
    hp: 380,
    unlocked: false,
    narrativeLine: 'Celtic — Gaelic',
  },
  {
    key: 'susanoo',
    name: 'Susanoo',
    role: 'Close-range brawler · dive',
    hp: 420,
    unlocked: false,
    narrativeLine: 'Japanese — Shinto',
  },
];

interface Props {
  /**
   * Override the set of gods presented. Defaults to all three for dev.
   * Path C (1-god scope) would pass e.g. `['anansi']`.
   */
  availableGods?: readonly TeamKey[];
}

export function GodSelect({ availableGods }: Props = {}) {
  const setScreen = useAppStore((s) => s.setScreen);
  const [selected, setSelected] = useState<TeamKey>('anansi');

  const visibleKeys: readonly TeamKey[] =
    availableGods ?? GODS.map((g) => g.key);
  const visibleGods = GODS.filter((g) => visibleKeys.includes(g.key));

  return (
    <div className="safe-top safe-bottom safe-left safe-right absolute inset-0 flex flex-col bg-black/40 backdrop-blur-sm">
      <header className="flex items-center justify-between px-6 py-4">
        <h2 className="text-2xl font-semibold text-[color:var(--panth-ink)]">
          Choose your god
        </h2>
        <Button variant="ghost" onClick={() => setScreen('menu')}>
          Back
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {visibleGods.map((g) => (
            <GodCard
              key={g.key}
              spec={g}
              selected={selected === g.key && g.unlocked}
              onSelect={() => {
                if (g.unlocked) setSelected(g.key);
              }}
            />
          ))}
        </div>
      </div>

      <footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
        <Button variant="secondary" onClick={() => setScreen('menu')}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!visibleGods.find((g) => g.key === selected)?.unlocked}
          onClick={() => setScreen('loading')}
        >
          Start Match
        </Button>
      </footer>
    </div>
  );
}

interface GodCardProps {
  spec: GodSpec;
  selected: boolean;
  onSelect: () => void;
}

function GodCard({ spec, selected, onSelect }: GodCardProps) {
  const color = useTeamColor(spec.key);

  return (
    <Card
      interactive={spec.unlocked}
      selected={selected}
      muted={!spec.unlocked}
      accentColor={color}
      onClick={onSelect}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && spec.unlocked) {
          e.preventDefault();
          onSelect();
        }
      }}
      role={spec.unlocked ? 'button' : undefined}
      tabIndex={spec.unlocked ? 0 : -1}
      aria-disabled={!spec.unlocked}
      className="pl-5"
    >
      {/* Portrait placeholder — colored gradient rectangle using signature color */}
      <div
        aria-hidden
        className="relative h-40 w-full overflow-hidden rounded-lg"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, rgba(15,18,24,0.9) 100%)`,
        }}
      >
        <span className="absolute bottom-2 right-2 text-xs text-white/80">
          {spec.narrativeLine}
        </span>
        {!spec.unlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs uppercase tracking-widest text-[color:var(--panth-ink)]">
            {/* Lock glyph is a SHAPE cue so lock state is readable without relying on grayscale */}
            <span aria-hidden className="mr-2">
              {'\u{1F512}'}
            </span>
            Coming soon
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold text-[color:var(--panth-ink)]">{spec.name}</span>
        <span className="text-xs text-[color:var(--panth-ink-dim)]">HP {spec.hp}</span>
      </div>
      <p className="text-sm text-[color:var(--panth-ink-dim)]">{spec.role}</p>

      {/* HP bar — pairs HP (number above) with a shape indicator (bar below) */}
      <div
        aria-hidden
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        title={`HP ${spec.hp}`}
      >
        <div
          className="h-full rounded-full"
          style={{
            // Max HP in v1 is 420; bar is proportional so the tier difference
            // is instantly readable.
            width: `${(spec.hp / 420) * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </Card>
  );
}
