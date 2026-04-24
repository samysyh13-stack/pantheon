# PANTHÉON — Design Document

**Status**: Phase 0 approved with corrections (2026-04-24). Amendments applied per user direction — see ADRs 0008–0012 in `/docs/DECISIONS.md`.
**Target version**: v1.0.0 (14-day north-star; re-scoped at each phase gate).
**Document owner**: Orchestrator (Chief Architect).
**Last updated**: 2026-04-24 (amended).

> Any change to this document after approval must be logged as an ADR in `/docs/DECISIONS.md`.

### Amendments (2026-04-24)

- HP tiers added per god: Anansi 320 / Brigid 380 / Susanoo 420 — §6.1–6.3 stat blocks and §6.4 principle. See ADR-0008.
- Orochi's Wake per-head damage reduced from 60 → 35 (280 total max) in §6.3. See ADR-0009.
- Mirror Thread clone behavior clarified — AI-controlled kiter in v1, input-mirror deferred to v1.1 evaluation. See ADR-0010.
- Hearthstone now self-heals Brigid in §6.2. See ADR-0011.
- Sacred Grove visual direction shifted to neutral overcast baseline — §7. See ADR-0012.
- Tutorial flow restructured to begin with god-select teaser — §10.

---

## 1. Executive Summary

PANTHÉON is a stylized 3D competitive brawler that runs entirely in a modern web browser — desktop and mobile, installable as a Progressive Web App. Matches are two-to-four minutes. The roster is mythological: every fighter is drawn from a real, researched world mythology. v1 ships with three gods from three distinct cultural clusters, one arena, two modes (Duel 1v1 and Totem Rush), three tuned bot difficulties, and full local same-device couch co-op. Online play is deferred to v1.1 behind a WebRTC peer-to-peer model with Cloudflare Worker signaling.

The core design bet: a stylized, culturally-grounded brawler that serves over a URL — no app store, no sign-up, no monetization friction — occupies a vacant shelf in 2026. Brawl Stars has already proven the gameplay loop on mobile. No incumbent holds the "mythologically literate, web-first, couch-co-op-capable, zero-monetization" slot. That gap is the opening PANTHÉON targets.

The visual bet: painterly stylized PBR with cel-shading hybrid, mature palettes, silhouette-first character design, and mythological authenticity — deliberately the opposite of the modern-cartoon superhero visual territory every current brawler occupies. Characters are researched, credited, and designed around their source narratives rather than Western-pop-culture shorthand of them.

v1 is intentionally small. The 14-day timeline is a north star, not a contract; each phase gate (Days 3, 7, 11) re-scopes honestly in `PROGRESS.md`. The quality bar at ship is a 30 FPS stable mobile floor, 60 FPS desktop target, < 25 MB initial download, Lighthouse PWA score ≥ 90, and zero placeholder assets visible in the build.

## 2. Vision and Positioning

Most live brawlers chase the same modern-cartoon visual territory: bold outlines, pastel palettes, superhero archetypes, bubbly animation. PANTHÉON deliberately walks the other way — painterly stylized PBR with cel-shading touches, a warmer and more mature palette, character designs rooted in scholarly research rather than pastiche. The fighters in v1 are drawn from three distinct cultural clusters for visual variety and narrative breadth:

- **Anansi**, the Akan-Ashanti spider trickster of West African mythology — a ranged control character whose kit plays with misdirection and crowd shaping. Primary source material: Anansi tales collected in *African Myths of Origin* (Stephen Belcher, 2005), Akan folklore archives.
- **Brigid**, the Irish goddess of smithcraft, healing, and poetry — a zone-control firecaster who anchors terrain. Primary source: the *Lebor Gabála Érenn* cycle, modern scholarship on pre-Christian Celtic triadic goddesses.
- **Susanoo-no-Mikoto**, the Japanese storm god — a close-range brawler built around the Kusanagi-no-Tsurugi blade and the Yamata-no-Orochi serpent myth. Primary source: the *Kojiki* and *Nihon Shoki* primary texts.

