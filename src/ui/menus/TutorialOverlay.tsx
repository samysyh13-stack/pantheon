// First-visit tutorial overlay (DESIGN §10 minimal v1 floor).
//
// Path C Day 8 promised a full 6-step interactive flow. v1 ships the
// skeleton: one welcome card listing keybindings with platform-
// appropriate variants (keyboard / gamepad / touch). Dismiss on click
// or Escape, persisted via store.markTutorialSeen so the overlay only
// appears once per browser. The expanded step-by-step flow (move →
// attack → ability → ultimate → scripted duel) is v1.0.1 polish —
// DESIGN §10 §7 behavior when only one god is available already
// skips god-select, so the scripted-duel step reduces to "press play".

import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../state/store';
import { Button } from '../components/Button';

function detectInputHint(): 'touch' | 'gamepad' | 'keyboard' {
  if (typeof window === 'undefined') return 'keyboard';
  if ('ontouchstart' in window && !window.matchMedia('(pointer: fine)').matches) {
    return 'touch';
  }
  // Best-effort: if a gamepad is already connected we highlight that row;
  // otherwise default to keyboard (the overlay still shows both).
  const pads = navigator.getGamepads?.() ?? [];
  for (const p of pads) if (p) return 'gamepad';
  return 'keyboard';
}

export function TutorialOverlay() {
  const hasSeen = useAppStore((s) => s.match.hasSeenTutorial);
  const markSeen = useAppStore((s) => s.markTutorialSeen);
  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);
  const [mounted, setMounted] = useState(false);
  const hint = useMemo(() => detectInputHint(), []);

  useEffect(() => {
    if (hasSeen) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        markSeen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
  }, [hasSeen, markSeen]);

  if (hasSeen) return null;

  const enterClass = reducedMotion
    ? 'opacity-100'
    : `transition-opacity duration-200 ease-out ${mounted ? 'opacity-100' : 'opacity-0'}`;

  const rows: Array<{ action: string; keyboard: string; gamepad: string; touch: string }> = [
    { action: 'Move', keyboard: 'W A S D', gamepad: 'Left Stick', touch: 'Left joystick' },
    { action: 'Aim', keyboard: 'Mouse', gamepad: 'Right Stick', touch: 'Right joystick' },
    { action: 'Basic attack (Silken Dart)', keyboard: 'Left Click', gamepad: 'RT', touch: 'Release aim' },
    { action: 'Ability (Mirror Thread)', keyboard: 'Right Click', gamepad: 'RB', touch: 'Ability button' },
    { action: 'Ultimate (Eight-Strand Dome)', keyboard: 'Space', gamepad: 'Y / △', touch: 'Ultimate button' },
    { action: 'Dodge roll', keyboard: 'Shift', gamepad: 'LT', touch: 'Dodge button' },
    { action: 'Pause', keyboard: 'Esc', gamepad: 'Start', touch: 'Menu button' },
  ];

  const emphCol = (col: 'keyboard' | 'gamepad' | 'touch') =>
    col === hint
      ? 'text-[color:var(--panth-accent-gold)] font-semibold'
      : 'text-[color:var(--panth-ink-dim)]';

  return (
    <div
      className={`safe-top safe-bottom safe-left safe-right pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md ${enterClass}`}
      role="dialog"
      aria-labelledby="tutorial-title"
      aria-modal="true"
      onClick={markSeen}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[color:var(--panth-bg)]/90 p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="tutorial-title"
          className="text-3xl font-semibold tracking-wider text-[color:var(--panth-accent-gold)]"
          style={{ fontFamily: '"Cinzel", Inter, system-ui, serif' }}
        >
          Welcome to Panthéon
        </h2>
        <p className="mt-2 text-sm text-[color:var(--panth-ink-dim)]">
          You play <span className="text-[color:var(--panth-accent-gold)]">Anansi</span> — the
          Akan-Ashanti spider trickster. Ranged kiter. Win 2 rounds by reducing your opponent's
          HP to zero.
        </p>

        <div className="mt-5 overflow-hidden rounded-xl border border-[color:var(--panth-ink-dim)]/30">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-px bg-[color:var(--panth-ink-dim)]/20 text-xs">
            <div className="bg-black/30 px-3 py-2 uppercase tracking-wide text-[color:var(--panth-ink-dim)]">
              Action
            </div>
            <div className={`bg-black/30 px-3 py-2 uppercase tracking-wide ${emphCol('keyboard')}`}>
              Keyboard
            </div>
            <div className={`bg-black/30 px-3 py-2 uppercase tracking-wide ${emphCol('gamepad')}`}>
              Gamepad
            </div>
            <div className={`bg-black/30 px-3 py-2 uppercase tracking-wide ${emphCol('touch')}`}>
              Touch
            </div>
            {rows.map((r) => (
              <div key={r.action} className="contents">
                <div className="bg-black/20 px-3 py-2 text-sm text-[color:var(--panth-ink)]">
                  {r.action}
                </div>
                <div className={`bg-black/20 px-3 py-2 text-sm ${emphCol('keyboard')}`}>
                  {r.keyboard}
                </div>
                <div className={`bg-black/20 px-3 py-2 text-sm ${emphCol('gamepad')}`}>
                  {r.gamepad}
                </div>
                <div className={`bg-black/20 px-3 py-2 text-sm ${emphCol('touch')}`}>
                  {r.touch}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs text-[color:var(--panth-ink-dim)]">
          Kit: <strong className="text-[color:var(--panth-ink)]">Silken Dart</strong> fires at
          0.4 s cadence, 80 dmg. <strong className="text-[color:var(--panth-ink)]">Mirror
          Thread</strong> spawns an AI clone to force your opponent to aim wrong.{' '}
          <strong className="text-[color:var(--panth-ink)]">Eight-Strand Dome</strong> is your
          ultimate — placed on charge, a trap zone that slows + DoTs enemies.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="primary" onClick={markSeen}>
            Got it — let me play
          </Button>
        </div>
        <p className="mt-3 text-center text-[10px] uppercase tracking-wide text-[color:var(--panth-ink-dim)]">
          Press Esc, Enter, or Space to dismiss
        </p>
      </div>
    </div>
  );
}
