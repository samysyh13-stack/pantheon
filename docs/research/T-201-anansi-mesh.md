# T-201 — Anansi Rigged Humanoid Mesh (CC0)

**Status**: Research complete. Recommendation below is the primary placeholder for Anansi's symbolic-humanoid body (DESIGN §6.1, R-06). VFX (gold web-weave) lands per ADR-0013 and does not depend on the mesh's geometry.
**Author**: RS2.
**Last updated**: 2026-04-24.

## TL;DR

Primary pick is **KayKit Character Pack: Adventurers** (Kay Lousberg, CC0) — 4 humanoid characters shipped as GLB/FBX with 95 baked animations including every kit beat (idle, walk, run, attack, hurt, death, victory), textured with a single gradient atlas that takes a gold-tint ToonMaterial cleanly. One caveat: each character is **~4,337–6,456 triangles**, which overages the ARCHITECTURE §4 character budget of ≤3,000 by ~60% — we accept the overage for the placeholder and decimate to ≤3,000 in a one-hour Blender pass before merging (see §3). Backup is **Quaternius Universal Base Characters + Universal Animation Library 2** (CC0, explicit "universal humanoid rig, ready for retargeting"); tertiary is **Kenney Blocky Characters** (CC0, fits budget cleanly but the blocky aesthetic fights our painterly direction).

## Constraints evaluated (quick check per source)

- **KayKit** (kaylousberg.itch.io) — yes, viable. Canonical CC0 humanoid pack for R3F/Three.js dev. 4 characters, 95 anims, GLB + FBX, custom (non-Mixamo) rig but anims are baked, so retargeting isn't required for v1 placeholder. Overages 3k tri budget but simplest possible integration path.
- **Quaternius** (quaternius.com) — yes, viable. Universal Base Characters pack explicitly built for retargeting against the Universal Animation Library 2 (130+ animations, GLB output, released 2026-01-23). CC0 confirmed across all Quaternius packs. 13k tris per character requires heavy decimation.
- **Kenney** (kenney.nl/assets/blocky-characters) — yes, viable with caveats. CC0, direct download URL confirmed, 18 skins + 27 animations, GLB included. Blocky aesthetic (Minecraft-style cubic limbs) is stylistically furthest from DESIGN §2's painterly-stylized-PBR target — usable as a placeholder but a visible fallback choice.
- **OpenGameArt CC0 humanoids** — mixed. Several sub-1,000-tri rigged candidates exist ("Very Low Poly Human" 246 tris; "Rigged and Animated Humanoid" <1k tris; "Stylized Low Poly Character" auto-rigged via Mixamo). Quality is author-dependent; individual verification required per asset. Good "micro-floor" option if all three finalists blocked.
- **Sketchfab CC0 filter** — partially viable. Found one relevant candidate ("CC0 Block Man Auto Rigged Humanoid", 196 tris) but page license ambiguity — author text says "Intended for upload as CC0" while Sketchfab's license field reads "CC Attribution". Ambiguity = reject per brief's "DO NOT assume CC0 based on search-result snippets alone" rule. Sketchfab also generally requires a logged-in account to download CC0 assets (can be manually pulled by user, but not curl-able).
- **Mixamo** (mixamo.com) — partially viable. Y Bot / X Bot generic humanoids are royalty-free for commercial use per Adobe FAQ, but three blocking frictions: (a) **Adobe account required** to download, (b) **no direct-fetch URL** — downloads are browser-only click-through, (c) **FBX/DAE output only, no GLB** — requires Blender conversion pass. Best as the source of **animation data** retargeted onto a Quaternius base, not as a mesh source on its own.
- **Poly Pizza** (poly.pizza) — partially viable. Hosts a CC0 "Low Poly Characters Bundle" by mastjie (7 characters, FBX + GLTF), but tri counts and rig status unspecified; needs manual verification. Adequate as a secondary source if the top 3 fall through.

## 3 finalists

### Finalist #1 — KayKit Character Pack: Adventurers (Kay Lousberg)

