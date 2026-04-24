import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '../persistence/db';

export type GraphicsPreset = 'ultra' | 'high' | 'medium' | 'low' | 'battery' | 'auto';
export type ColorblindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export interface AudioSettings {
  master: number;
  sfx: number;
  music: number;
  voice: number;
  mono: boolean;
}

export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  colorblindMode: ColorblindMode;
  subtitles: boolean;
  damageNumbers: boolean;
}

// Input control remap — extended by Input Systems Engineer (T-001).
// The action set is small and closed; the value is a key code for keyboard
// (KeyboardEvent.code — "KeyW", "Space", "Escape", "Mouse0", "Mouse2", "MouseMove")
// or a standard-mapping Gamepad API button index for gamepad.
// `touchScale` and `touchOpacity` replace the previous standalone `touch` slice.
export type InputAction =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'basicAttack'
  | 'ability'
  | 'ultimate'
  | 'dodge'
  | 'pause';

export interface ControlSettings {
  keyboard: Record<InputAction, string>;
  gamepad: Record<InputAction, number>;
  touchScale: number;
  touchOpacity: number;
}

export interface Settings {
  graphicsPreset: GraphicsPreset;
  renderer: 'webgl2' | 'webgpu';
  audio: AudioSettings;
  accessibility: AccessibilitySettings;
  controls: ControlSettings;
}

export type MatchScreen = 'menu' | 'god-select' | 'loading' | 'match' | 'results';

export interface MatchSlice {
  screen: MatchScreen;
  timerMs: number;
}

export interface AppState {
  settings: Settings;
  match: MatchSlice;
  setGraphicsPreset: (p: GraphicsPreset) => void;
  setRenderer: (r: 'webgl2' | 'webgpu') => void;
  setAudio: (patch: Partial<AudioSettings>) => void;
  setAccessibility: (patch: Partial<AccessibilitySettings>) => void;
  setControls: (patch: Partial<ControlSettings>) => void;
  setKeyboardBinding: (action: InputAction, code: string) => void;
  setGamepadBinding: (action: InputAction, buttonIndex: number) => void;
  setScreen: (s: MatchScreen) => void;
}

// Default keyboard + gamepad bindings mirror /src/game/systems/input/defaults.ts.
// Duplicated here (not imported) to keep the persisted-state shape self-contained
// and avoid a store-to-input-system build-time dependency cycle.
const defaultKeyboard: Record<InputAction, string> = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  basicAttack: 'Mouse0',
  ability: 'Mouse2',
  ultimate: 'Space',
  dodge: 'ShiftLeft',
  pause: 'Escape',
};

// Standard-mapping gamepad buttons, per W3C Gamepad API.
// Axes 0/1 (left stick) and 2/3 (right stick) are not remappable in v1.
const defaultGamepad: Record<InputAction, number> = {
  moveUp: 12, // dpad up — fallback to left stick via axes
  moveDown: 13,
  moveLeft: 14,
  moveRight: 15,
  basicAttack: 7, // RT
  ability: 5, // RB
  ultimate: 3, // Y / Triangle
  dodge: 6, // LT
  pause: 9, // Start / Options
};

const defaultSettings: Settings = {
  graphicsPreset: 'auto',
  renderer: 'webgl2',
  audio: { master: 1, sfx: 1, music: 0.8, voice: 1, mono: false },
  accessibility: {
    reducedMotion: false,
    highContrast: false,
    colorblindMode: 'none',
    subtitles: false,
    damageNumbers: true,
  },
  controls: {
    keyboard: { ...defaultKeyboard },
    gamepad: { ...defaultGamepad },
    touchScale: 1,
    touchOpacity: 0.7,
  },
};

// Shape of persisted state prior to ControlSettings (persist version 1).
interface PersistedV1 {
  settings?: {
    graphicsPreset?: GraphicsPreset;
    renderer?: 'webgl2' | 'webgpu';
    audio?: AudioSettings;
    accessibility?: AccessibilitySettings;
    touch?: { scale?: number; opacity?: number };
  };
}

// v1 -> v2: fold `touch` into `controls` and seed default keymaps.
function migrateV1ToV2(raw: unknown): { settings: Settings } {
  const v1 = (raw ?? {}) as PersistedV1;
  const prior = v1.settings ?? {};
  const touchScale = prior.touch?.scale ?? defaultSettings.controls.touchScale;
  const touchOpacity = prior.touch?.opacity ?? defaultSettings.controls.touchOpacity;
  return {
    settings: {
      graphicsPreset: prior.graphicsPreset ?? defaultSettings.graphicsPreset,
      renderer: prior.renderer ?? defaultSettings.renderer,
      audio: { ...defaultSettings.audio, ...(prior.audio ?? {}) },
      accessibility: { ...defaultSettings.accessibility, ...(prior.accessibility ?? {}) },
      controls: {
        keyboard: { ...defaultKeyboard },
        gamepad: { ...defaultGamepad },
        touchScale,
        touchOpacity,
      },
    },
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      match: { screen: 'menu', timerMs: 0 },
      setGraphicsPreset: (p) =>
        set((s) => ({ settings: { ...s.settings, graphicsPreset: p } })),
      setRenderer: (r) => set((s) => ({ settings: { ...s.settings, renderer: r } })),
      setAudio: (patch) =>
        set((s) => ({ settings: { ...s.settings, audio: { ...s.settings.audio, ...patch } } })),
      setAccessibility: (patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            accessibility: { ...s.settings.accessibility, ...patch },
          },
        })),
      setControls: (patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            controls: { ...s.settings.controls, ...patch },
          },
        })),
      setKeyboardBinding: (action, code) =>
        set((s) => ({
          settings: {
            ...s.settings,
            controls: {
              ...s.settings.controls,
              keyboard: { ...s.settings.controls.keyboard, [action]: code },
            },
          },
        })),
      setGamepadBinding: (action, buttonIndex) =>
        set((s) => ({
          settings: {
            ...s.settings,
            controls: {
              ...s.settings.controls,
              gamepad: { ...s.settings.controls.gamepad, [action]: buttonIndex },
            },
          },
        })),
      setScreen: (screen) => set((s) => ({ match: { ...s.match, screen } })),
    }),
    {
      name: 'panthenon-state',
      version: 2,
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({ settings: state.settings }),
      migrate: (persisted, version) => {
        if (version < 2) return migrateV1ToV2(persisted);
        return persisted as { settings: Settings };
      },
    },
  ),
);
