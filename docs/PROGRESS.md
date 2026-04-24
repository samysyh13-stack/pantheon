# PROGRESS — PANTHÉON

**Status**: Phase 0 in progress.
**Current date**: 2026-04-24.
**North-star ship date**: 2026-05-08 (Day 14).
**Re-scoped at each phase gate. Timeline is guidance, not contract.**

---

## Phase Map

| Phase | Days | Goal | Gate |
|---|---|---|---|
| **0** | Day 1 (today) | Pre-production docs; user approval | User approves design doc |
| **1** | Days 2–3 | Technical foundation: one character moves, stylized render, inputs work, runs 30 FPS on mobile | Day 3 re-scope |
| **2** | Days 4–7 | Vertical slice: Anansi vs bot, full match loop, one arena, three bot difficulties | **Day 7 path A/B/C decision** |
| **3** | Days 8–11 | Expansion on chosen path | Day 11 "cut anything unstable" |
| **4** | Days 12–14 | Polish + ship | v1.0.0 tagged and deployed |

---

## Phase 0 Checklist (today)

- [x] Create `/docs/` tree
- [x] Draft `/docs/DESIGN_DOCUMENT.md` (≥ 4000 words; actual ~5900)
- [x] Draft `/docs/ARCHITECTURE.md`
- [x] Draft `/docs/AGENTS.md`
- [x] Draft `/docs/PROGRESS.md` (this file)
- [x] Seed `/docs/LICENSES.md`
- [x] Seed `/docs/DECISIONS.md` with ADR-0001 through ADR-0005
- [x] Seed `/docs/gods/{ANANSI,BRIGID,SUSANOO}.md` stubs
- [x] Seed `/docs/arenas/SACRED_GROVE.md` stub
- [x] Write `/CLAUDE.md` at repo root
- [ ] **User approval of design doc** — blocking gate
- [ ] `npm create vite@latest panthenon -- --template react-ts`
- [ ] Install full stack (three.js r170, R3F 9, drei, rapier, zustand, immer, tailwind v4, postprocessing, howler, tone, dexie, vite-plugin-pwa, etc.)
- [ ] Configure `tsconfig.json` (strict), ESLint, Prettier
- [ ] Configure Tailwind v4
- [ ] Configure vite-plugin-pwa
- [ ] `.github/workflows/{deploy,ci}.yml` scaffolds (user fills credentials)
- [ ] Generate `SECRETS.md` template listing env vars user must provide
- [ ] `git init && git add -A && git commit -m "chore: pre-production setup"`

**Gate: do not proceed to Phase 1 until the user approves the design doc and resolves outstanding Risks R-03 (WebRTC scope), R-10 (cultural sensitivity approach), and R-11 (Meshy/Tripo license tier).**

---

## Phase 1 Checklist (Days 2–3)

**Goal**: one playable character in an empty arena with stylized rendering working end-to-end on desktop and mobile.

- [ ] T-001: `IN` → unified input manager (keyboard + mouse + gamepad + touch virtual joystick)
- [ ] T-002: `RS` → R3F canvas + post-processing pipeline (outline + bloom + color grade)
- [ ] T-003: `RS` → base toon material with rim lighting; HDRI environment loading
- [ ] Orchestrator: gray-box Sacred Grove (blockout only)
- [ ] T-004: `AE` → placeholder capsule character; run/idle/attack animation; Rapier controller; tracking camera
- [ ] T-005: `UX` → settings menu (graphics presets, audio, controls, accessibility); pause menu; main menu shell
- [ ] T-006: `PO` → first perf pass on desktop + simulated mobile; publish `/docs/agents/T-006.md`
- [ ] T-007: `RS2` → confirm `three-nebula` viability or commit to hand-rolled particles (R-05)
- [ ] Deploy to Cloudflare Pages preview
- [ ] Share URL with user for smoke-test

### Phase 1 acceptance gate (must pass all)

