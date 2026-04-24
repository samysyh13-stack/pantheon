// App root — wires together:
//   - GameCanvas (rendering, Physics, per-preset effect stack)
//   - MatchScene (arena + character + tracking camera, only while in-match)
//   - Screens (menu / god-select / loading / results overlays)
//   - HUD + PauseMenu (only while in-match)
//
// State is store-driven via `useAppStore`. The orchestrator's Phase 1
// auto-advance on 'loading' → 'match' is a development hook so the smoke
// test can reach the match scene; Phase 2 T-106 replaces it with the real
// asset-preloader-driven advance.
//
// Pause wiring (Phase 1 Fix 2):
//   - Keyboard: Escape toggles pause while in match
//   - Gamepad: Start button (index 9) toggles pause (polled from this
//     effect; independent of InputManager so App doesn't need to share the
//     manager with MatchScene)
//   - Touch: HUD's Menu button calls setPaused(true); PauseMenu's Resume
//     returns false

import { useEffect, useState } from 'react';
import { GameCanvas } from '../rendering/Canvas';
import { HUD } from '../ui/hud/HUD';
import { Screens } from '../ui/Screens';
import { PauseMenu } from '../ui/menus/PauseMenu';
import { MatchScene } from './MatchScene';
import { useAppStore } from '../state/store';

const LOADING_AUTO_ADVANCE_MS = 400;
const GAMEPAD_START_BUTTON_INDEX = 9;

export function App() {
  const preset = useAppStore((s) => s.settings.graphicsPreset);
  const screen = useAppStore((s) => s.match.screen);
  const [paused, setPaused] = useState(false);

  // Landscape orientation lock (user-gesture-gated; iOS may reject, hence
  // the silent catch). Phase 4 polish may add a retry on first user-input.
  useEffect(() => {
    const lock = async () => {
      const orientation = window.screen?.orientation as
        | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
        | undefined;
      try {
        await orientation?.lock?.('landscape');
      } catch {
        /* user-gesture-gated; ignore */
      }
    };
    void lock();
  }, []);

  // Phase 1 auto-advance from 'loading' to 'match'. Phase 2 T-106 replaces
  // this with a real asset-preloader driven advance.
  useEffect(() => {
    if (screen !== 'loading') return undefined;
    const t = window.setTimeout(
      () => useAppStore.getState().setScreen('match'),
      LOADING_AUTO_ADVANCE_MS,
    );
    return () => window.clearTimeout(t);
  }, [screen]);

  const inMatch = screen === 'match';

  // Phase 1 Fix 2: Escape + gamepad Start toggle the pause menu while
  // in-match. Touch pause is handled inside HUD (<button>Menu</button>).
  useEffect(() => {
    if (!inMatch) return undefined;

    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', keyHandler);

    let rafId = 0;
    let prevStart = false;
    const pollGamepad = () => {
      const pads = navigator.getGamepads?.() ?? [];
      let anyStart = false;
      for (const gp of pads) {
        if (!gp) continue;
        if (gp.buttons[GAMEPAD_START_BUTTON_INDEX]?.pressed) {
          anyStart = true;
          break;
        }
      }
      if (anyStart && !prevStart) {
        setPaused((p) => !p);
      }
      prevStart = anyStart;
      rafId = requestAnimationFrame(pollGamepad);
    };
    rafId = requestAnimationFrame(pollGamepad);

    return () => {
      window.removeEventListener('keydown', keyHandler);
      cancelAnimationFrame(rafId);
    };
  }, [inMatch]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[color:var(--panth-bg)]">
      <GameCanvas preset={preset}>{inMatch ? <MatchScene /> : null}</GameCanvas>
      {inMatch && <HUD onExit={() => setPaused(true)} />}
      {inMatch && <PauseMenu open={paused} onResume={() => setPaused(false)} />}
      <Screens />
    </div>
  );
}