Every v1 god is designed against the narrative arc actually attributed to them. This is a non-negotiable brand commitment. v1 restricts scope to mythologies with extensively documented public-domain sources; v2+ commits to paid sensitivity-read consultation for each cultural cluster. If any community feedback flags misrepresentation at launch, we commit to a 7-day patch window.

**Positioning statement**: *PANTHÉON is what happens when a painterly mythology-faithful 3D brawler meets the friction of a URL.*

## 3. Target Audience and Platforms

**Primary audience**: 16–35-year-old casual and mid-core gamers who split their play between mobile and a laptop. They enjoy Brawl Stars, Mobile Legends, Marvel Rivals, and short-session competitive games. They install few apps and click links easily. They care about cultural detail (younger cohorts especially) and push back against overt pay-to-win design.

**Secondary**: indie and game-dev enthusiasts who discover via Hacker News, r/threejs, r/webgames, Discord developer servers. They evaluate technical impressiveness. The build must stand up under technical scrutiny.

**Tertiary**: mythology hobbyists and educators. They care about faithful representation. Their audience is small but loud — a credible signal channel for authenticity.

**Platforms and minimum specs**:
- **Browsers**: Chromium-derived (Chrome, Edge, Brave, Arc, Opera) latest 2 versions; Safari 17+; Firefox 130+.
- **PWA install**: iOS 17+, Android 12+.
- **Desktop minimum**: Intel UHD 620-class integrated GPU at 1080p, 8 GB RAM.
- **Mobile minimum**: iPhone 12 / Pixel 6 / Snapdragon 7-series-class Android at 1080×2400 logical resolution.

**Input parity**: every feature must be reachable and competitive on all three input methods (keyboard+mouse, gamepad, touch). No input method is second-class.

## 4. Core Gameplay Loop

A PANTHÉON match follows a tight arc that mirrors Brawl Stars' best-feeling pacing without duplicating its mode structure.

1. **Lobby / god select** (≤ 20 s): player picks a god, sees loadout and a short idle animation clip.
2. **Match start cinematic** (3 s): arena establishing shot, "Fight!" stinger.
3. **Laning and probing** (0–45 s): players test ranges, pick up health shards, establish position around the central totem.
4. **Engage** (45 s–2 m): sustained contest, ultimate charge accumulates, first ultimate is a game-changing moment.
5. **Climax** (2 m–3 m): low-HP plays, totem ownership flips, combos decide winners.
6. **Resolution** (3 m–4 m): one side concedes position; score tips; match ends.
7. **Results screen** (15 s): MVP animation, damage / kills / totem-time stats, rematch / god-swap / menu.

**Feel target**: "I opened a tab, picked a god, fought, won or lost close, and I'm already thinking about the next match." Friction to re-queue must be under 5 seconds.

### Moment-to-moment controls

| Action | Keyboard+Mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD | Left stick | Left virtual joystick |
| Aim | Mouse | Right stick | Right virtual joystick (drag to aim) |
| Basic attack | LMB | Right trigger | Release aim joystick; or dedicated button |
| Signature ability | RMB | Right bumper | Dedicated ability button |
| Ultimate | Space | Y / Triangle | Dedicated ultimate button (flashes when charged) |
| Dodge roll | Shift | Left trigger | Dedicated dodge button (short i-frames, 3 s CD) |
| Pause | Esc | Start/Options | Pause button top-right |

### Combat feel stack

Every hit must register on at least three senses simultaneously:
- **Hitstop**: 60 ms freeze on connect (hit confirm).
- **Hit flash**: 80 ms additive white overlay on hit victim.
- **Camera shake**: proportional to damage dealt; capped; respects Reduced Motion setting.
- **Haptic**: Vibration API on Android (iOS browsers cannot trigger vibration — see Risks §15).
- **Audio**: layered attack → impact → tail, dynamic panning by screen position.
- **Particles**: a per-element burst on every hit.

### Ultimate telegraphs