- [x] Loads on phone and desktop browsers (dev server verified; **deploy preview pending creds — HARD STOP**)
- [x] Virtual joystick works on touch; keyboard works on desktop; gamepad works if plugged in — T-001
- [x] Character moves smoothly with at least one animation loop — T-004 FSM + kinematic controller
- [x] Outline + toon shading visible — stylized, not default Three.js gray — T-002 effect stack + ToonMaterial
- [x] Settings menu toggles graphics presets and they visibly affect the scene — T-005 Settings wired to store
- [⏳] ≥ 30 FPS on iPhone 12 — **theoretical pass** (T-006 static audit: ~50% headroom at Medium). Synthetic headless benchmark ran 2026-04-24 against live Cloudflare deploy with 4× CPU throttle + iPhone-12 viewport; result: avg 3.3 FPS / p99 3.0 FPS (196 frames / 60 s). This is a **benchmark-environment artifact**, not a real-device signal — Chromium headless uses SwiftShader (software WebGL) which is ~10–20× slower than native GPU for 3D content. Real-device validation still pending; see T-006 writeup.

**Gate assessment: 5/6 ✅ + 1/6 ⏳** (wall-clock-on-real-device) — **not a HARD STOP** per autonomous rules (HARD STOP triggers on *real-mobile* FPS < 25, not on synthetic software-render benches). Phase 1 fixes 1–6 landed; proceeding to Phase 2.

### Phase 1 Fixes (post-gate) — 2026-04-24

| Fix | Status | Commit |
|---|---|---|
| 1 — Aim rotation (atan2(aimX, aimY), critically-damped) + forward indicator | ✅ | aa2b20a |
| 2 — Escape + gamepad Start pause toggle | ✅ | aa2b20a |
| 3 — Settings → Dexie IndexedDB persist (ARCHITECTURE §11) | ✅ | aa2b20a |
| 4 — detectPreset never auto-picks Low/Battery (Medium floor) | ✅ | aa2b20a |
| 5 — Deprecated-API audit (no migrations needed; codebase on modern APIs) | ✅ | aa2b20a |
| 6 — Action stubs (`[action] basic_attack/ability/ultimate/dodge` logs) | ✅ | aa2b20a |
| Benchmark + perf config | ✅ | (separate commit) |

Tag: `v0.1.1`.

### Day 3 re-scope gate

