import { useEffect, useState } from 'react';
import { GameCanvas } from '../rendering/Canvas';
import { MainMenu } from '../ui/menus/MainMenu';
import { HUD } from '../ui/hud/HUD';
import { useAppStore } from '../state/store';

type ScreenState = 'menu' | 'match';

export function App() {
  const [screenState, setScreenState] = useState<ScreenState>('menu');
  const preset = useAppStore((s) => s.settings.graphicsPreset);

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

  return (
    <div className="relative h-full w-full overflow-hidden bg-[color:var(--panth-bg)]">
      <GameCanvas preset={preset} />
      {screenState === 'menu' ? (
        <MainMenu onPlay={() => setScreenState('match')} />
      ) : (
        <HUD onExit={() => setScreenState('menu')} />
      )}
    </div>
  );
}
