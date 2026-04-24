# PANTHÉON — Claude Code Context

You are continuing work on **PANTHÉON**, a stylized 3D mythological brawler for browser and mobile. v1 ships in ~14 days as a north-star; every phase gate re-scopes honestly.

## Current phase

See `/docs/PROGRESS.md` for the live checklist. As of this session seed, Phase 0 (pre-production docs) is **complete and awaiting user approval** before any code is written or subagents spawned.

## Non-negotiable ground rules

1. **Do not spawn subagents in Phase 0.** Phase 0 is orchestrator-solo. From Phase 1 on, orchestrate per `/docs/AGENTS.md`.
2. Any significant architectural or design change must be logged as an ADR in `/docs/DECISIONS.md`.
3. License every third-party asset in `/docs/LICENSES.md` **before** merging code that uses it. No exceptions.
4. Performance budgets in `/docs/ARCHITECTURE.md` §4 are hard floors. Do not regress.
5. No copyrighted material. No lootboxes, gacha, or microtransactions in v1.
6. Honesty first: at each phase gate (Day 3, Day 7, Day 11), re-scope based on actual velocity. Never under-ship silently.
7. Cultural authenticity: v1 god designs draw from well-documented public-domain sources cited in `/docs/LICENSES.md` §7. Flag anything drifting into caricature.

## Where to read

| Topic | File |
|---|---|
| Vision, god kits, arena spec | `/docs/DESIGN_DOCUMENT.md` |
| Tech stack, folder structure, perf budgets | `/docs/ARCHITECTURE.md` |
| Subagent roster and brief templates | `/docs/AGENTS.md` |
| Phase tracking, daily log, scope flex matrix | `/docs/PROGRESS.md` |
| License log for all assets | `/docs/LICENSES.md` |
| Architectural Decision Records | `/docs/DECISIONS.md` |
| Per-god detailed design (populated in Phase 2+) | `/docs/gods/<GOD>.md` |
| Per-arena detailed design | `/docs/arenas/<ARENA>.md` |
| Subagent task outputs | `/docs/agents/<T-XXX>.md` |
| Research Scout findings | `/docs/research/<GAP_ID>.md` |
| QA reports | `/docs/qa/*.md` |

## Stack cheatsheet

- **Language**: TypeScript strict
- **Build**: Vite 6 + SWC
- **Runtime 3D**: Three.js r170 + R3F 9 + drei (latest)
- **Renderer**: WebGL2 default; WebGPU behind opt-in flag (ADR-0001)
- **Physics**: @react-three/rapier (deterministic mode — ADR-0006)
- **State**: Zustand + immer
- **Animation**: three-stdlib AnimationMixer; three-ik where needed
- **Post-processing**: pmndrs `postprocessing` — outline + bloom + color grade + SSAO(desktop)
- **UI**: React + Tailwind v4 (core utilities only)
- **Persistence**: Dexie (IndexedDB)
- **Audio**: Howler (SFX) + Tone (music layering)
- **Input**: custom unified manager (keyboard + mouse + gamepad + touch)
- **PWA**: vite-plugin-pwa (Workbox)
- **Deploy**: Cloudflare Pages + R2
- **Observability (opt-in)**: Plausible + Sentry via env vars

## Performance budgets (mobile — hard floors)

- ≥ 30 FPS on iPhone 12 / Pixel 6 class
- ≤ 150 draw calls per frame
- ≤ 150k triangles rendered per frame
- ≤ 128 MB texture memory resident
- ≤ 25 MB initial download (critical path)
- ≤ 80 MB total asset budget for all v1 content

Desktop targets: 60 FPS on Intel UHD 620-class integrated GPU.

## Code style

- TypeScript strict. No `any` without a `// reason:` line.
- Functional components + hooks. No class components.
- Gameplay systems mutate refs; React renders HUD and menus only (see `/docs/ARCHITECTURE.md` §8).
- Commit messages: conventional — `feat:`, `fix:`, `chore:`, `docs:`, `perf:`, `refactor:`, `test:`.
- No comments explaining what code does; only comments for non-obvious *why*.
- No placeholder / dead / commented-out code in commits that go to `main`.

## Gameplay design invariants (from design doc)

- No random damage rolls in v1 (ADR-0004).
- Every ultimate has a 0.3–1.0 s telegraph window.
- TTK bands: 5–7 s sustained trade, 2–3 s full combo.
- Dodge-roll i-frames: 0.3 s exactly.
- Hit confirms: hitstop 60 ms + flash 80 ms + sound + (Android only) haptic.
- **HP tiers (ADR-0008)**: Anansi 320 (glass-cannon), Brigid 380 (anchor), Susanoo 420 (dive). No armor or damage reduction stats in v1.
- **No single ability one-shots any god (§4, ADR-0009)**. Orochi's Wake max 280 total, Anansi 320 HP — barely survivable, intentional.
- **Brigid's Hearthstone self-heals (ADR-0011)** — required for Duel 1v1 utility.
- **Anansi's Mirror Thread clone is AI-controlled in v1 (ADR-0010)** — input-mirror deferred to v1.1 evaluation.
- **Sacred Grove is overcast-neutral in v1 (ADR-0012)** — dynamic time-of-day deferred to v1.1.

## v1 ship target

3 gods (Anansi, Brigid, Susanoo), 1 arena (Sacred Grove), 2 modes (Duel, Totem Rush), 3 bot difficulties each, local same-device split-screen co-op, full onboarding, PWA installable, < 25 MB initial download, 30 FPS mobile floor, 60 FPS desktop target, Lighthouse PWA score ≥ 90, zero placeholder assets visible, zero console errors, every asset licensed.

## Outstanding risks (from `/docs/DESIGN_DOCUMENT.md` §15)

Short list — full detail in the design doc:

- **R-03**: WebRTC scope consistency — decided v1.1 (ADR-0002); confirm with user.
- **R-10**: Cultural sensitivity reads deferred to v2; community-feedback 7-day patch commitment.
- **R-11**: Meshy/Tripo license tier — user confirms before Phase 2.
- **R-05**: `three-nebula` library viability — Research Scout in Phase 1.
- **R-02**: iOS Vibration API unavailable — documented fallback.

## Session-continuity tip

When returning to this project mid-build, read in this order:
1. `/docs/PROGRESS.md` — what phase are we in, what's next, what's blocked
2. `/docs/DECISIONS.md` — what decisions have been locked (do not re-litigate)
3. `/docs/AGENTS.md` — active task table
4. Relevant scoped docs for whatever you're doing

Then, and only then, start work.