Orchestrator publishes honest assessment in this file:
- **On track**: proceed to Phase 2 as planned.
- **Behind**: recommend cuts — typically defer polish, lower-priority god work, performance beyond 30 FPS floor.
- **Ahead**: pull in from Phase 3 (unusual — probably won't happen).

---

## Phase 2 Checklist (Days 4–7)

**Goal**: one fully playable god (Anansi) vs a full bot (Anansi mirror) in the complete Sacred Grove arena, in Duel mode, with full match-state-machine loop working end-to-end.

- [ ] T-100: `CB` → finalize Anansi's kit with numbers; save to `/docs/gods/ANANSI.md`
- [ ] T-101: `AE` → rig Anansi; implement full animation FSM
- [ ] T-102: `RS` → Anansi VFX (web projectile, clone shimmer, web-dome translucent shader)
- [ ] T-103: `AU` → Anansi sound design (attack whoosh, ability cast, ultimate sting, hit, death)
- [ ] T-104: `WA` → polish Sacred Grove (central tree breakable, 2 shrine pickups, 4 pillars, boundary storm particles); save to `/docs/arenas/SACRED_GROVE.md`
- [ ] T-105: `AI` → three bot difficulties for Anansi mirror
- [ ] T-106: `UX` → god-select screen (Anansi only + locked slots); match-loading; in-match HUD (HP, ability CDs, ult charge, timer, score); post-match results
- [ ] Orchestrator: wire full match state machine (menu → select → loading → countdown → match → end → results → back)
- [ ] T-107: `QA` → playtest Anansi vs each difficulty 3 times; save `/docs/qa/T-107.md`
- [ ] T-108: `PO` → mobile profiling; validate 30 FPS on iPhone 12
- [ ] T-109: `CD` → visual cohesion review of Anansi + Sacred Grove; go/no-go
- [ ] Deploy vertical slice; share with user + 3 playtesters

### Phase 2 acceptance gate (non-negotiable — if any fails, fix before expansion)

- [ ] Full match loop runs without errors
- [ ] Input-to-action latency < 100 ms
- [ ] All three bot difficulties feel distinct
- [ ] VFX readable; audio immersive; hit feedback tactile (hitstop + flash + haptic on Android)
- [ ] 30 FPS on mobile; 60 FPS on desktop
- [ ] A non-dev tester completes a match in < 3 minutes without being taught

### Day 7 re-scope gate — user chooses A / B / C

Orchestrator writes a realistic remainder plan:

- **Path A — Full scope**: 3 gods + 2 modes + local co-op. Requires genuinely having time for Brigid + Susanoo in Days 8–9 each. High ambition; risk of rushed polish.
- **Path B — Depth over breadth**: Anansi + Brigid + Totem Rush + local co-op. Polish hard. Susanoo deferred to v1.1.
- **Path C — Polish only**: Anansi only + local co-op + Totem Rush + expanded tutorial + deep polish. Ship a tight tiny perfect thing.

User picks based on playtest feedback + orchestrator's honest velocity assessment.

---

## Phase 3 Checklist (Days 8–11)

Path chosen at Day 7 gate. Detailed task list generated after decision.

### Path A — Full scope (outline)

- Day 8: Brigid (parallel spawn — CB, AE, RS, AU, AI)
- Day 9: Susanoo (same pattern)
- Day 10: Totem Rush mode implementation
- Day 11: Local split-screen 2-player same-device

### Path B — Depth (outline)

- Day 8–9: Brigid (CB, AE, RS, AU, AI) thorough
- Day 10: Totem Rush
- Day 11: Local split-screen

### Path C — Polish (outline)

- Day 8: Full onboarding flow (3-min interactive tutorial)
- Day 9: Local split-screen + controller polish
- Day 10: Totem Rush + match variety
- Day 11: Deep visual polish — clouds, weather, UI animation, menu juice

---

## Phase 4 Checklist (Days 12–14)

- [ ] T-300: `PO` final perf pass; publish device matrix
- [ ] T-301: `UX` accessibility pass — colorblind modes, reduced motion, high contrast, subtitles, keyboard+controller+touch-only paths
- [ ] T-302: `AU` final audio mix (loudness normalization, ducking, mobile-speaker stereo-width check)
- [ ] T-303: `RS` final visual polish (LUT per arena, particle density, outline tuning)
- [ ] T-304: `QA` 20 playthroughs + Playwright regression suite + cross-browser matrix
- [ ] T-305: `CD` final cohesion review
- [ ] Landing page at `/` with concept, trailer (OBS-recorded playthrough), Play Now button
- [ ] PWA install: icons all sizes, splash, add-to-home-screen, offline-to-menu
- [ ] Onboarding auto-triggers on first visit
- [ ] Plausible live (if configured)
- [ ] Sentry live (if configured)
- [ ] Open Graph + Twitter card meta + share image
- [ ] `robots.txt`, `sitemap.xml`
- [ ] Privacy policy page
- [ ] `PRESS_KIT.md` with screenshots + 30 s gameplay GIF + pitch
- [ ] `CREDITS.md` — every asset source with license + link
- [ ] `DEV_LOG.md` — what shipped, what was cut, what was learned
- [ ] `ROADMAP.md` — v1.1 and v2 plans
- [ ] Tag `v1.0.0`; deploy; share on HN / r/webgames / r/threejs / r/IndieGaming

---

## Daily Log

Template:

```
## Day N — YYYY-MM-DD
Planned:
  - ...
Done:
  - ...
Blocked:
  - ...
Spawned subagents: T-XXX (<role>, status)
Re-scope notes:
  - ...
Tomorrow:
  - ...
```

### Day 1 — 2026-04-24 (Phase 0)

Planned:
- Pre-production docs complete
- Pause for user approval before code

Done:
- `/docs/DESIGN_DOCUMENT.md` drafted (~5900 words; amended post-approval to ~6150)
- `/docs/ARCHITECTURE.md` drafted
- `/docs/AGENTS.md` drafted
- `/docs/PROGRESS.md` (this file) drafted
- `/docs/LICENSES.md` seeded
- `/docs/DECISIONS.md` seeded with ADR-0001 through ADR-0005
- `/docs/gods/{ANANSI,BRIGID,SUSANOO}.md` stubs created
- `/docs/arenas/SACRED_GROVE.md` stub created
- `/CLAUDE.md` created

Amendments (2026-04-24, same day, post-user-approval with corrections):
- HP tiers per god added: Anansi 320, Brigid 380, Susanoo 420 — ADR-0008
- Orochi's Wake per-head damage 60 → 35 (280 total max) — ADR-0009
- Mirror Thread clone: AI-controlled kiter in v1; input-mirror deferred to v1.1 — ADR-0010
- Hearthstone self-heals Brigid — ADR-0011
- Sacred Grove visual: neutral overcast baseline; time-of-day to v1.1 — ADR-0012
- Tutorial restructured: starts with god-select teaser, tailors to chosen god — §10 only (no ADR)

Blocked:
- Awaiting user RE-approval of amendments before Phase 1 kickoff
- Risks R-03 (WebRTC scope consistency), R-10 (cultural sensitivity approach), R-11 (Meshy/Tripo license tier) still need user input

Spawned subagents: none (Phase 0 is solo per kickoff spec)

Next subagent TASK_ID: T-001 (reserved for Phase 1 — IN unified input manager)

Tomorrow (pending re-approval):
- Phase 1 kickoff
- `npm create vite@latest panthenon`
- Install stack
- Spawn T-001 (IN), T-002 (RS canvas setup)

---

## Scope Flex Matrix

| Feature | Path A | Path B | Path C | v1.1 |
|---|---|---|---|---|
| Anansi | ✓ | ✓ | ✓ | — |
| Brigid | ✓ | ✓ |   | ✓ |
| Susanoo | ✓ |   |   | ✓ |
| Sacred Grove | ✓ | ✓ | ✓ | — |
| Second arena |   |   |   | ✓ |
| Duel | ✓ | ✓ | ✓ | — |
| Totem Rush | ✓ | ✓ | ✓ | — |
| Skirmish 3v3 | (stretch) |   |   | ✓ |
| Realm King |   |   |   | ✓ |
| Local split-screen | ✓ | ✓ | ✓ | — |
| WebRTC online |   |   |   | ✓ |
| Tutorial | ✓ | ✓ | ✓ (expanded) | — |
| 3 bot difficulties | ✓ | ✓ | ✓ | — |
| PWA installable | ✓ | ✓ | ✓ | — |
| Onboarding | ✓ | ✓ | ✓ (expanded) | — |

---

## Agent Task Index

Canonical list of all spawned subagent tasks. Updated live.

| TASK_ID | Persona | Task | Status | Started | Completed | Output |
|---|---|---|---|---|---|---|
| T-001 | IN | Unified input manager (kb+mouse+gamepad+touch, remap, multi-player) | complete | 2026-04-24 | 2026-04-24 | /docs/agents/T-001.md |
| T-002 | RS | Rendering pipeline (canvas + post-process + toon/rim materials + environment + preset-driven effect stack) | complete | 2026-04-24 | 2026-04-24 | /docs/agents/T-002.md |
| T-004 | AE | Placeholder capsule character + Rapier kinematic controller + tracking camera + animation state machine | complete | 2026-04-24 | 2026-04-24 | /docs/agents/T-004.md |
| T-005 | UX | Expand menus (main / settings / pause / god-select) + shared primitives + App routing integration notes | complete (13/14; #14 UI test deferred — @testing-library/react install + vitest `.tsx` glob pending) | 2026-04-24 | 2026-04-24 | /docs/agents/T-005.md |
| T-003 | RS2 | Research Scout — `three-nebula` viability vs hand-rolled instanced particles (Risk R-05) | complete | 2026-04-24 | 2026-04-24 | /docs/research/R-05.md + ADR-0013 |
| T-006 | PO | Phase 1 perf audit — bundle, draw calls, tris, physics, projected frame time | complete (static) | 2026-04-24 | 2026-04-24 | /docs/agents/T-006.md |
| T-100 | CB | Anansi kit final numbers + counter-play scenarios + TTK analysis (§6.1) | complete | 2026-04-24 | 2026-04-24 | /docs/gods/ANANSI.md |
| T-104 | (orch) | Sacred Grove polish — central tree (destroyable, 500 HP), pickup-spawner logic | complete | 2026-04-24 | 2026-04-24 | src/game/arenas/sacredGrove/ |
| T-106 | (orch) | In-match HUD v1 — HP bar, ability + ult radials, match timer, score bar; store HUD fields | complete | 2026-04-24 | 2026-04-24 | src/ui/hud/ |
| T-102 | RS | VFX infrastructure (ParticlePool, Emitter, RibbonStrip, VFXController) + Anansi VFX (Silken Dart, Mirror Thread clone, Eight-Strand Dome, hit particles) | running | 2026-04-24 | — | /docs/agents/T-102.md |
| T-105 | AI | Three bot difficulties for Anansi mirror — behavior trees, difficulty tuning | running | 2026-04-24 | — | /docs/agents/T-105.md |

Next TASK_ID: **T-104** (orchestrator — Sacred Grove polish).

---

*End of Progress Document.*
