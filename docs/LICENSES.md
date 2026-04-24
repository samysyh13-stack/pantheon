# LICENSES — PANTHÉON

**Status**: Seed. Populated as assets and libraries are added.
**Last updated**: 2026-04-24.

> Every third-party asset, library, or tool used in shipped builds must appear here with: source URL, license, date acquired, and use in project.
> PRs that add an asset without a corresponding entry here are rejected.
> CC-BY assets require visible attribution in `/CREDITS.md` at ship.

---

## 1. Runtime Libraries (seeded; versions to be pinned at install)

| Library | License | Source |
|---|---|---|
| three | MIT | https://github.com/mrdoob/three.js |
| @react-three/fiber | MIT | https://github.com/pmndrs/react-three-fiber |
| @react-three/drei | MIT | https://github.com/pmndrs/drei |
| @react-three/rapier | MIT | https://github.com/pmndrs/react-three-rapier |
| postprocessing | Zlib | https://github.com/pmndrs/postprocessing |
| three-custom-shader-material | MIT | https://github.com/FarazzShaikh/THREE-CustomShaderMaterial |
| zustand | MIT | https://github.com/pmndrs/zustand |
| immer | MIT | https://github.com/immerjs/immer |
| howler | MIT | https://github.com/goldfire/howler.js |
| tone | MIT | https://github.com/Tonejs/Tone.js |
| dexie | Apache-2.0 | https://github.com/dexie/Dexie.js |
| vite | MIT | https://github.com/vitejs/vite |
| vite-plugin-pwa | MIT | https://github.com/vite-pwa/vite-plugin-pwa |
| tailwindcss | MIT | https://github.com/tailwindlabs/tailwindcss |
| react | MIT | https://github.com/facebook/react |
| react-dom | MIT | https://github.com/facebook/react |
| @use-gesture/react | MIT | https://github.com/pmndrs/use-gesture |
| simple-peer | MIT (v1.1+) | https://github.com/feross/simple-peer |
| peerjs | MIT (v1.1+) | https://github.com/peers/peerjs |

## 2. Dev-Only Libraries (seeded)

| Library | License |
|---|---|
| typescript | Apache-2.0 |
| vitest | MIT |
| playwright | Apache-2.0 |
| eslint | MIT |
| prettier | MIT |
| @sentry/browser | MIT (optional runtime) |
| plausible-tracker | MIT (optional runtime) |

## 3. 3D Models

### Shipped v1 assets

| File | Source | License | Date acquired | Use |
|---|---|---|---|---|
| `public/models/anansi/Anansi.glb` | [KayKit Character Pack: Adventurers 1.0](https://kaylousberg.itch.io/kaykit-adventurers) — "Rogue_Hooded" (via GitHub mirror [KayKit-Character-Pack-Adventures-1.0](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0)) by Kay Lousberg | CC0 1.0 Universal (license file preserved at `public/models/anansi/KAYKIT-LICENSE.txt`) | 2026-04-24 | Anansi placeholder mesh — hooded trickster silhouette reads for the god identity while VFX carry the spider-weaver symbolism (ADR-0013) |
| `public/models/anansi/Anansi-Rogue-variant.glb` | Same KayKit pack — "Rogue" (un-hooded) | CC0 1.0 Universal | 2026-04-24 | Silhouette A/B variant — kept for tutorial/god-select comparison; may be removed in Phase 4 polish if never used |

### Pending (Phase 3+)

- Brigid / Susanoo characters (deferred — Path C locks the v1 roster to Anansi)

### Planned sources and license requirements

Planned sources and license requirements:
- **Meshy AI** — https://www.meshy.ai — **paid tier with commercial rights required**; user to confirm tier before Phase 2
- **Tripo AI** — https://www.tripo3d.ai — same
- **Mixamo** — https://www.mixamo.com — free use under Adobe license; retargeting permitted
- **Sketchfab** — https://sketchfab.com — filter to **CC0** or **CC-BY** only; no royalty-required licenses
- **OpenGameArt.org** — https://opengameart.org — prefer CC0; CC-BY and CC-BY-SA acceptable with attribution

Every downloaded model MUST include an entry:
```
| <file> | <source URL> | <license> | <date acquired> | <used where> |
```

## 4. Texture and HDRI Sources (seeded)

| Source | Default license | URL |
|---|---|---|
| Poly Haven | CC0 | https://polyhaven.com |
| AmbientCG | CC0 | https://ambientcg.com |
| Textures.com | mixed (verify per asset) | https://www.textures.com |

## 5. Audio Sources (seeded)

| Source | License guidance | URL |
|---|---|---|
| Freesound.org | per-asset; filter to **CC0** and **CC-BY** | https://freesound.org |
| Pixabay Sound | Pixabay license (free commercial) | https://pixabay.com/sound-effects |
| Free Music Archive | per-track; prefer **CC0** / **CC-BY** | https://freemusicarchive.org |
| Zapsplat | royalty-free with account | https://www.zapsplat.com |
| **Suno.ai / Udio** | **commercial-rights tier only**; user to confirm output license | https://suno.ai https://www.udio.com |
| ElevenLabs (voice lines, v1 optional) | per-account commercial tier | https://elevenlabs.io |

## 6. Fonts (seeded)

Recommended (no foundry-licensed fonts allowed without explicit commercial license):

| Font | License | URL |
|---|---|---|
| Inter | SIL OFL 1.1 | https://fonts.google.com/specimen/Inter |
| Cinzel (display for headings) | SIL OFL 1.1 | https://fonts.google.com/specimen/Cinzel |
| JetBrains Mono (for dev HUD / console) | Apache-2.0 | https://fonts.google.com/specimen/JetBrains+Mono |

## 7. Cultural and Mythological Source Material

Primary sources consulted for god designs. **These are research references, not asset sources.** Used for narrative, visual, and kit inspiration only.

| God | Primary source texts | Access |
|---|---|---|
| Anansi | *African Myths of Origin* (Stephen Belcher, 2005); R.S. Rattray's *Akan-Ashanti Folk-Tales* (1930, public domain) | Public libraries / archive.org |
| Brigid | *Lebor Gabála Érenn* (public domain); *A Dictionary of Celtic Mythology* (James MacKillop) | Public libraries / CELT archive |
| Susanoo | *Kojiki* (Basil Hall Chamberlain trans., public domain); *Nihon Shoki* (W.G. Aston trans., public domain) | Public libraries / archive.org |

Citations for each god's lore will appear in `/CREDITS.md` at ship.

## 8. Policy

1. No asset in a shipped build without a corresponding entry here.
2. Proprietary/paid assets require user confirmation of account tier — see R-11 in `/docs/DESIGN_DOCUMENT.md`.
3. CC-BY assets require visible attribution in `/CREDITS.md` at ship.
4. No scraped assets, no extracted game rips, no screenshots used as textures without verified license.
5. AI-generated content (Meshy, Tripo, Suno, Udio, ElevenLabs) requires commercial-rights tier; free-tier output is disqualified unless explicitly granted commercial use by ToS.
6. When in doubt, RS2 (Research Scout) checks the license; the orchestrator logs the ADR if the decision is non-trivial.

---

*End of Licenses Document.*
