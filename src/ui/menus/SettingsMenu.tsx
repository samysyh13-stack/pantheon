// PANTHÉON Settings screen (T-005 UX).
//
// Tabbed settings panel: Graphics / Audio / Accessibility / Controls.
// Presented as a full-screen overlay with a Close button — it's launched
// from MainMenu (and will be launched from PauseMenu in-match; see
// PauseMenu.tsx integration).
//
// Remap flow (Controls tab):
//   - Clicking "Remap" on a row opens the RemapModal overlay.
//   - The modal attaches a one-shot `keydown` listener (keyboard) and polls
//     gamepad buttons on rAF (gamepad). First event wins; modal closes.
//   - Escape cancels and closes the modal without writing.
//
// Touch section visibility: only rendered on touch-capable devices. The
// `'ontouchstart' in window` check is evaluated once at component mount.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useAppStore,
  type ColorblindMode,
  type GraphicsPreset,
  type InputAction,
} from '../../state/store';
import { Button } from '../components/Button';
import { ColorblindSwatch } from '../components/ColorblindSwatch';
import { Select, type SelectOption } from '../components/Select';
import { Slider } from '../components/Slider';
import { Tabs, type TabDef } from '../components/Tabs';
import { Toggle } from '../components/Toggle';

const TABS: readonly TabDef[] = [
  { id: 'graphics', label: 'Graphics' },
  { id: 'audio', label: 'Audio' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'controls', label: 'Controls' },
];

const PRESET_OPTIONS: readonly SelectOption<GraphicsPreset>[] = [
  { value: 'auto', label: 'Auto (recommended)' },
  { value: 'ultra', label: 'Ultra' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'battery', label: 'Battery saver' },
];

const COLORBLIND_OPTIONS: readonly SelectOption<ColorblindMode>[] = [
  { value: 'none', label: 'None (default)' },
  { value: 'protanopia', label: 'Protanopia' },
  { value: 'deuteranopia', label: 'Deuteranopia' },
  { value: 'tritanopia', label: 'Tritanopia' },
];

// Human-readable labels for each remappable action.
const ACTION_LABELS: Record<InputAction, string> = {
  moveUp: 'Move up',
  moveDown: 'Move down',
  moveLeft: 'Move left',
  moveRight: 'Move right',
  basicAttack: 'Basic attack',
  ability: 'Signature ability',
  ultimate: 'Ultimate',
  dodge: 'Dodge roll',
  pause: 'Pause',
};
const ACTIONS: readonly InputAction[] = [
  'moveUp',
  'moveDown',
  'moveLeft',
  'moveRight',
  'basicAttack',
  'ability',
  'ultimate',
  'dodge',
  'pause',
];

interface Props {
  onClose: () => void;
}

