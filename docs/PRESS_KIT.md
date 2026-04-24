# PRESS KIT — PANTHÉON

**A stylized 3D mythological brawler for browser and mobile. Zero monetization. URL-shareable. CC0 assets.**

- **Live**: [pantheon-292.pages.dev](https://pantheon-292.pages.dev)
- **Source**: [github.com/samysyh13-stack/pantheon](https://github.com/samysyh13-stack/pantheon)
- **Built by**: Samy (+ Claude Code AI pair)
- **Launched**: 2026-04-24 — v1.0.0

---

## Elevator pitch (30 words)

A 3D brawler where every fighter is a real figure from world mythology. Plays in any browser (no install, no account), installable as a PWA on mobile, shares over a URL.

## Short pitch (60 words)

PANTHÉON is a stylized 3D mythological brawler that runs entirely in your browser. Matches are 2–4 minutes. Fighters come from researched world mythologies — Anansi in v1, Brigid and Susanoo in v1.1+. Desktop and mobile (PWA installable). Zero monetization, zero ads, zero account required. Share a URL with a friend; both of you play the same build instantly.

## Long pitch (180 words)

Most live brawlers chase the same modern-cartoon visual territory: bold outlines, pastel palettes, superhero archetypes. PANTHÉON deliberately walks the other way — painterly stylized PBR with cel-shading touches, a mature palette, character designs rooted in research rather than pastiche.

v1 ships with **Anansi**, the Akan-Ashanti spider trickster — a ranged kiter whose kit plays with misdirection. Mirror Thread spawns an AI clone that forces the opponent to disambiguate; the Eight-Strand Dome is a trap zone that slows + damages enemies while Anansi becomes stealthy inside. Classical brawler shape, mythologically faithful identity.

The technical bet: determinism throughout. Every subsystem (input, AI, physics, scheduler) is seed-replayable, which means v1.1 adds WebRTC online multiplayer as a thin retrofit on top of lockstep — not a netcode rewrite.

The brand bet: zero monetization forever. No gacha, no lootboxes, no pay-to-win. If we ever monetize, it's cosmetic-only.

The reach bet: a URL, shared. No app store friction. Installable as a PWA for the one-tap phone experience.

## Key features (v1.0)

- **Anansi** playable (ranged kiter, 3 bot difficulty tiers)
- **Duel** (1v1 vs bot) + **Totem Rush** (capture-the-point)
- **Local couch co-op** (2–4 players on one device, split-screen)
- **Tutorial** (3-min interactive onboarding)
- **Accessibility**: reduced motion, high contrast, 3 colorblind palettes, subtitles, keymap/gamepad/touch remap, mono audio
- **PWA**: installable on iOS 17+ / Android 12+
- **Open source**: MIT code + CC0 assets
- **Works offline** to menu after first visit

## Tech (for press-tech angle)

- **React 19 + Three.js + React Three Fiber** (stylized PBR pipeline with custom cel-shader + outline post-process)
- **Rapier WASM physics** (deterministic 60 Hz tick for lockstep-readiness)
- **Tailwind CSS v4**, **Zustand** (state), **Dexie** (IndexedDB persistence)
- **Cloudflare Pages** deploy, no game servers

## Screenshots + gameplay GIF

_(add 3–5 PNG screenshots + one 30 s gameplay GIF exported from OBS/screen-capture; filenames under `press/`)_

## Credits

Full credits in [CREDITS.md](CREDITS.md).

## Contact

- Issues: [github.com/samysyh13-stack/pantheon/issues](https://github.com/samysyh13-stack/pantheon/issues)
- Email: [samy.syh13@gmail.com](mailto:samy.syh13@gmail.com)

## Licensing at a glance

- **Code**: MIT
- **All visual / audio assets**: CC0 (public domain) — attribution not required but given in [CREDITS.md](CREDITS.md)
- **Mythological source material**: public-domain references ([R. S. Rattray 1930](https://archive.org), *Akan-Ashanti Folk-Tales*; et al.)

## Fact sheet for roundups

| | |
|---|---|
| Title | PANTHÉON |
| Genre | Stylized 3D brawler |
| Platforms | Web (Chrome / Firefox / Safari / Edge; desktop + mobile) — PWA installable |
| Release | v1.0.0 — 2026-04-24 |
| Price | Free. Forever. No ads, no IAPs, no lootboxes. |
| Developer | Samy + Claude Code AI pair |
| URL | [pantheon-292.pages.dev](https://pantheon-292.pages.dev) |
