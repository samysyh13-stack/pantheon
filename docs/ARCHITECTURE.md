# ARCHITECTURE — PANTHÉON

**Status**: Phase 0 draft. Pending user approval.
**Last updated**: 2026-04-24.

> This document captures the technical skeleton. Any deviation after approval requires an ADR entry in `/docs/DECISIONS.md`.

---

## 1. Topology

PANTHÉON is a single-page web application. All gameplay runs client-side. **No game server in v1.** Persistence is local (IndexedDB via Dexie). Deploy is static (Cloudflare Pages + R2 for the heavier assets). v1.1 adds WebRTC peer-to-peer multiplayer with a Cloudflare Worker as a minimal signaling relay; still no authoritative server.

```
             ┌─────────────────────────┐
             │  Cloudflare Pages       │
             │  (static app bundle)    │
             └───────────┬─────────────┘
                         │ HTTPS
            ┌────────────▼────────────┐
            │   Browser (PWA)         │
            │  ┌───────────────────┐  │
            │  │  React shell      │  │
            │  │  + R3F Canvas     │  │
            │  │  + Zustand store  │  │
            │  │  + Rapier (WASM)  │  │
            │  │  + Howler / Tone  │  │
            │  │  + IndexedDB      │  │
            │  └───────────────────┘  │
            └─────────────────────────┘
                         │
                         │ (v1.1+) WebRTC
                         ▼
             ┌─────────────────────────┐
             │  Cloudflare Worker      │
             │  (signaling relay only) │
             └─────────────────────────┘
```

## 2. Folder Structure

```
/ (repo root)
  CLAUDE.md                         — context for Claude Code sessions
  README.md                         — project overview + run instructions
  package.json
  vite.config.ts
  tsconfig.json
  .eslintrc.json / .prettierrc
  .github/
    workflows/
      deploy.yml                    — Cloudflare Pages deploy on push to main
      ci.yml                        — lint + typecheck + unit + e2e
  public/
    icons/                          — PWA icons (16, 32, 192, 256, 512, 1024)
    hdri/                           — environment maps (KTX2 preferred)
    models/                         — glTF 2.0 (Draco + KTX2 compressed)
    textures/
    audio/                          — Opus-encoded where possible
    fonts/
    manifest.webmanifest
  src/
    main.tsx                        — entrypoint
    app/
      App.tsx                       — router + top-level layout
      shell/                        — menu and UI shell
    game/
      engine/
        loop.ts                     — fixed-tick game loop (60 Hz)
        scheduler.ts                — deterministic task scheduler
        random.ts                   — seeded RNG (mulberry32)
      systems/
        input/
          keyboard.ts
          mouse.ts
          gamepad.ts
          touch.ts
          virtualJoystick.ts
          manager.ts                — merges all streams into unified stream
        combat/
          hitbox.ts
          damage.ts
          statusEffects.ts
        ai/
          behaviorTree.ts
          difficulties/
            easy.ts
            normal.ts
            hard.ts
          gods/
            anansiBot.ts
            brigidBot.ts
            susanooBot.ts
        physics/                    — Rapier bindings + helpers
        audio/
          mixer.ts
          sfx.ts
          music.ts                  — Tone.js layer crossfader
        pickups/
        breakables/
      entities/
        character/
          Character.tsx             — shared character component
          animationFSM.ts           — finite-state animation machine
          characterController.ts    — Rapier-driven controller
        projectiles/
        particles/
      gods/
        anansi/
          Anansi.tsx
          kit.ts
          vfx.ts
          audio.ts
        brigid/
        susanoo/
      arenas/
        sacredGrove/
          SacredGrove.tsx
          colliders.ts
          spawners.ts
          lighting.ts
      modes/
        duel.ts
        totemRush.ts
      match/
        StateMachine.ts             — match state machine (menu→select→…→result)
        scoring.ts
        pickupSpawner.ts
    rendering/
      Canvas.tsx                    — configured R3F canvas wrapper
      postprocessing/
        outline.ts
        bloom.ts
        colorGrade.ts
        ssao.ts                     — desktop-only
      materials/
        Toon.tsx                    — cel-shaded base (three-custom-shader-material)
        Rim.tsx
        StormShader.tsx
      presets/
        ultra.ts
        high.ts
        medium.ts
        low.ts
        battery.ts
        detect.ts                   — device capability detection
    ui/
      hud/
        HealthBar.tsx
        AbilityIcons.tsx
        UltimateCharge.tsx
        MatchTimer.tsx
      menus/
        MainMenu.tsx
        GodSelect.tsx
        Settings.tsx
        Results.tsx
      tutorial/
        TutorialFlow.tsx
        steps/
      components/                   — shared primitives (handbuilt)
        Button.tsx
        Slider.tsx
        Toggle.tsx
        Joystick.tsx
    state/
      store.ts                      — Zustand root
      slices/
        player.ts
        match.ts
        settings.ts
        profile.ts
    persistence/
      db.ts                         — Dexie schema
      migrations/
    net/                            — v1.1+; stubbed in v1
      rtc/
      signaling/
      lockstep/
    utils/
      math.ts
      logger.ts
      perf.ts                       — budget enforcement + FPS counter
      deviceId.ts
  docs/                             — (as in /docs/AGENTS.md Section 6.3)
  tests/
    unit/                           — vitest
    e2e/                            — playwright
    perf/                           — puppeteer-driven benchmark
```

