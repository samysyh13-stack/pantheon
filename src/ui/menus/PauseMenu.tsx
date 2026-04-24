// PANTHÉON Pause Menu (T-005 UX).
//
// Per DESIGN §12: "No modal dialogs during gameplay. Pause menu slides from
// the right; the match is frozen behind it but visible."
//   - Slide-in from right (200 ms). reducedMotion: plain fade, no slide.
//   - Escape dismisses (calls onResume).
//   - Three actions: Resume, Settings, Exit to Menu.
//
// The parent (App.tsx) is responsible for freezing the simulation while the
// pause menu is visible; this component only renders the overlay.

import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/store';
import { Button } from '../components/Button';
import { SettingsMenu } from './SettingsMenu';

interface Props {
  open: boolean;
  onResume: () => void;
}

export function PauseMenu({ open, onResume }: Props) {
  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);
  const setScreen = useAppStore((s) => s.setScreen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Trigger slide-in on open.
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(raf);
    }
    setMounted(false);
    return undefined;
  }, [open]);

  // Escape dismisses — but only when the settings overlay isn't on top.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !settingsOpen) {
        e.preventDefault();
        onResume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, settingsOpen, onResume]);

  if (!open) return null;

  const transitionClass = reducedMotion
    ? 'transition-opacity duration-150'
    : 'transition-transform duration-200 ease-out';
  const panelOffset = reducedMotion
    ? mounted
      ? 'opacity-100'
      : 'opacity-0'
    : mounted
      ? 'translate-x-0'
      : 'translate-x-full';

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Pause menu"
    >
      {/* Dim overlay — NOT modal-opaque per DESIGN §12 (match visible behind) */}
      <div
        aria-hidden
        className={`absolute inset-0 bg-black/30 ${reducedMotion ? 'transition-opacity duration-150' : 'transition-opacity duration-200'} ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={onResume}
      />
      <aside
        className={`safe-top safe-bottom safe-right relative flex h-full w-72 flex-col gap-4 border-l border-white/10 bg-[color:var(--panth-bg)]/95 px-6 py-6 backdrop-blur-md ${transitionClass} ${panelOffset}`}
      >
        <h2 className="text-xl font-semibold text-[color:var(--panth-ink)]">Paused</h2>
        <p className="text-xs text-[color:var(--panth-ink-dim)]">Esc to resume</p>
        <div className="mt-4 flex flex-col gap-3">
          <Button fullWidth variant="primary" onClick={onResume}>
            Resume
          </Button>
          <Button fullWidth variant="secondary" onClick={() => setSettingsOpen(true)}>
            Settings
          </Button>
          <Button fullWidth variant="ghost" onClick={() => setScreen('menu')}>
            Exit to menu
          </Button>
        </div>
      </aside>

      {settingsOpen && <SettingsMenu onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
