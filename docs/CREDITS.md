# CREDITS — PANTHÉON

**v1.0.0 — 2026-04-24**

Live at https://pantheon-292.pages.dev — all assets CC0 / public-domain, all libraries open-source.

---

## Design, code, orchestration

**PANTHÉON** was built by **Samy** in collaboration with **Claude Code (Anthropic)** as the orchestrating AI pair, with specialist personas simulated via role-scoped subagents (Creative Director, Combat Designer, Animation Engineer, Rendering Specialist, Input Engineer, AI Engineer, UX, QA, Performance Optimizer, Research Scout, Audio Director).

Single-human team + AI co-pilot. 14-day north-star sprint (re-scoped at each phase gate per the plan in `/docs/PROGRESS.md`).

---

## 3D assets

- **Anansi placeholder mesh**: [KayKit Character Pack: Adventurers 1.0](https://kaylousberg.itch.io/kaykit-adventurers) — "Rogue_Hooded", by **Kay Lousberg** (CC0 1.0 Universal).

## Audio

| File | Track | Author | Source |
|---|---|---|---|
| Menu ambient loop | *Shrine* | yd | [OpenGameArt](https://opengameart.org/content/shrine) (CC0) |
| Combat music layer | *Fast Fight / Battle Music* | Xythe | [OpenGameArt](https://opengameart.org/content/fast-fight-battle-music) (CC0) |
| UI click | *Wooden Click* | BenjaminNelan | [Freesound #321083](https://freesound.org/s/321083/) (CC0) |
| Hit impact | *Hit Impact* | MadPanCake | [Freesound #660770](https://freesound.org/s/660770/) (CC0) |
| Attack whoosh | *Whoosh* | qubodup | [Freesound #60013](https://freesound.org/s/60013/) (CC0) |
| Cast whisper | *SFX_Spell_WhisperedShort-04* | Wavewire | [Freesound #837459](https://freesound.org/s/837459/) (CC0) |

All audio is CC0 — no attribution is legally required, but the authors deserve the nod.

## Fonts

- **Inter** (UI) — [Rasmus Andersson](https://rsms.me/inter/) — SIL Open Font License 1.1
- **Cinzel** (display — menu title) — [Natanael Gama](https://fonts.google.com/specimen/Cinzel) — SIL Open Font License 1.1

## Mythological source material

Anansi's design is drawn from **Akan-Ashanti trickster traditions**. Primary references:
- *Akan-Ashanti Folk-Tales* — R. S. Rattray (1930, public domain) — [archive.org](https://archive.org)
- *African Myths of Origin* — Stephen Belcher (2005)

Visual and narrative design treats Anansi as the wily bargainer of Nyame-the-sky-god tales. Any community feedback flagging misrepresentation triggers a 7-day patch window (commitment in DESIGN_DOCUMENT.md §15 R-10).

## Runtime dependencies (MIT / Apache-2.0 / Zlib — see package.json)

- [Three.js](https://threejs.org) — MIT
- [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) — MIT
- [@react-three/drei](https://github.com/pmndrs/drei) — MIT
- [@react-three/rapier](https://github.com/pmndrs/react-three-rapier) — MIT (WASM physics)
- [postprocessing](https://github.com/pmndrs/postprocessing) — Zlib
- [three-custom-shader-material](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) — MIT
- [zustand](https://github.com/pmndrs/zustand) — MIT
- [immer](https://github.com/immerjs/immer) — MIT
- [howler.js](https://github.com/goldfire/howler.js) — MIT (audio)
- [Tone.js](https://github.com/Tonejs/Tone.js) — MIT (music layering)
- [Dexie](https://github.com/dexie/Dexie.js) — Apache-2.0 (IndexedDB)
- [@use-gesture/react](https://github.com/pmndrs/use-gesture) — MIT
- [Vite](https://github.com/vitejs/vite) — MIT
- [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) — MIT
- [React](https://github.com/facebook/react) — MIT

## Deploy infrastructure

- **Cloudflare Pages** — hosting + CDN
- **GitHub Actions** — CI/CD

---

*PANTHÉON is a labour of love. Every asset was sourced with respect for its original creator and under clear commercial-libre licensing. If you see something attributed incorrectly, file an issue at [github.com/samysyh13-stack/pantheon/issues](https://github.com/samysyh13-stack/pantheon/issues).*