## 3. Tech Stack — Rationale

| Layer | Pick | Locked because |
|---|---|---|
| Language | TypeScript strict | Claude Code's strongest zone. Refactors without fear. |
| Build | Vite 6 + SWC | Near-instant HMR non-negotiable for 14-day iteration speed. |
| 3D runtime | Three.js r170 + R3F 9 | R3F's JSX model maps cleanly to component-per-entity. Three.js is the standard. |
| Renderer | WebGL2 default; WebGPU behind opt-in flag | Mobile Safari 2026 still lags on WebGPU. |
| Physics | @react-three/rapier | WASM-fast. Deterministic integration — required for v1.1 lockstep. |
| State | Zustand + immer | Accessible from gameplay systems (AI, physics) without React prop drilling. |
| Animation | three-stdlib AnimationMixer | Built-in. Zero extra deps. |
| Post-processing | `postprocessing` (pmndrs) | Tuned effect composer for R3F. |
| Audio | Howler.js (SFX) + Tone.js (music) | Howler for one-shots; Tone for the adaptive layering crossfader. |
| Input | Custom unified manager | No single library covers keyboard + mouse + gamepad + touch + virtual joystick well. |
| UI | React + Tailwind v4 | Minimal bundle weight vs MUI/Bootstrap. Utility-first composes quickly. |
| Persistence | Dexie (IndexedDB) | No backend. Async-safe. Durable across sessions. |
| PWA | vite-plugin-pwa (Workbox) | Battle-tested. Correct service-worker defaults. |
| Deploy | Cloudflare Pages + R2 | Free tier, global CDN, push-to-deploy from GitHub. |
| Observability | Plausible + Sentry | Both opt-in via env; ship without them if not provisioned. |

## 4. Performance Budgets

These budgets are enforced in `src/utils/perf.ts` and warned-on in dev builds when exceeded. CI fails on > 10% frame-time regression.

### Mobile (iPhone 12 / Pixel 6 class) — target

| Metric | Budget |
|---|---|
| Frame time | ≤ 33.3 ms (30 FPS) |
| Draw calls / frame | ≤ 150 |
| Triangles rendered | ≤ 150k |
| Active physics bodies | ≤ 40 |
| Texture memory resident | ≤ 128 MB |
| Initial download (critical path to first match) | ≤ 25 MB |
| Total asset budget (all v1 content) | ≤ 80 MB |
| Main thread JS per frame | ≤ 12 ms |