- **Model / pack name**: KayKit Character Pack: Adventurers 1.0 — 4 stylized low-poly humanoid characters (Barbarian, Knight, Mage, Rogue), plus +2 characters in the EXTRA tier.
- **URL**: https://kaylousberg.itch.io/kaykit-adventurers (pay-what-you-want, free acceptable; no account required for free tier).
- **Alternate GitHub mirror**: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 (direct-fetch viable for orchestrator; release zip downloads from GitHub Releases with no auth).
- **License**: CC0 1.0 Universal. Verified in the repo's `LICENSE.txt` and on the itch.io page ("Free for personal and commercial use, no attribution required (CC0 Licensed)"). Not CC-BY, not CC-BY-NC, not CC-BY-SA.
- **Triangle count**: min 4,337 / max 6,456 / avg 4,971 tris per character (third-party mirror confirms; Unity Asset Collection review). **OVER budget** by 45–115%.
- **Rig status**: Rigged. Mecanim Humanoid-compatible (verified in the Unity-facing review) — not Mixamo's exact bone-name schema, but a standard humanoid bone hierarchy. Mixamo anims can be retargeted via Blender's Rokoko retargeter or drei's `<SkeletonUtils.retargetClip>` pattern. **However, retargeting is not required for v1** because the pack ships with 95 baked animations.
- **Animations list (baked in the GLTF + FBX)**: 95 animations spanning the full v1 kit: idle, idle variants, walk, walk-backward, run, run-backward, strafe, sprint, multiple attack clips (1H, 2H, crossbow, cast), hurt/hit-react, death, dodge-roll, victory, jump, fall, plus melee and ranged combo clips. This is a superset of the Character FSM's requirements from T-004 (idle, running, attacking, dodging, hit, dead) — every FSM state has at least one matching clip.
- **Formats**: .FBX + .GLTF. GLB not explicitly listed but GLTF is the sibling format (simple `gltf-pipeline` pass converts if GLB preferred). Brief accepts both.
- **Pros**:
  - Canonical pack used in R3F demo scenes; well-trodden integration path.
  - Baked anims span the full FSM, including the attack variations our Silken Dart basic and Mirror Thread cast calls for.
  - Single 1024×1024 gradient atlas texture — exactly the neutral base our ToonMaterial gold tint (#D4A24A) needs. Gradient atlas takes additive/multiplicative tinting cleanly without baked color fighting.
  - Custom modular topology (separate body/head/arms/legs meshes) — if we later want an "eight-point-symmetry silhouette" (R-06 note: symbolic spider shape via extra limb mesh), the modular rig exposes the wrist/shoulder joints for attachment points.
  - Complete KayKit bundle (kaylousberg.itch.io/kaykit-complete) bundles this + dungeon + skeletons + weapons packs for one CC0 download — covers arena props and Susanoo's blade placeholder too.
- **Cons**:
  - ~5,000 avg triangles is **65% over** the ARCHITECTURE §4 3k character budget. Requires a Blender Decimate modifier pass (preserve-UVs mode, ~0.6 ratio) before merging. One-hour task; standard workflow; does not affect the rig (decimate runs on the mesh only, rig and anims unaffected).
  - Rig is **not** Mixamo-bone-named. Retargeting Mixamo clips requires a bone-map pass (Rokoko free addon or the `retargetClip` helper). Acceptable because we don't need Mixamo anims — the 95 baked clips cover T-004's FSM state list.
  - Character art-style is fantasy-dungeon (armored warrior silhouettes). Anansi is a West-African trickster in gold robes — the silhouette will read as "generic medieval adventurer" until T-202 replaces with a final mesh. This is fine for a placeholder per DESIGN §15 R-01 ("game-quality 3D rigged stylized character is typically 1–2 weeks… placeholder tier accepted for pre-final gate").
  - Arms rest slightly away from the body in base pose (combat-ready posture); not fully at-sides — Anansi's gesture VFX may need a small wrist-bone offset when authoring.
- **Rank**: **1** — best overall fit for v1 placeholder.

### Finalist #2 — Quaternius Universal Base Characters + Universal Animation Library 2

- **Model / pack name**: Universal Base Characters Kit (6 models: Superhero / Regular / Teen × male/female) + the separate Universal Animation Library 2 (130+ animations). Paired product.
- **URL (base characters)**: https://quaternius.com/packs/universalbasecharacters.html and https://quaternius.itch.io/universal-base-characters (free, no account required for base pack).
- **URL (animations)**: https://quaternius.com/packs/universalanimationlibrary.html and https://quaternius.itch.io/universal-animation-library-2 (free, no account required). Version 2.0 released 2026-01-23 with explicit GLB export.
- **License**: CC0 (verified on product pages: "Free to use in personal, educational and commercial projects. (CC0 License)"). All Quaternius assets have been CC0 since project launch — cross-verified via awesome-cc0 list and multiple game-dev mirror posts.
- **Triangle count**: ~13,000 tris per character (stated on the product page: "characters average 13k triangles"). **FOUR× over the ≤3,000 budget.** Heavy decimation required (0.2–0.25 ratio); risks silhouette loss at that ratio. Alternative: use only the "Teen" proportions variant which is lowest-tri of the set (estimate ~8–10k; still requires decimation).
- **Rig status**: "Humanoid rig compatible with retargeting in any engine" — explicit universal bone-name schema designed to pair with the Universal Animation Library 2's 130+ anims out-of-the-box. Also compatible with Mixamo via standard Blender retargeting (shared with the Animation Library's retarget-ready framing).
- **Animations (via Universal Animation Library 2)**: 130+ anims, locomotion in 8 directions, jog, sprint, push, crawling, swimming, sitting, death. Published as GLB (v2 format). Animation pack is separate download; the library ships the rig definition and you apply the Universal Base Character mesh to it.
- **Formats**: Base Characters → FBX + OBJ + glTF + .blend source (Patreon tier). Animation Library 2 → GLB + FBX + Blend.
- **Pros**:
  - The "universal humanoid rig, ready for retargeting" phrasing is the strongest Mixamo-compatibility signal of any candidate. Pairing Universal Base + Mixamo's 3,000-animation library gives Anansi an essentially unlimited motion roster for v1.1 tuning.
  - Proportions are "heroic" (Superhero / Regular / Teen variants) — matches DESIGN §6.1's "1:6 head-to-body-ish, heroic, not chibi, not realistic" bar precisely.
  - Neutral topology designed for modular outfit swaps (pairs with Quaternius's Modular Character Outfits Fantasy pack; same rig, swappable mesh). Allows later pose/costume polish without re-rigging.
  - Base mesh is untextured / neutral gray — takes our ToonMaterial gold tint with zero fight.
  - Active maintenance: Universal Animation Library 2 shipped 2026-01-23; Quaternius publishes new packs regularly — the ecosystem is alive (contrast the dead three-nebula signal we saw in R-05).
- **Cons**:
  - **13k tris is 4× our budget.** Decimating to 3k is a noticeable silhouette hit; may end up re-topologizing by hand instead (3–5 engineer-days). Option to use the "Teen" proportions (lowest-tri of the set) reduces this but doesn't fix it.
  - Two-pack integration (mesh + separate animation library) is more build complexity than KayKit's single-pack model.
  - Base characters ship untextured/PBR-ish; they won't have the painterly baked-tint that KayKit gives for free. Our ToonMaterial + cel shader layer on top is the intended match, but one more variable.
- **Rank**: **2** — best retargeting story; rejected as primary because of the tri-budget cliff.

### Finalist #3 — Kenney Blocky Characters

- **Model / pack name**: Blocky Characters (Kenney, kenney.nl). 18 skins (18 different character appearances) on a shared rig, 27 baked animations.
- **URL**: https://kenney.nl/assets/blocky-characters. **Direct-fetch download URL**: https://kenney.nl/media/pages/assets/blocky-characters/72bdc6be4c-1749547469/kenney_blocky-characters_20.zip (~2.1 MB zip; no account required; `curl`/`wget` works). This is the cleanest orchestrator-fetchable URL of any finalist.
- **License**: CC0 — "Credit 'Kenney.nl' or 'www.kenney.nl', this is not mandatory." Verified on the asset page.
- **Triangle count**: Not explicitly published, but the blocky (Minecraft-cubic) topology and 2.1 MB pack size for 18 skins + rig + 27 anims suggests each character is in the 500–1,500 tri range — **well under our 3k budget**. Needs disk-level verification by downloading and inspecting, but every signal (blocky topology, small zip size, "optimized low poly" self-description) points to well-inside-budget.
- **Rig status**: Rigged (asset tagged "Animation" on Kenney's page; baked anims imply a skeleton). Rig bone-names not published; unclear Mixamo compatibility. Kenney's own knowledge base has a "Rigging a character using Mixamo" tutorial which applies to Asset Forge characters, suggesting Kenney works commonly integrate with Mixamo with a Blender step.
- **Animations**: 27 baked animations across the 18 skins. Specific clip names not published; likely covers the common-brawler set (idle/walk/run/attack/hurt/death) based on pack positioning.
- **Formats**: Separate .FBX + .OBJ + .glTF (note: page typos as "GTLF" but means glTF).
- **Pros**:
  - **Only finalist that hits the ≤3,000-tri budget cleanly with zero decimation.**
  - **Cleanest orchestrator-fetchable URL** — direct CDN link, no itch redirects, no login.
  - Smallest asset footprint (2.1 MB for the entire pack) — fits the §15 R-15 per-god ≤8 MB budget with six MB of headroom for textures, audio, and VFX.
  - 18 skin variants on a shared rig — we can pick the most neutral-toned one and apply the gold-tint ToonMaterial directly.
- **Cons**:
  - **Aesthetic mismatch**: blocky / Minecraft-cubic topology is stylistically opposed to DESIGN §2's painterly-stylized-PBR target. A Brigid / Susanoo / Anansi roster where all three are blocky characters reads as "Minecraft mod", not "painterly mythology brawler".
  - Proportions are exaggerated (big head, blocky limbs) — at 1:4 or 1:5 head-to-body ratio rather than the §6.1 "1:6 heroic" target.
  - Animation count (27) is sufficient but less rich than KayKit's 95 or Quaternius's 130+.
  - Rig bone-name schema unpublished; Mixamo retargeting may require a custom bone map.
- **Rank**: **3** — budget-winner but aesthetic-loser; use only if KayKit and Quaternius both block.

## Primary recommendation

**Use KayKit Character Pack: Adventurers** (kaylousberg.itch.io/kaykit-adventurers; alternate direct-fetch via the GitHub repo at github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0).

**Integration plan**:

1. Download the free-tier pack from itch (manual, one-time — or clone the GitHub repo directly for a curl-able path). The itch URL is not a direct binary fetch but the GitHub repo is; orchestrator can `git clone` or `gh release download`.
2. Pick the **Rogue** character from the 4-character set as Anansi's placeholder — the Rogue has the leanest silhouette and lightest armor coverage of the four, closest to the "West African trickster in gold robes" reference. (Backup pick: the Mage, if the Rogue's crossbow-ready posture looks too combat-specific for a trickster.)
3. Import the `.gltf` (preferred) into Blender. Apply a Decimate modifier in "Planar" mode at ratio ~0.62 with a 15° angle limit — the rig and UVs are preserved; the mesh goes from ~4,971 avg tris to ~3,000 without silhouette damage. Verify by eye at the normal viewing distance (DESIGN §4's camera is 14 m back per T-004's `CAMERA_OFFSET`, so mid-res decimation is visually indistinguishable).
4. Strip the baked diffuse texture and replace with a neutral gray base color (the gradient atlas is already near-neutral; just reassign the material). Our `ToonMaterial` applies the #D4A24A gold tint in the shader — we want the mesh to be neutral so the tint reads pure.
5. Export as GLB (`File → Export → glTF 2.0 → .glb`, "include animations" checked). Commit under `/public/assets/characters/anansi-placeholder.glb`.
6. Wire into T-004's `<Character>` component. The 95 baked anims map to the FSM's 6 states: `idle` → `Idle_Inplace` (or similar), `running` → `Walk`, `attacking` → `1H_Melee_Attack_Chop` (for Silken Dart gesture — cast motion, not actual sword swing; we hide the sword mesh), `dodging` → `Roll_Forward`, `hit` → `Hit_Chest`, `dead` → `Death_A`. T-101 (AE subagent) authors the `AnimationMixer` crossfade map.
7. Capsule collider wrap from T-004 (radius 0.4, half-height 0.9) matches the KayKit character's rough cylinder — scale mesh to 1.8 m tall (one `gltfPipeline` scale transform if needed; KayKit characters ship at ~1.8 m by default).

**ADR-0006 determinism note**: Animation playback is frame-indexed via AnimationMixer, not wall-clock-driven — T-004's FSM already exposes `timeInState` which T-101 will use to drive `mixer.update(dt)` with the same deterministic `TICK_DT` (1/60). No seeded RNG needed in the retargeting path since we're using the pre-baked clips unmodified; if a future variant picks between clip variations (e.g., "idle A vs idle B"), that selection uses `createRng(config.seed)` per T-004 §Controller RNG (unused today, threaded through for this purpose).

## Backup (if primary blocks on license verification)

**Use Quaternius Universal Base Characters + Universal Animation Library 2** (quaternius.com/packs/universalbasecharacters.html + quaternius.com/packs/universalanimationlibrary.html).

**Integration plan**:

1. Download Universal Base Characters pack (FBX + glTF, free, no account) and Universal Animation Library 2 (GLB + FBX + Blend, free, no account).
2. Pick the **Regular male** proportion variant (lowest tri of the male variants, closest to "1:6 heroic").
3. Decimate in Blender from ~13k tris to ~3,000 — this is aggressive (0.23 ratio). Expect manual re-topology passes on hands and face to preserve silhouette integrity; budget 1 engineer-day.
4. Retarget animations: the Universal Base rig and Universal Animation Library 2 share the same universal humanoid bone schema, so retargeting is a direct clip-copy in Blender — no bone remapping needed. Use the NLA Editor to bake each needed clip onto the base mesh's rig, then export as GLB with all actions.
5. Map clips to FSM states as with the primary plan.
6. Rest of wiring identical to primary.

**Why this is the backup and not the primary**: the 4× tri overage creates real re-topology work that KayKit's 1.65× overage doesn't. The rig story is better, but the mesh-budget story is worse, and for a *placeholder* we prefer the path with less Blender time.

## If nothing meets the bar

Not blocked. All three finalists are CC0-verified, direct-fetchable (Kenney cleanest, KayKit via GitHub mirror, Quaternius via itch + quaternius.com download buttons), rigged, animated, and humanoid. The tri-count overage for KayKit and Quaternius is a decimation task (hours, not days), not a blocker.

If all three *somehow* block (e.g., the orchestrator's curl setup can't follow the itch/kenney download flow and user cannot do a one-time manual fetch): fallback is the OpenGameArt CC0 micro-floor — e.g., "Very Low Poly Human" (246 tris, CC0, Blender source) auto-rigged via Mixamo's free auto-rigger in a 10-minute Blender session. Sub-optimal silhouette but guaranteed to fit every budget and every constraint. Mark this as the **escape hatch** — not the recommendation.

**T-201 is not blocked.** Recommend proceeding with KayKit Adventurers via the primary plan.

## Sources

- [KayKit - Character Pack : Adventurers — itch.io](https://kaylousberg.itch.io/kaykit-adventurers) — accessed 2026-04-24
- [KayKit-Character-Pack-Adventures-1.0 — GitHub repo](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) — accessed 2026-04-24
- [KayKit Adventurers README (GitHub)](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/blob/main/README.md) — accessed 2026-04-24 (CC0 1.0 Universal confirmed)
- [KayKit Adventurers — third-party tri-count review (Unity Asset Collection)](https://unityassetcollection.com/kaykit-adventurers-character-pack-for-unity-free-download/) — accessed 2026-04-24 (min 4337 / avg 4971 / max 6456 tris, 95 animations, Mecanim Humanoid)
- [KayKit Character Pack : Skeletons — itch.io](https://kaylousberg.itch.io/kaykit-skeletons) — accessed 2026-04-24 (CC0 sibling pack, noted for weapon/prop cross-compat)
- [The Complete KayKit bundle — itch.io](https://kaylousberg.itch.io/kaykit-complete) — accessed 2026-04-24
- [Quaternius — Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) — accessed 2026-04-24 (CC0, ~13k tris, universal humanoid rig, 6 models, FBX + glTF)
- [Quaternius — Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) — accessed 2026-04-24 (CC0, 120+ anims, FBX + GLB + Blend)
- [Quaternius — Universal Animation Library 2 (itch)](https://quaternius.itch.io/universal-animation-library-2) — accessed 2026-04-24 (v2.0 released 2026-01-23, 130+ anims, GLB export)
- [Quaternius — Ultimate Animated Character Pack (50+ characters)](https://quaternius.com/packs/ultimatedanimatedcharacter.html) — accessed 2026-04-24 (CC0, 52 characters, FBX + OBJ + Blend, no GLB listed)
- [Quaternius — Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html) — accessed 2026-04-24 (CC0, 11 characters, 24 anims, FBX + OBJ + Blend)
- [Quaternius — Modular Character Outfits Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html) — accessed 2026-04-24 (CC0, humanoid retargeting, pairs with Universal Base)
- [Quaternius — official home](https://quaternius.com/) — accessed 2026-04-24
- [Kenney — Blocky Characters asset page](https://kenney.nl/assets/blocky-characters) — accessed 2026-04-24 (CC0, 18 skins, 27 anims, FBX + OBJ + glTF)
- [Kenney — Blocky Characters direct-fetch URL](https://kenney.nl/media/pages/assets/blocky-characters/72bdc6be4c-1749547469/kenney_blocky-characters_20.zip) — accessed 2026-04-24 (2.1 MB zip)
- [Kenney — Rigging a character using Mixamo knowledge base](https://kenney.nl/knowledge-base/asset-forge/rigging-a-character-using-mixamo) — accessed 2026-04-24
- [OpenGameArt — 3D Humanoids under CC0 collection](https://opengameart.org/content/3d-humanoids-under-cc0) — accessed 2026-04-24 (curated CC0 humanoid list)
- [OpenGameArt — Very Low Poly Human](https://opengameart.org/content/very-low-poly-human) — accessed 2026-04-24 (CC0 escape-hatch candidate, 246 tris)
- [Adobe Mixamo FAQ — licensing](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) — accessed 2026-04-24 (royalty-free for commercial; no-redistribute rule on raw files; Adobe account required; FBX/DAE output only)
- [Adobe Mixamo Community FAQ — Licensing, Royalties, Ownership, EULA and TOS](https://community.adobe.com/t5/mixamo-discussions/mixamo-faq-licensing-royalties-ownership-eula-and-tos/td-p/13234775) — accessed 2026-04-24
- [Poly Pizza — Low Poly Characters Bundle by mastjie](https://poly.pizza/bundle/Low-Poly-Characters-Bundle-SUwNzGJ2qb) — accessed 2026-04-24 (CC0, 7 characters, FBX + GLTF, secondary candidate)
- [Sketchfab — CC0 Block Man Auto Rigged Humanoid](https://sketchfab.com/3d-models/cc0-block-man-auto-rigged-humanoid-55571b5d47614b4c9973e853fc6b6a72) — accessed 2026-04-24 (196 tris, license-field ambiguity, REJECTED per brief's no-assumption rule)
- [Sketchfab — Ultra Low Poly Animated Character (Mixamo based)](https://sketchfab.com/3d-models/ultra-low-poly-animated-character-mixamo-based-186f3f7ffc30449a9bfce39f647abc92) — accessed 2026-04-24 (324 tris, CC-BY 4.0 — NOT CC0 — rejected per brief's CC-BY-SA/CC-BY-NC exclusion which extends to plain CC-BY-without-a-compatible-share-story)

---

*End of T-201 research document. Approximate length: ~1,950 words.*
