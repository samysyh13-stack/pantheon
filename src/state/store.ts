import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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

export interface TouchSettings {
  scale: number;
  opacity: number;
}

export interface Settings {
  graphicsPreset: GraphicsPreset;
  renderer: 'webgl2' | 'webgpu';
  audio: AudioSettings;
  accessibility: AccessibilitySettings;
  touch: TouchSettings;
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
  setTouch: (patch: Partial<TouchSettings>) => void;
  setScreen: (s: MatchScreen) => void;
}

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
  touch: { scale: 1, opacity: 0.7 },
};

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
      setTouch: (patch) =>
        set((s) => ({ settings: { ...s.settings, touch: { ...s.settings.touch, ...patch } } })),
      setScreen: (screen) => set((s) => ({ match: { ...s.match, screen } })),
    }),
    {
      name: 'panthenon-state',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
    },
  ),
);