### Desktop (Intel UHD 620 / integrated class) — target

| Metric | Budget |
|---|---|
| Frame time | ≤ 16.6 ms (60 FPS) |
| Draw calls / frame | ≤ 400 |
| Triangles rendered | ≤ 500k |
| Active physics bodies | ≤ 100 |
| Main thread JS per frame | ≤ 6 ms |

### Budget enforcement

- `src/utils/perf.ts` exports `enforceBudget(stats)` — called each frame in dev; warns to console + toast on exceed.
- CI runs a 10-second headless rendered match benchmark per PR. p99 frame time must stay within 110% of the previous main build.
- Bundle analysis (`rollup-plugin-visualizer`) runs on every build; PRs that push the bundle over budget fail.

## 5. Build Pipeline

```
npm run dev       → Vite dev server (HMR)
npm run build     → production bundle
npm run preview   → local preview of production build
npm run test      → vitest (unit + integration)
npm run e2e       → playwright
npm run perf      → headless benchmark
npm run analyze   → rollup-plugin-visualizer
npm run typecheck → tsc --noEmit
npm run lint      → eslint
npm run format    → prettier --write .
```

### Production bundle split

- `index-<hash>.js` — shell only (≤ 200 KB gzipped).
- `engine-<hash>.js` — core systems — input, physics, rendering, audio mixer (≤ 500 KB gzipped).
- `god-<name>-<hash>.js` — per-god kit + VFX + audio metadata; lazy-loaded at match start.
- `arena-<name>-<hash>.js` — per-arena geometry references + spawners; lazy-loaded during god select.
- Model / texture / audio files served from R2 CDN with aggressive cache headers (1-year immutable on hashed filenames).

## 6. Deploy Pipeline

1. Push to `main` triggers `.github/workflows/deploy.yml`.
2. CI runs `npm ci → typecheck → lint → test → e2e → build`.
3. On success, `dist/` deploys to Cloudflare Pages via the official action.
4. Assets > 1 MB (models, audio) upload to R2 via a pre-build step with content-addressed names.
5. Sentry source maps upload via `@sentry/cli` if `VITE_SENTRY_DSN` is set.
6. Deploy posts the URL to the PR (when deployed from a PR preview).

### Secrets required

- `CLOUDFLARE_API_TOKEN` — for Pages deploy.
- `CLOUDFLARE_ACCOUNT_ID`.
- (optional) `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- (optional) `VITE_PLAUSIBLE_DOMAIN`.

User provisions these; orchestrator will generate a `SECRETS.md` template in Phase 0 step 11.

## 7. Determinism Strategy (v1.1 Networking Readiness)

v1 is designed so v1.1 netcode is a minimal retrofit:

- **No `Math.random()`** in gameplay systems — always use `game.engine.random.next()`, seeded per match.
- **No `performance.now()`** inside simulation — simulation advances by fixed-tick deltas only; wall time is UI/render-only.
- **Rapier deterministic mode**: set `integrationParameters.dt = 1/60`, disable sleeping on tracked bodies, pin CCD off for non-projectile dynamics.
- **Input captured per-tick** and replayable from a recorded input log (also useful for bug repro).
- **Side-effect-free update ordering**: input → AI decisions → physics step → damage resolution → status effects → cooldowns → spawn/despawn → render. Same order every tick, no ordering dependence on async callbacks.

## 8. State Architecture

Zustand store, with `immer` middleware for ergonomic nested mutations.

Four slices:

- `settings` — graphics preset, audio mix, controls, accessibility. Persisted to IndexedDB.
- `profile` — player name, god preference, match history (last 20). Persisted.
- `match` — current match state: score, timers, active abilities, pickup spawn state. Transient; reset between matches.
- `net` — peer state for v1.1+; empty object in v1.

### Selector and re-render discipline

- React components use `zustand/shallow` equality to avoid re-renders on unrelated changes.
- **Gameplay systems that update every tick bypass the React tree entirely** — they mutate refs and drive Three.js directly. The React tree renders HUD, menus, and non-gameplay UI only.
- HUD elements subscribe to narrow selector slices (only HP, only ult charge) and re-render on change, typically at 5–20 Hz rather than per-frame.

## 9. Rendering Architecture

R3F `<Canvas>` at the app root, configured per graphics preset:

```tsx
<Canvas
  gl={{
    antialias: preset >= 'high',
    powerPreference: 'high-performance',
    stencil: false,
    depth: true,
    logarithmicDepthBuffer: false,
  }}
  dpr={[1, preset >= 'high' ? 2 : 1.5]}
  shadows={preset >= 'medium'}
  frameloop="always"
