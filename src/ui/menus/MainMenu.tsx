// PANTHÉON Main Menu (T-005 UX).
//
// Three buttons per DESIGN §12: Play, Gods, Settings.
// Slide-in mount animation (200 ms, respects reducedMotion per DESIGN §13).
// Footer carries the Vite build version injected by the orchestrator's
// index.html preconnect + VITE_APP_VERSION env var (Phase-4 polish).
//
// Flow:
//   Play       → match.screen = 'god-select'
//   Gods       → match.screen = 'god-select' (same as Play in v1; Gods is the
//                entry to the "pick your fighter" UI)
//   Settings   → opens SettingsMenu overlay via local state (Screens.tsx
//                doesn't track a 'settings' screen — Settings is always an
//                overlay on top of another screen).

import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { useAppStore } from '../../state/store';
import { SettingsMenu } from './SettingsMenu';

const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev';

interface Props {
  /**
   * Optional Play-button override. When omitted, Play advances the store's
   * `match.screen` to `'god-select'`. The prop is retained to keep the old
   * App.tsx wiring compiling during the T-005 → orchestrator integration
   * window; once the wiring diff lands, callers should drop the prop and
   * let the store-driven flow take over.
   */
  onPlay?: () => void;
}

export function MainMenu({ onPlay }: Props = {}) {
  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);
  const setScreen = useAppStore((s) => s.setScreen);
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const handlePlay = () => {
    if (onPlay) onPlay();
    else setScreen('god-select');
  };
  const handleGods = () => {
    setScreen('god-select');
  };

  useEffect(() => {
    // Trigger enter animation one frame after mount so the "from" transform
    // is actually applied before the "to" transform takes effect.
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const transitionClass = reducedMotion
    ? ''
    : 'transition-all duration-200 ease-out';
  const enterTransform = mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0';

  return (
    <div className="safe-top safe-bottom safe-left safe-right pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className={`pointer-events-auto flex flex-col items-center gap-5 rounded-2xl bg-black/50 px-10 py-10 backdrop-blur-md ${transitionClass} ${enterTransform}`}
      >
        <h1
          className="text-5xl font-semibold tracking-wider text-[color:var(--panth-ink)]"
          style={{ fontFamily: '"Cinzel", Inter, system-ui, serif' }}
        >
          PANTHÉON
        </h1>
        <p className="text-sm text-[color:var(--panth-ink-dim)]">
          Mythological brawler
        </p>
        <div className="mt-3 flex w-56 flex-col gap-3">
          <Button fullWidth variant="primary" onClick={handlePlay}>
            Play
          </Button>
          <Button fullWidth variant="secondary" onClick={handleGods}>
            Gods
          </Button>
          <Button fullWidth variant="ghost" onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
        </div>
        <span className="mt-4 text-[10px] uppercase tracking-wide text-[color:var(--panth-ink-dim)]">
          build {APP_VERSION}
        </span>
      </div>

      {settingsOpen && <SettingsMenu onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
