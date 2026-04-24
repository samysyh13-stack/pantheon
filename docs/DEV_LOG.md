# DEV_LOG — PANTHÉON

Honest retro of the 14-day sprint. What shipped, what was cut, what the delta taught us.

---

## Timeline (actual)

| Phase | Planned days | Actual | Notes |
|---|---|---|---|
| 0 (pre-prod) | Day 1 | Day 1 | All 6 docs on schedule; approved with 6 corrections (ADRs 0008–0012) |
| 1 (foundation) | Days 2–3 | Days 2–3 | 6 subagent tasks + orchestrator engine loop/scheduler; v0.1 tagged clean |
| 1 fixes + deploy | – | Day 4 | 6 post-gate fixes + Cloudflare wiring; v0.1.1 tagged |
| 2 (vertical slice) | Days 4–7 | Days 4–7 | 10 tasks (T-100 kit, T-102 VFX, T-104 arena, T-105 AI, T-106 HUD, T-107 QA, T-108 perf, T-109 CD, plus orchestrator integrations); v0.2 tagged |
| Asset sourcing | – | – | T-201 / T-202 research scouts ran concurrently with Phase 2 close; KayKit + 6 CC0 audio landed ahead of Phase 3 |
| 3 Path C (polish) | Days 8–11 | Days 8–11 | Audio integration + mesh integration + combat MVP + match state machine + tutorial skeleton |
| 4 (ship polish) | Days 12–14 | Days 12–14 | Docs + PWA polish + meta tags + Lighthouse pass + v1.0.0 tag |

---

## What shipped

### Gameplay
- Anansi playable — KayKit Rogue_Hooded mesh with gold tint, 6-state FSM-driven anims, kinematic Rapier controller at 60 Hz deterministic tick
- Duel mode: player vs bot at 3 difficulties (easy / normal / hard)
- Sacred Grove arena: dais, central tree, 4 shrines, 4 standing stones, storm boundary, pickup spawner (scheduler-driven)
- In-match HUD v1: HP bar, ability radial, ult charge radial, match timer, scorebar
- Input parity: WASD + mouse (desktop), gamepad (plugged), virtual joystick (touch), all remappable
- Pause: Escape / gamepad Start / touch Menu button → slide-in PauseMenu
- Settings: graphics preset (ultra/high/medium/low/battery/auto), audio (master/sfx/music/voice/mono), accessibility (reducedMotion/highContrast/colorblindMode/subtitles/damageNumbers), controls remap modal

### Audio (Phase 3 T-300)
- 6 CC0 audio files (menu ambient, combat layer, UI click, hit, whoosh, whisper)
- Howler.js SFX bus with per-category volumes wired to store
- Tone.js two-layer music crossfader (menu → combat on engagement)

### Art (Phase 3 T-301)
- KayKit Rogue_Hooded GLB loaded via drei useGLTF
- Per-instance skeleton clone via SkeletonUtils.clone (supports 2-Anansi mirror)
- AnimationMixer drives T-004 FSM states with 0.2 s crossfades

### Infrastructure
- Deterministic simulation (ADR-0006) throughout: scheduler, RNG, input, bot AI, physics all replayable from seed + input log
- 160+ unit tests, 3 e2e Playwright smoke, Lighthouse PWA ≥ 90
- Cloudflare Pages auto-deploy on push to main; GitHub Actions CI pipeline

### Polish
- Landing page at `/` (menu = landing)
- Privacy policy (zero data collection by default)
- PWA manifest with icons all sizes, installable iOS/Android
- Open Graph + Twitter Card meta
- `robots.txt` + `sitemap.xml`

---

## What was cut (scope honesty)

- **Brigid + Susanoo**: Path C trade-off. 2nd and 3rd god design docs stub-only; Phase 2 Anansi slice landed with perception marginals (art/audio) which Path C chose to polish over adding breadth. Both flagged in ROADMAP.md v1.1 / v1.2.
- **WebRTC online multiplayer**: scope-locked to v1.1 (ADR-0002). Deterministic lockstep foundation is in place; netcode is a thin retrofit.
- **3v3 Skirmish, Realm King modes**: v1.1+ per the scope flex matrix.
- **Matchmaking / ranked**: v2; requires servers, explicit deferral in Phase 0.
- **Cosmetic skin system**: v2 (ADR-0005 permanent no-monetization in v1).
- **Sensitivity-read consultants**: budget-deferred. v1 commits to public-domain sources only + a 7-day community-feedback patch window (R-10).
- **Final Anansi art**: KayKit placeholder ships (CC0, community-proven quality). Custom West-African-inspired art lands v2 with human artist.
- **Real-device FPS validation**: theoretical pass with 5× mobile headroom (T-006 + T-108 static); synthetic headless benches showed SwiftShader artifacts rather than app signal. Awaiting real-device user report.

---

## What the delta taught

1. **ADR discipline compounds.** Every phase revisited 3–5 ADRs. Having them written made the re-scope conversations sharp rather than vague. ADR-0013 (hand-rolled particles over three-nebula) saved 2.9 MB of bundle and 6-9 engineer-days of dead dependency.
2. **"Perception pillars" vs "code pillars".** Phase 2 gate passed code-wise but flagged art/audio/real-device-FPS as marginals. Path C worked because it specifically targeted the perception gaps rather than adding more code features.
3. **CC0 ecosystem is richer than anticipated.** KayKit + OpenGameArt + Freesound covered 100% of asset needs without paying a euro. Research Scout pattern (RS2) shined here.
4. **Subagent orchestration held.** Five concurrent specialist personas + orchestrator simulated a 6-seat studio credibly. The bottleneck was always orchestrator context, not subagent output quality.
5. **Determinism commitment paid upfront.** No regret on ADR-0006; every subsystem that respected it (scheduler, bot AI, input replay) "just works" for the v1.1 lockstep netcode.
6. **The 3 FPS synthetic bench caveat.** Headless Chromium software-render is not a mobile proxy. Real-device validation is the only way to know — documented honestly rather than pretending the synthetic number was meaningful.

---

## Ship checklist — final

- [x] v1.0.0 tag
- [x] Live on Cloudflare Pages (pantheon-292.pages.dev)
- [x] PWA installable
- [x] Lighthouse PWA ≥ 90
- [x] Zero console errors in production build
- [x] All assets logged in LICENSES.md
- [x] CREDITS.md ready to share
- [x] PRESS_KIT.md ready to share
- [x] ROADMAP.md published
- [x] Privacy policy visible
- [x] Open Graph / Twitter Card meta
- [x] robots.txt + sitemap.xml

---

*Thanks to everyone who made v1 possible — in particular the CC0 asset creators (Kay Lousberg, yd, Xythe, BenjaminNelan, MadPanCake, qubodup, Wavewire) who make projects like this reachable without any budget.*
