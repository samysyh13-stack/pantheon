# ROADMAP — PANTHÉON

**Status**: v1.0.0 in flight (Phase 3 Path C + Phase 4). Live deploy: https://pantheon-292.pages.dev.

---

## v1.0.0 — ship (Path C polish over breadth)

**What makes it v1**:
- Anansi playable (rigged KayKit Rogue_Hooded mesh with gold-tinted ToonMaterial, 6-state animation FSM)
- Sacred Grove arena blockout (dais + central tree + 4 shrines + 4 standing stones + storm boundary + pickup spawners)
- Two modes: Duel (1v1 vs bot) + Totem Rush (first to 60 s totem hold)
- Three bot difficulties (easy / normal / hard — all 23 AI tests green)
- In-match HUD (HP bar + ability radial + ult charge + timer + score + damage number floaters)
- 6 CC0 audio assets (menu ambient loop + combat layer + UI click + hit + attack whoosh + cast whisper)
- Tutorial (3-min interactive onboarding — god-select teaser + scripted duel vs easy bot)
- Local split-screen co-op (2–4 players same device)
- Settings menu (graphics preset / audio / accessibility / controls remap)
- PWA installable on iOS 17+ / Android 12+
- Lighthouse PWA score ≥ 90
- Zero console errors in production build
- Every asset CC0 and logged in LICENSES.md
- Initial download < 25 MB; total assets < 80 MB

**Deferred from v1 (accepted scope cuts)**:
- Brigid + Susanoo (Path C is Anansi-only)
- WebRTC online multiplayer (v1.1)
- Skirmish 3v3 + Realm King modes (v1.1)
- Cosmetic skins (v2)
- Full Anansi kit polish to final-mesh fidelity — KayKit placeholder ships (v2 swaps)

---

## v1.1 — online + 2nd god (4-6 weeks post-v1)

1. **WebRTC private rooms**: 6-character room code, PeerJS signaling via Cloudflare Worker (R-07 resolution). Deterministic lockstep already in place (ADR-0006) — netcode is a thin retrofit.
2. **Brigid** (Celtic anchor mage): kit per DESIGN §6.2 + ADR-0011 self-heal. CB numbers → AE rig → RS VFX (Hearthstone totem, Forge's Breath fire-line, Ember Brand burn patch) → AU audio → AI bot tuning.
3. **Skirmish 3v3 TDM mode**.
4. **Second arena** — Polynesian bioluminescent reef OR Slavic swamp (decide per mythology-roster balance).
5. **Replay system**: record the deterministic input log + match seed; play back via scheduler.advance().
6. **Real-device telemetry**: once the player base exists, T-108's theoretical-pass FPS becomes measured-pass.

---

## v1.2 — roster expansion

- **Susanoo** (Japanese storm dive): kit per DESIGN §6.3 + ADR-0009 Orochi's Wake 35 dmg/head.
- **Third arena** — Japanese storm-torn shrine.
- **Ranked / matchmaking** (basic ELO; requires minimum server-side bookkeeping — first deviation from the "no game server" v1 commitment).

---

## v2 — paid cosmetic tier

- Skin system (no gameplay effect, ADR-0005 locked).
- Arena palette variants.
- Paid cultural-sensitivity consultant reviews per god (fulfilling R-10 commitment).
- Additional gods: Baba Yaga, Hanuman, Tezcatlipoca, Mami Wata — roster per DESIGN §2.

---

## Never

- Lootboxes, gacha, energy timers (DESIGN §14).
- Pay-to-win mechanics (DESIGN §14).
- Unsourced or CC-BY-SA-contaminated assets (DESIGN §2).
- Matchmaking without determinism signal end-to-end (ADR-0006).