/>
```

### Post-processing pipeline

Implemented via `postprocessing` (pmndrs). Per-preset composition:

| Pass | Ultra | High | Medium | Low | Battery |
|---|---|---|---|---|---|
| Outline (Sobel) | 2px | 2px | 1px | 1px | 1px |
| Bloom | on | on | on | off | off |
| Color grade LUT | on | on | on | on | off |
| SSAO | on | off | off | off | off |
| Tone map | ACESFilmic | ACESFilmic | ACESFilmic | Linear | Linear |

### Material strategy

- Base: `MeshToonMaterial` variants from drei + custom cel shader banding via three-custom-shader-material.
- Shared uniform groups across characters to minimize shader variants.
- Rim-light pass is a fragment-shader addition, not a second material.
- Character shader instances: 3 (one per god). Arena shader: 1. Projectile shader: 1. VFX shaders: 3–5. Total shader variants: ≤ 12 at any time.

### LOD strategy

- Characters have two LODs (near / far) swapped at 18 m camera distance.
- Arena geometry is single-LOD (small enough that LOD overhead costs more than saving).
- Particles use instanced rendering throughout. No per-particle draw calls.

## 10. Test Strategy

### Unit (vitest)

- Pure logic — damage math, RNG determinism, AI decision scoring, FSM transitions, mode scoring rules.
- Target: 80% line coverage on `/src/game/` by end of Phase 2.

### Integration (vitest)

- Zustand slice end-to-end flows (settings change → persistence → reload → apply).
- Match state machine full-run from menu to results screen.

### E2E (Playwright)

- Menu flow: load → main → god select → settings → back.
- Settings persistence: change graphics preset → reload → verify preset applied.
- Tutorial completion flow.
- Visual regression snapshots of HUD at 1x and 2x DPR, portrait and landscape.
- Cross-browser matrix: Chromium, Firefox, WebKit.

### Performance

- Puppeteer-driven canned-match benchmark in CI — renders 10 seconds of a scripted match, asserts p99 frame time within budget.
- Separate mobile simulation via Chromium CPU throttling 4x + GPU throttling.

### Manual QA

- QA subagent playthroughs logged in `/docs/qa/<session>.md` at Phase 2, 3, 4 gates.
- Cross-device manual pass at Phase 4 ship checklist.

## 11. Save / Persistence Schema

```ts
// src/persistence/db.ts
import Dexie, { Table } from 'dexie';

export interface Profile {
  id: 'local';
  name: string;
  godPreference: GodId;
  matches: MatchRecord[];      // cap 20, FIFO
  firstPlayed: number;         // epoch ms
  lastPlayed: number;
}

export interface Settings {
  id: 'local';
  graphicsPreset: 'ultra' | 'high' | 'medium' | 'low' | 'battery' | 'auto';
  audio: { master: number; sfx: number; music: number; voice: number; mono: boolean };
  controls: {
    keyboard: Record<string, string>;
    gamepad: Record<string, string>;
    touchScale: number;
    touchOpacity: number;
  };
  accessibility: {
    reducedMotion: boolean;
    highContrast: boolean;
    colorblindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    subtitles: boolean;
    damageNumbers: boolean;
  };
}