Every ultimate has a 0.3–1.0 s telegraph window that a skilled opponent can react to. This prevents "feel-bad" instant-kill moments and rewards reflex play. No ultimate is instant-cast.

## 5. Mode Design — v1 Scope

### 5.1 Duel (1v1)

Best-of-three rounds. Each round is 90 seconds. Both players spawn at opposite ends. First to reduce the opponent to 0 HP wins the round. A draw at 90 seconds goes to the higher-HP player; tied HP goes to sudden death on a shrinking arena with all damage doubled.

### 5.2 Totem Rush (1v1 or 2v2 same-device)

Single round, 3 minutes. A central totem belongs to neither team. Standing on it accrues "totem time". First team to 60 seconds cumulative wins. Dying resets your team's *current* hold (but not cumulative). Health shards and ultimate-charge pickups spawn on opposite sides of the arena every 15 seconds.

### 5.3 Deferred (v1.1+)

- Skirmish 3v3 (team deathmatch)
- Realm King (shifting zone)
- Ranked / matchmaking (v2)

## 6. God Roster — v1

### 6.1 Anansi — West African / Akan-Ashanti

- **Role**: Ranged trickster, zone-control, kiter.
- **Max HP**: 320 (glass-cannon ranged — rewards positional mastery; punishes mistakes). See ADR-0008.
- **Signature color**: Deep gold (#D4A24A).
- **Voice / audio identity**: Low chuckle idle, drum-tight attack cadence, kora-string flourish on ultimate.

**Kit (placeholder values — final tuning by CB subagent in Phase 2)**:

- **Basic attack — Silken Dart**. Ranged single-projectile web shot. 10 m range. 80 damage. 0.4 s fire rate. Projectile speed 25 m/s. Small AoE on impact (0.5 m radius web slick slowing by 15% for 1 s).
- **Signature — Mirror Thread** (cooldown 8 s). Anansi spawns a clone at his location. The clone has 100 HP, deals 25% of Anansi's damage, and vanishes in 4 s or on death. Enemies must disambiguate; forcing misaim is the win condition.
  - **v1 behavior (solo vs bot, same-device co-op)**: the clone is AI-controlled with basic kiting logic — moves perpendicular to the nearest enemy, fires Silken Dart only (no ability, no ultimate). The "mirror" naming is symbolic / visual (web-weave shimmer, identical model, identical silhouette), not mechanical input mirroring.
  - **v1.1 revisit**: in networked multiplayer, evaluate whether the clone should instead mirror the player's actual inputs on a flipped axis (adds skill ceiling; adds netcode complexity). See ADR-0010.
- **Ultimate — The Eight-Strand Dome** (charge: 1500 damage dealt + received). Anansi weaves a translucent web dome, 5 m radius, at the target location, lasting 5 s. Enemies inside are slowed 40% and take 30 dmg/s. Anansi gains +25% movement speed and a stealth shimmer while inside it.
- **Passive — Strider's Balance**. Anansi takes 15% less damage while moving. Encourages continuous motion.

**Counter-play**: AoE ultimates clear both clone and caster. Dash-toward closers invalidate his kiting distance. Stuns remove his movement passive.

**Narrative frame (god-select lore line)**: *"Anansi, who wagered the sky god Nyame for every story ever told, now weaves a bigger web."*

**Design intent**: reward map awareness and micro, punish predictable positioning, create "gotcha" moments when the clone lands a decoy kill.

### 6.2 Brigid — Celtic / Gaelic

- **Role**: Area-denial mage, zone-control, anchor.
- **Max HP**: 380 (medium anchor — trades mobility for territory; the totem is her safety net). See ADR-0008.
- **Signature color**: Ember orange (#E8662A).
- **Voice / audio identity**: Whispered Gaelic prayer idle, hearth-crackle attack layer, rising bellows-hum on ultimate.

**Kit**:

- **Basic attack — Ember Brand**. Medium-range (7 m) firebolt. 95 damage, 0.55 s fire rate. Projectile travels 18 m/s. Leaves a 0.5 s burn patch on the ground at impact (10 dmg/s, 1.5 m radius).
- **Signature — Hearthstone** (cooldown 10 s). Places a rune-stone totem at her feet. The totem persists 6 s, heals **Brigid and allies** within 3 m for 30 HP/s, and ignites enemies in radius for 15 dmg/s. The totem has 150 HP and can be destroyed. Brigid anchors around it — this is her territory. Self-heal is intentional: in Duel 1v1 (v1 primary mode) there are no allies; the totem must carry self-utility or it is dead weight in solo play. See ADR-0011.
- **Ultimate — Forge's Breath** (charge: 1200 damage dealt + received). Summons a line of fire from Brigid to a target point up to 12 m away, 1 m wide, expanding over 1 s to 2 m wide. Deals 200 damage + 40 dmg/s burn for 3 s. Destroys destructible terrain on contact.
- **Passive — Smith's Patience**. Basic-attack burn DoT stacks up to 3 times per target (15 dmg/s per stack).

**Counter-play**: mobility to exit totem radius. Silences cancel her ultimate windup (0.7 s cast). Destructible totem is a reliable burn target to deny her territory.

**Narrative frame**: *"Brigid, who keeps the first forge, the first poem, and the first bed of healing coals."*

**Design intent**: rewards positional mastery. Skilled Brigid players pre-place Hearthstone before the enemy commits; unskilled Brigids burn themselves out chasing.

### 6.3 Susanoo-no-Mikoto — Japanese / Shinto

- **Role**: Close-range brawler, dive, burst.
- **Max HP**: 420 (tank-ish dive — sustained brawler needs HP to commit to melee engages; Storm's Rebirth reinforces aggression). See ADR-0008.
- **Signature color**: Storm cyan (#2E9FB5).
- **Voice / audio identity**: Thunder-rumble idle, blade-slice impacts, taiko ultimate stinger.

**Kit**:

- **Basic attack — Kusanagi Cut**. Melee 2 m-arc sword swing. 110 damage. 0.65 s fire rate. The third swing in a combo within a 2 s window is a forward lunge (3 m dash, 140 damage).
- **Signature — Storm Step** (cooldown 7 s). Instantly teleports 6 m in aim direction through enemies, leaving a trail of static electricity (5 m long, 1 m wide, 20 dmg/s for 2 s). Next basic attack within 1.5 s deals +50% damage.
- **Ultimate — Orochi's Wake** (charge: 1400 damage dealt + received). Susanoo channels for 1 s (vulnerable during windup), then summons the eight heads of Yamata-no-Orochi in a 360° sweep. Each head strikes once in sequence over 1.5 s. **35 damage per head (280 total maximum)**, 4 m radius, heads track nearest enemies. Visually a dramatic storm-serpent crown. Damage reduced from an original 60-per-head (480 total) design to preserve the no-instant-kill principle in §4 — at 320 HP, Anansi could have been one-shot. See ADR-0009.
- **Passive — Storm's Rebirth**. On kill, recover 40 HP and reduce Storm Step cooldown by 2 s.

**Counter-play**: kite to keep > 2 m distance. Interrupt the 1 s ultimate windup. Anti-dash stuns shut him down.

**Narrative frame**: *"Susanoo, banished from Takamagahara, met the serpent at the river's edge. Eight heads. Eight tails. One blade."*

**Design intent**: reward aggression. A Susanoo player who plays like a mage dies. A Susanoo player who plays like a dive fighter snowballs.

### 6.4 Cross-god balance principles

- No hard counters. Every god has a fair fight against every other god; skill matters more than kit matchup.
- Ultimates are always readable. No "you got ulted, you die" without reaction window.
- Time-to-kill band: 100% to 0% HP in sustained basic trades = 5–7 s; full combo burst (basic + ability + ult) = 2–3 s if all land.
- Dodge-roll i-frame window: 0.3 s. Tight. Rewards skill.
- No random damage rolls. Every number is deterministic in v1 (required for v1.1 lockstep networking).
- **HP tiers**: Anansi 320, Brigid 380, Susanoo 420. Role-tiered (glass-cannon / anchor / dive). No armor or damage-reduction stats in v1 — pure HP + active defenses (dodge, abilities). Balance check at Phase 2 QA must verify TTK bands hold across all matchups with these HP values. See ADR-0008.

## 7. Arena: Sacred Grove (v1 launch arena)

A neutral mythological sanctuary — intentionally not tied to any single culture, so no god feels favored. Circular-ish, 40 m diameter, gently sloped from the edges toward a central raised dais where the totem sits.

### Zones

- **Center dais** (contested). 5 m radius, raised 0.5 m. Totem spawns here. Clear sight lines in all directions.
- **Inner ring** (transitional). 5–12 m from center. Four stone shrines at the cardinal compass points, each ~2 m tall, each a breakable pickup spawner.
- **Outer ring** (flanking). 12–18 m from center. Four standing stones at 45° offsets provide line-of-sight breaks. Grass tufts and shallow pools for environmental flavor.
- **Storm boundary** (damage zone). Beyond 20 m radius, a softly-glowing stormwall pushes players back with a gentle force plus 10 dmg/s.

### Pickups

Spawn every 12–18 s, alternating spawn points:
- **Health shard**: restores 50 HP on pickup.
- **Ultimate charge**: +15% ult charge instantly.
- **Glyph of haste** (rare): +30% move speed for 4 s.

### Breakables

Each of the four shrines has 300 HP. Breaking a shrine drops a guaranteed pickup (3 s grace before respawn). Incentive to destroy is tactical — it opens flanks. Shrine destruction is an audible + visual event (stone-crack SFX, dust particles, brief light flash) visible across the whole arena.

### Spectator hook

The central totem emits a signature pillar of light colored by whichever team currently holds it, visible from anywhere on the map. In Duel mode it remains neutral-white; in Totem Rush it shifts to the holder's team color.

### Visual direction (v1: neutral overcast baseline)

**v1 locked choice**: neutral overcast palette. Diffuse silver-white sky, soft omnidirectional lighting, no pronounced sun or time-of-day signal. Cool gray-green mid-tones on terrain; warmer stone tones on the dais and shrines for character readability. Architecture is abstract and mixed — standing stones carry abstract in-house-designed runes (not tied to any single real-world script, avoiding cultural appropriation). No single culture's iconography dominates; Sacred Grove is the liminal meeting place where all the gods can meet.

A breeze-animated vertical banner on each standing stone provides motion anchor for spatial orientation at a glance.

**Design options considered** (see ADR-0012):
- **(a)** Dynamic time-of-day rotation per match (dawn / dusk / overcast / night variants). Rejected for v1 scope; held for v1.1 as a palette-only variant system (no extra geometry cost).
- **(b)** Neutral overcast baseline — **chosen for v1**.
- **(c)** Elemental mix (one standing stone per element — fire, water, wind, stone — drawing subtle motifs from multiple traditions). Rejected: risks cultural-motif collision without a sensitivity-read pass.

### Performance notes

- Static geometry budget: 30k triangles.
- Dynamic (characters + projectiles + VFX + pickups + breakables): 120k triangles allowed.
- Lighting: one directional (overcast sky-fill) + one ambient. No dynamic point lights (too expensive on mobile).
- Shadows: cascaded for directional on desktop; baked on mobile Low preset.

## 8. Combat and Feel

Combat is stat-driven under the hood but **feel-driven on the surface**. The rendering and audio layers do the heavy lifting on perceived quality.

### Damage formula

```
final_damage = base * (1 + buff_multipliers) - armor_flat
```

- v1 has no elemental matchup system. Keep it simple.
- `armor_flat` is per-god (all 0 in v1; reserved for v2 gods with natural armor).
- Buff multipliers come from passives and temporary effects (Storm Step's +50% next hit, for example).

### Status effects

- **Slow**: multiplicative on move speed, multiple sources stack multiplicatively with a minimum effective speed of 40% base.
- **Burn**: ticks every 0.5 s. Stacks as specified per god.
- **Stun**: disables input for the duration. All stuns in v1 are ≤ 0.8 s (avoid feel-bad).
- **Silence**: disables ability + ultimate casts. Basic attack still works.

### Hit confirm pipeline

```
projectile hits hitbox
  → apply damage (authoritative in single-player, host in v1.1)
  → trigger hitstop (both attacker and victim freeze 60 ms)
  → spawn hit particle at impact point
  → flash victim (additive white, 80 ms)
  → play impact SFX
  → screen shake proportional
  → haptic pulse (Android)
  → damage number float (toggleable in settings)
```

## 9. Progression and Persistence — v1

Deliberately minimal to avoid scope creep.

- Local profile in IndexedDB via Dexie.
- All three v1 gods unlocked from match one. No grind. Zero barrier to fun.
- Match history (last 20 matches) stored for the results screen's personal-record comparison.
- No achievements in v1; reserved for v2.
- No cosmetics in v1; reserved for v2.

## 10. Tutorial / Onboarding

A 2–3 minute interactive flow on first launch. The tutorial begins with a **god-select teaser**: all gods available in the current build are shown with a short (~2 s) teaser clip of their signature ability cast plus a one-line role description. The player picks which god they want to learn with; the tutorial tailors its ability and ultimate steps to the chosen god's kit.

1. **God select** — teaser clips + one-line role per god; player picks. *If only one god is available in the current build (Path C scope at Day 7 gate), this step is skipped silently.*
2. **Movement** — guided circle targets to walk to; introduces dodge roll.
3. **Basic attack** — break 3 training dummies at range or in melee arc, appropriate to the chosen god's basic attack.
4. **Ability** — chosen god's signature ability against a scripted scenario that showcases its counter-play:
   - **Anansi's Mirror Thread** — a dummy that targets the clone, giving the real Anansi a free shot.
   - **Brigid's Hearthstone** — two dummies drawn by bait; Hearthstone self-heals Brigid while burning them.
   - **Susanoo's Storm Step** — an evading dummy; Storm Step through, follow up with the empowered basic attack.
5. **Ultimate** — charge and fire on a dummy pack appropriate to the chosen god.
6. **Short scripted duel** vs an "easy" bot mirror-matched to the chosen god.
7. **Exit** to main menu with a "Play Now" call-to-action.

Skippable after completion; re-triggerable from settings. All copy is localization-ready (string table with ICU MessageFormat) even if v1 ships English only.

**Scope note**: tutorial-per-god content (ability + ultimate steps) is only fully authored for gods that ship in v1 (determined by Day 7 Path A/B/C gate). The god-select step adapts to the available roster automatically — if only one god ships, the select screen is silently skipped and the tutorial proceeds with that god.

## 11. Audio Design

### Music — adaptive dynamic layering

- **Exploration layer**: 60 BPM, ambient mythological instrumentation. Always plays.
- **Combat layer**: 120 BPM, percussive + brass/strings. Fades in when the player has dealt or taken ≥ 200 damage in the last 3 seconds.
- **Ultimate sting**: a third 3-second layer that swells on ultimate activation.
- Transitions use Tone.js crossfader with 400 ms ramps.

### SFX

- Footsteps: per-surface (stone, grass, water, shrine-tile). Distinct per god (heel profile, cadence).
- Abilities: three components — cast, travel (if applicable), impact.
- Environmental: wind loops, distant thunder, bird calls (low-rate, mood setting).

### Voice

- v1: whispered one-word exclamations on ability/ultimate only. No full VO. Avoids voice-actor cost and re-record cost on balance changes.
- Each god has ~8 lines total. Sourced from ElevenLabs if the user supplies an API key; otherwise all-silent fallback with expressive SFX.

### Mixing

- Howler.js for SFX with per-category volume buses (SFX, Music, Voice, UI).
- Dynamic-range compression on master out to protect mobile speakers.
- Ducking-under-ultimate: combat music layer drops -6 dB when the local player's ultimate casts (makes the ultimate feel bigger).
- Mono fallback option in settings (accessibility).

## 12. UI / UX Principles

- **HUD-in-view-only**: nothing critical lives outside the player's natural eye-line. Health bar above character, ability icons in the lower corner, ultimate charge as a radial around the ult button, match timer top-center.
- **Mobile-first sizing**: all interactive elements ≥ 44×44 pt (Apple HIG), ≥ 48 dp (Material).
- **Colorblind-safe**: never encode information in color alone — always pair with shape, icon, or position. Three palette modes (protanopia, deuteranopia, tritanopia) shift team colors and pickup hues.
- **Minimal menus**: main menu has three buttons — **Play**, **Gods**, **Settings**. Each tap's primary action responds within 200 ms.
- **Transitions**: slide-in on menu enter (200 ms); instant exit; no long animations that block the player.
- **No modal dialogs during gameplay.** Pause menu slides from the right; the match is frozen behind it but visible.
- **Safe-area-aware**: respects iOS notch, Android display cutout, and gamepad overlay regions.
- **Landscape lock during matches** (portrait is allowed in menus and results).

## 13. Accessibility

A complete list of v1-supported accessibility features:

- **Reduced motion**: cuts camera shake, simplifies particles, disables screen bloom flashes on hits.
- **High contrast**: boosts outline intensity, darkens environmental mid-tones, brightens character rim lights.
- **Colorblind modes**: three palettes (protanopia, deuteranopia, tritanopia).
- **Subtitles**: ability-cast SFX are subtitled with short tags (`[storm crackles]`, `[web weaves]`).
- **Input remap**: full on keyboard and gamepad; touch scale + opacity customizable.
- **No timed tutorials**: players take as long as they need.
- **Hold-to-confirm** replaces quick-tap on destructive actions (e.g., "Delete profile").
- **Text size**: minimum 14 px at default browser zoom. No sub-14 px UI text anywhere.
- **Damage number toggle**: visible by default, disable in settings.
- **Mono audio**: accessibility option that downmixes to mono output.
- **Persistent settings**: written to IndexedDB; re-applied on next session across devices sharing the same browser profile.

## 14. Monetization

- **v1**: none. No paid content. No ads. No donation prompts. Goal is player base, not revenue.
- **v2 (deferred)**: cosmetic-only — character skins, arena palette variants. Never affects gameplay. No lootboxes. No gacha. No energy timers. Pricing model TBD; likely one-time purchases of small packs.
- **Forever-banned**: lootboxes; gacha; pay-to-win mechanics of any kind; ad-gated content.

## 15. Risks and Open Questions

Every identified risk is logged here and tracked in `/docs/DECISIONS.md` when resolved. User review requested before code begins.

### R-01. 14-day timeline vs 3D character pipeline

A game-quality 3D rigged stylized character is typically 1–2 weeks of artist time *per character*. We compress this via Meshy/Tripo AI base meshes + Mixamo animation retargeting + custom shader polish. **Risk**: characters may look "AI-generated" if under-polished. **Mitigation**: Phase 2 acceptance gate requires CD sign-off on Anansi's visual before proceeding to Brigid/Susanoo. If Anansi doesn't pass the bar, we cut to one god and double down on polish (Phase 3 Path C).

### R-02. iOS Vibration API absence

Vibration API designed in §4 works on Android but is blocked on iOS for web apps. **Decision**: document as iOS limitation. Fallback on iOS: more aggressive UI flash + slightly stronger camera shake to compensate. Visible in settings as a "haptics unavailable on iOS" note.

### R-03. WebRTC scope consistency with user prompt

The user prompt's Section 2 lists "private room via WebRTC" in v1 modes but Section 2's "v1 ship scope" relegates it to v1.1. **Decision**: treat as v1.1. Same-device split-screen co-op covers "play with a friend" for v1. **User confirmation requested.**

### R-04. Tailwind v4 adoption risk

v4 is released but tooling ecosystem (shadcn variants, community plugins) is still catching up as of April 2026. **Decision**: use v4 core utilities only; no reliance on v4-specific third-party plugins. Fallback to v3 if any blocker emerges.

### R-05. `three-nebula` library viability

Listed in the user prompt's tech stack hint, but its maintenance status is uncertain. **Decision**: RS2 (Research Scout) confirms before Phase 1. Fallback is a hand-rolled InstancedMesh particle system — slower to author but more controllable and more performant on mobile.

### R-06. Mixamo rig fidelity for non-humanoid designs

Mixamo rigs are humanoid-standard. Anansi as "spider trickster" — if we render him four-armed or spider-legged, Mixamo rigs do not apply. **Decision**: Anansi v1 is depicted as a human trickster figure with web-weaving hand gestures; his spider nature is symbolic (silhouette implies eight-point symmetry, VFX weave around him, not literally spider-legged). v2 could introduce a more inhuman variant with a bespoke rig.

### R-07. PeerJS signaling reliability

For v1.1 WebRTC, PeerJS's free hosted signaling is known to be flaky under load. **Decision**: if v1.1 lands in-window, we spin up a Cloudflare Worker signaling relay (minimal, ~100-line deploy). Mentioned here so it's not a surprise when we need it.

### R-08. Plausible and Sentry cost

Both have free tiers with low limits. **Decision**: both are opt-in via `VITE_*` env vars. Ship without them if the user hasn't provisioned accounts. No analytics / no crash reports is an acceptable v1 state.

### R-09. AI-generated music licensing

suno.ai and udio outputs have ambiguous commercial terms depending on tier. **Decision**: default to Creative Commons 0 music from Free Music Archive or Pixabay. If the user supplies verified-commercial output from suno/udio, use that and log source + license URL + download date in `LICENSES.md`.

### R-10. Cultural authenticity without sensitivity reads

v1 will not include paid cultural reviewers — timeline-prohibitive. **Decision**: restrict v1 god designs to well-documented public-domain mythological material; cite primary sources in `CREDITS.md`; add a "cultural consultants wanted" note for v2. Community feedback flagging misrepresentation at launch triggers a 7-day patch window. **User confirmation requested.**

### R-11. Meshy / Tripo commercial license tier

These tools have paid tiers with commercial rights and free tiers that may not include them. **Decision**: user confirms which tier before Phase 2. If free-tier-only, we substitute CC0 base meshes from OpenGameArt / Sketchfab CC0 filter and do more manual Blender work.

### R-12. Mobile Safari as the weakest WebGL2 target

Mobile Safari has the smallest compatibility envelope among target browsers. Post-processing pipeline may need auto-downgrade on detect. **Decision**: PO subagent runs a Safari-specific profiling pass in Phase 1 and publishes a capabilities matrix in `/docs/agents/T-PERF-SAFARI.md`.

### R-13. Single-arena visual fatigue

One arena for the entire v1 ship is a thin visual roster. **Decision**: accept. Day 7 gate may add a second arena if velocity permits (Path A only). Sacred Grove is designed to have enough environmental variety (time-of-day shift option in v1.1 per ADR-0012) that single-arena fatigue is tolerable for a 2–3 minute match loop.

### R-14. Claim of "Claude Max 20x = 1M context"

The kickoff prompt asserts the orchestrator can hold full context in a 1M window. In practice, context size varies per Claude Code session. **Decision**: treat the docs on disk as the source of truth, not in-memory context. Any subagent brief includes pointers to the relevant docs, not the full contents. Protects against context-drift across long sessions. See ADR-0007.

### R-15. Asset streaming and first-paint budget

25 MB initial-download budget is tight for 3D + audio. **Decision**: aggressive code-split by route — the menu shell loads alone first; god-specific assets lazy-load at match start; arena assets lazy-load during god select. Each v1 god's assets must fit ≤ 8 MB (KTX2 textures, Draco-compressed geometry, Opus audio).

---

*End of Design Document. Approximate length: ~6,150 words (post-amendment).*

*Any change to this document after user approval must be logged as an ADR in `/docs/DECISIONS.md`.*