export function SettingsMenu({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState('graphics');
  const reducedMotion = useAppStore((s) => s.settings.accessibility.reducedMotion);

  // Escape closes the overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const transitionClass = reducedMotion ? '' : 'transition-opacity duration-200';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className={`safe-top safe-bottom safe-left safe-right fixed inset-0 z-40 flex flex-col bg-[color:var(--panth-bg)]/95 backdrop-blur-md ${transitionClass}`}
    >
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <h2 className="text-2xl font-semibold text-[color:var(--panth-ink)]">Settings</h2>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </header>
      <div className="min-h-0 flex-1">
        <Tabs tabs={TABS} activeId={activeTab} onChange={setActiveTab} ariaLabel="Settings tabs">
          {activeTab === 'graphics' && <GraphicsTab />}
          {activeTab === 'audio' && <AudioTab />}
          {activeTab === 'accessibility' && <AccessibilityTab />}
          {activeTab === 'controls' && <ControlsTab />}
        </Tabs>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Graphics tab
// --------------------------------------------------------------------------

function GraphicsTab() {
  const graphicsPreset = useAppStore((s) => s.settings.graphicsPreset);
  const renderer = useAppStore((s) => s.settings.renderer);
  const setGraphicsPreset = useAppStore((s) => s.setGraphicsPreset);
  const setRenderer = useAppStore((s) => s.setRenderer);

  // FPS overlay is a local component-state toggle per brief — not persisted
  // to the store until a later perf pass formalizes it.
  const [fpsOverlay, setFpsOverlay] = useState(false);

  const webgpuSupported = useMemo(
    () => typeof navigator !== 'undefined' && 'gpu' in navigator,
    [],
  );

  const rendererOptions: readonly SelectOption<'webgl2' | 'webgpu'>[] = [
    { value: 'webgl2', label: 'WebGL2 (recommended)' },
    webgpuSupported
      ? { value: 'webgpu', label: 'WebGPU' }
      : {
          value: 'webgpu',
          label: 'WebGPU',
          disabled: true,
          note: 'requires browser support',
        },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Select<GraphicsPreset>
        label="Quality preset"
        value={graphicsPreset}
        options={PRESET_OPTIONS}
        onChange={(v) => setGraphicsPreset(v)}
      />
      <Select<'webgl2' | 'webgpu'>
        label="Renderer"
        value={renderer}
        options={rendererOptions}
        onChange={(v) => setRenderer(v)}
      />
      <Toggle
        label="Show FPS overlay"
        description="Performance diagnostic — not saved between sessions"
        checked={fpsOverlay}
        onChange={setFpsOverlay}
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// Audio tab
// --------------------------------------------------------------------------

function AudioTab() {
  const audio = useAppStore((s) => s.settings.audio);
  const setAudio = useAppStore((s) => s.setAudio);
  return (
    <div className="flex flex-col gap-5">
      <Slider label="Master" value={audio.master} onChange={(v) => setAudio({ master: v })} />
      <Slider label="SFX" value={audio.sfx} onChange={(v) => setAudio({ sfx: v })} />
      <Slider label="Music" value={audio.music} onChange={(v) => setAudio({ music: v })} />
      <Slider label="Voice" value={audio.voice} onChange={(v) => setAudio({ voice: v })} />
      <Toggle
        label="Mono audio"
        description="Downmix to mono output for hearing accessibility"
        checked={audio.mono}
        onChange={(v) => setAudio({ mono: v })}
      />
    </div>
  );
}

// --------------------------------------------------------------------------
// Accessibility tab
// --------------------------------------------------------------------------

function AccessibilityTab() {
  const a11y = useAppStore((s) => s.settings.accessibility);
  const setAccessibility = useAppStore((s) => s.setAccessibility);

  return (
    <div className="flex flex-col gap-5">
      <Toggle
        label="Reduced motion"
        description="Cuts camera shake; disables slide-in menu transitions"
        checked={a11y.reducedMotion}
        onChange={(v) => setAccessibility({ reducedMotion: v })}
      />
      <Toggle
        label="High contrast"
        description="Boosts outlines and UI borders"
        checked={a11y.highContrast}
        onChange={(v) => setAccessibility({ highContrast: v })}
      />
      <Toggle
        label="Subtitles"
        description="Show tag labels for ability SFX"
        checked={a11y.subtitles}
        onChange={(v) => setAccessibility({ subtitles: v })}
      />
      <Toggle
        label="Damage numbers"
        checked={a11y.damageNumbers}
        onChange={(v) => setAccessibility({ damageNumbers: v })}
      />
      <Select<ColorblindMode>
        label="Colorblind mode"
        value={a11y.colorblindMode}
        options={COLORBLIND_OPTIONS}
        onChange={(v) => setAccessibility({ colorblindMode: v })}
      />

      <div className="mt-2 flex flex-col gap-3 rounded-lg border border-white/10 bg-black/30 p-4">
        <span className="text-sm font-semibold text-[color:var(--panth-ink)]">
          Team accent preview
        </span>
        <span className="text-xs text-[color:var(--panth-ink-dim)]">
          Each swatch below shows the god accent as it renders under each mode. Mode labels
          under each swatch are the shape cue (DESIGN §13 never-color-alone rule).
        </span>
        <ColorblindSwatch team="anansi" label="Anansi" activeMode={a11y.colorblindMode} />
        <ColorblindSwatch team="brigid" label="Brigid" activeMode={a11y.colorblindMode} />
        <ColorblindSwatch team="susanoo" label="Susanoo" activeMode={a11y.colorblindMode} />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Controls tab
// --------------------------------------------------------------------------

type RemapTarget = { source: 'keyboard' | 'gamepad'; action: InputAction } | null;

function ControlsTab() {
  const keyboard = useAppStore((s) => s.settings.controls.keyboard);
  const gamepad = useAppStore((s) => s.settings.controls.gamepad);
  const touchScale = useAppStore((s) => s.settings.controls.touchScale);
  const touchOpacity = useAppStore((s) => s.settings.controls.touchOpacity);
  const setKeyboardBinding = useAppStore((s) => s.setKeyboardBinding);
  const setGamepadBinding = useAppStore((s) => s.setGamepadBinding);
  const setControls = useAppStore((s) => s.setControls);

  const [remap, setRemap] = useState<RemapTarget>(null);

  // Resolved once at mount — prevents resize / hybrid-device re-evaluation
  // churn. Touch scale/opacity persist regardless; they only *render* here
  // when the device supports touch.
  const touchCapable = useMemo(
    () => typeof window !== 'undefined' && 'ontouchstart' in window,
    [],
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--panth-ink-dim)]">
            Keyboard / Gamepad
          </h3>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 text-sm sm:grid-cols-[1fr_auto_auto_auto_auto]">
            <span className="text-[color:var(--panth-ink-dim)]">Action</span>
            <span className="text-[color:var(--panth-ink-dim)]">Key</span>
            <span />
            <span className="hidden text-[color:var(--panth-ink-dim)] sm:inline">Button</span>
            <span className="hidden sm:inline" />

            {ACTIONS.map((a) => (
              <BindingRow
                key={a}
                action={a}
                keyboardCode={keyboard[a]}
                gamepadIndex={gamepad[a]}
                onRemapKeyboard={() => setRemap({ source: 'keyboard', action: a })}
                onRemapGamepad={() => setRemap({ source: 'gamepad', action: a })}
              />
            ))}
          </div>
        </section>

        {touchCapable && (
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--panth-ink-dim)]">
              Touch
            </h3>
            <Slider
              label="Touch control scale"
              min={0.75}
              max={1.5}
              step={0.05}
              value={touchScale}
              onChange={(v) => setControls({ touchScale: v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
            <Slider
              label="Touch control opacity"
              min={0.3}
              max={1}
              step={0.05}
              value={touchOpacity}
              onChange={(v) => setControls({ touchOpacity: v })}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </section>
        )}
      </div>

      {remap !== null && (
        <RemapModal
          source={remap.source}
          action={remap.action}
          onCommit={(value) => {
            if (remap.source === 'keyboard' && typeof value === 'string') {
              setKeyboardBinding(remap.action, value);
            } else if (remap.source === 'gamepad' && typeof value === 'number') {
              setGamepadBinding(remap.action, value);
            }
            setRemap(null);
          }}
          onCancel={() => setRemap(null)}
        />
      )}
    </>
  );
}

interface BindingRowProps {
  action: InputAction;
  keyboardCode: string;
  gamepadIndex: number;
  onRemapKeyboard: () => void;
  onRemapGamepad: () => void;
}

function BindingRow({
  action,
  keyboardCode,
  gamepadIndex,
  onRemapKeyboard,
  onRemapGamepad,
}: BindingRowProps) {
  return (
    <>
      <span className="text-[color:var(--panth-ink)]">{ACTION_LABELS[action]}</span>
      <span className="rounded bg-white/10 px-2 py-1 font-mono text-xs text-[color:var(--panth-ink)]">
        {keyboardCode}
      </span>
      <Button variant="ghost" onClick={onRemapKeyboard} aria-label={`Remap keyboard ${action}`}>
        Remap
      </Button>
      <span className="hidden rounded bg-white/10 px-2 py-1 font-mono text-xs text-[color:var(--panth-ink)] sm:inline">
        Btn {gamepadIndex}
      </span>
      <Button
        variant="ghost"
        onClick={onRemapGamepad}
        aria-label={`Remap gamepad ${action}`}
        className="hidden sm:inline-flex"
      >
        Remap
      </Button>
    </>
  );
}

// --------------------------------------------------------------------------
// Remap capture modal
// --------------------------------------------------------------------------

interface RemapModalProps {
  source: 'keyboard' | 'gamepad';
  action: InputAction;
  onCommit: (value: string | number) => void;
  onCancel: () => void;
}

function RemapModal({ source, action, onCommit, onCancel }: RemapModalProps) {
  const committedRef = useRef(false);

  useEffect(() => {
    if (source !== 'keyboard') return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (committedRef.current) return;
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      // Use e.code — matches the store's default schema (KeyW, Space, etc.).
      committedRef.current = true;
      e.preventDefault();
      onCommit(e.code);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [source, onCommit, onCancel]);

  useEffect(() => {
    if (source !== 'gamepad') return undefined;
    let raf = 0;
    let cancelled = false;
    const scan = () => {
      if (cancelled || committedRef.current) return;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const pad of pads) {
        if (!pad) continue;
        for (let i = 0; i < pad.buttons.length; i += 1) {
          const b = pad.buttons[i];
          if (b !== undefined && b.pressed) {
            committedRef.current = true;
            onCommit(i);
            return;
          }
        }
      }
      raf = requestAnimationFrame(scan);
    };
    raf = requestAnimationFrame(scan);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
    };
  }, [source, onCommit, onCancel]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={`Remap ${action} ${source}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[color:var(--panth-bg)] px-8 py-6 shadow-2xl">
        <span className="text-xs uppercase tracking-widest text-[color:var(--panth-ink-dim)]">
          Remap {source} · {ACTION_LABELS[action]}
        </span>
        <span className="text-xl font-semibold text-[color:var(--panth-ink)]">
          {source === 'keyboard' ? 'Press any key\u2026' : 'Press any button\u2026'}
        </span>
        <span className="text-xs text-[color:var(--panth-ink-dim)]">Escape to cancel</span>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