export interface MatchRecord {
  id: string;
  mode: 'duel' | 'totem_rush';
  god: GodId;
  opponent: GodId;
  result: 'win' | 'loss' | 'draw';
  duration: number;
  damageDealt: number;
  damageTaken: number;
  endedAt: number;
}

class DB extends Dexie {
  profile!: Table<Profile, 'local'>;
  settings!: Table<Settings, 'local'>;
  constructor() {
    super('panthenon');
    this.version(1).stores({ profile: 'id', settings: 'id' });
  }
}
```

## 12. Input Pipeline

Unified stream emitted by `src/game/systems/input/manager.ts`:

```ts
interface InputFrame {
  moveX: number;          // -1 to 1
  moveY: number;          // -1 to 1
  aimX: number;           // -1 to 1 (normalized vector)
  aimY: number;
  aimMagnitude: number;   // 0 to 1 (0 = no aim, >0 = actively aiming)
  basicAttack: boolean;
  ability: boolean;
  ultimate: boolean;
  dodge: boolean;
  pause: boolean;
  source: 'keyboard+mouse' | 'gamepad' | 'touch';
}
```

Emitted at the render framerate; sampled at the tick frequency for simulation. Gameplay systems consume `InputFrame` only — they never touch DOM events directly.

Remap is persisted in `Settings.controls`. Default keymaps are listed in `src/game/systems/input/defaults.ts`.

### Touch-specific behaviors

- Left half of screen: virtual move joystick (thumb-dock adapts to thumb position on first touch).
- Right half: aim joystick (drag to aim, release to fire basic attack). Dedicated buttons for ability, ultimate, dodge overlay at bottom-right.
- Multi-touch: up to 3 concurrent touches tracked (move, aim, button press).
- Haptic pulse (Android only) on button press and hit confirms.

### Gamepad behaviors

- `navigator.getGamepads()` polled each frame.
- Remap per-controller-id (Xbox vs PlayStation vs generic).
- Hot-plug detected via `gamepadconnected`/`gamepaddisconnected` events.

## 13. Error, Observability, Privacy

- **Sentry**: opt-in via `VITE_SENTRY_DSN`. PII strip on by default (no IPs, no user identifiers).
- **Plausible**: opt-in via `VITE_PLAUSIBLE_DOMAIN`. No cookies. No personal data. Anonymous page views + custom match-start / match-end events only.
- **Logger**: `src/utils/logger.ts` — dev routes to `console.*`; prod routes to Sentry if configured.
- **Privacy policy**: zero data collection by default beyond anonymous Plausible metrics. Policy page auto-generated from a template in Phase 4.
- **No third-party scripts on the page** other than optional Sentry and Plausible.

## 14. Security Considerations

- No user-generated content in v1. No XSS surface beyond React's default protections.
- No authentication in v1. No secrets on client beyond optional public env vars.
- WebRTC (v1.1+) — peer IDs are random per session; nothing PII-adjacent. Signaling relay forwards opaque blobs only.
- PWA service worker restricted to asset caching; no sensitive data cached.

## 15. Accessibility Architecture

- Settings' accessibility slice wires through `<AccessibilityProvider>` at app root.
- Reduced motion applies to: camera shake, bloom flashes, particle density, menu transitions.
- High contrast applies to: outline pass thickness+contrast, HUD background opacity, character rim intensity.
- Colorblind palettes swap team + pickup colors at the material level (not post-process) to preserve contrast.

## 16. Known-Unknowns to Resolve

- Exact Rapier deterministic settings for our physics scale (discover in Phase 1).
- `three-nebula` vs hand-rolled particles final choice (RS2 research task in Phase 1).
- Meshy / Tripo asset pipeline: glTF export settings and Blender retouch budget (establish in Phase 2).
- PWA installability on iOS Safari quirks (audit at Phase 1 end).

---

*End of Architecture Document.*
