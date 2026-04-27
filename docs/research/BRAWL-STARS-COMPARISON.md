# Brawl Stars Reference — Gap Analysis

**Status**: post-v1.0.0 audit. PANTHÉON DESIGN_DOCUMENT §1 explicitly cites Brawl Stars as the gameplay-feel reference. This doc lists everything where v1.0 currently diverges from that target, ranked by playtest visibility.

## Brawl Stars baseline (from training knowledge + design archetype)

### Camera
- **Pitch**: ~55–65° from horizontal (very top-down). The whole arena is on screen most of the time; the brawler is one of several visible elements, not the foreground hero.
- **FOV**: ~30–35° (narrow, near-orthographic feel). Things at character distance and far-side don't appear dramatically scaled.
- **Tracking**: follows the character but with damping; the arena center is roughly screen center for most of a match.
- **Distance**: ~12–15 m above the action. The brawler is small enough that you read positioning more than character detail.

### Controls
- Twin-stick: left = move, right = aim
- **Auto-aim on tap-release**: if you tap-and-release the aim stick (no drag), the brawler fires at the **closest enemy in range**, not in stick direction.
- Manual aim: drag-and-release fires in dragged direction.
- Super (ult) button is dedicated, separate from aim.
- Movement direction = facing direction when not aiming.
- Aim direction = facing direction when aiming.

### Combat feel
- Projectiles are slow enough to dodge (200–500 ms travel time at typical range).
- Hit confirm: enemy flashes white + damage number floats up.
- HP bar floats ABOVE the brawler's head (world-space billboard), color codes (green/yellow/red) by ratio.
- Brawler death: brief "X" or fade animation, then respawn.

### HUD
- Top center: match timer + mode-specific counter (gems / totem time / kill count).
- Top corners: team scores (blue / red).
- Bottom-left: virtual move joystick.
- Bottom-right: aim joystick + dedicated super button.
- HP and ult charge are PER-BRAWLER above their head — the HUD doesn't carry HP at all in some game modes.
- Arena always fully visible.

### Match flow
- 90 s – 3 min matches.
- Tutorial is the first match itself with bot opponents giving non-blocking tooltips.
- One-tap rematch.

## PANTHÉON v1.0.0 vs Brawl Stars — gaps ranked

### 🔴 P0 (most visible — fix immediately)

1. **Camera pitch too shallow** — `CAMERA_OFFSET = [0, 10, 14]` gives ~35° pitch. Should be ~60°. The current camera reads as third-person Diablo / Hades, not top-down brawler. The bot is too far / too small; the player is too foreground / too big.

2. **Floating HP bars missing** — HP is only in HUD top-left. Brawl Stars puts HP above each brawler's head as a world-space sprite/quad. Currently you cannot see the bot's HP at a glance — the bot's score is visible in HUD but their remaining HP is not.

3. **Damage number floaters missing** — On hit, no number floats up. DESIGN §13 already specifies these as toggleable; they're not implemented.

### 🟡 P1 (feel-impacting)

4. **No auto-aim on tap** — Touch users especially: a single tap on the aim joystick should fire at closest enemy. Currently tap-without-drag does nothing. DESIGN §3 mentions "auto-aim assist on mobile (subtle)" but the implementation isn't there.

5. **Camera FOV too wide** — `CAMERA_FOV_DEG = 45` makes near-far disparity dramatic. Brawl Stars uses ~30–35° for the more orthographic, "everything at the same scale" read.

6. **Camera tracks too tightly** — `CAMERA_LAMBDA = 6.0` snaps the camera to the player. Brawl Stars has more lag — the player can move toward the screen edge and the camera holds back. Lambda ~3–4 would feel more right.

7. **No "spawn / death" animation** — when round ends, players just stop. Brawl Stars has a brief KO animation + respawn. We don't even respawn between rounds within a match (we restart-from-scratch the next round via `matchCtl.start()`, which works but doesn't feel like a brawler).

### 🟢 P2 (polish)

8. **No respawn invulnerability flash** — Brawl Stars gives 1 s of invuln on respawn, character flashes.
9. **No speed lines / motion trails** — running fast in BS leaves a subtle dust trail.
10. **Pickup glow effects** — pickups in BS have rotating sparkle / glow; ours are static positions (and not even spawning yet — Phase 3 wired the spawner constants but not the visible pickup meshes).
11. **Match end "Victory / Defeat" ribbon animation** — currently the Results screen shows the banner statically; BS has an animated reveal.
12. **Brawler "voice" on ult** — character grunts / shouts. We have the whisper for ability cast but no ult voice.

### 🔵 P3 (deeper feel — Phase 4+)

13. **Map destruction** — BS has destructible bushes that grow back. Sacred Grove has destructible shrines (300 HP) but no regrowth, and they don't visibly destroy yet.
14. **Bushes / hide spots** — BS has tall grass that hides brawlers until they shoot. We don't have stealth / fog-of-war.
15. **Power cubes / pickups affecting stats** — BS Showdown has stat-up pickups. Our pickups are health / ult-charge / speed only.
16. **Trophy / progression meta** — explicitly out of scope per ADR-0005 (no monetization, no progression).

## Decisions for the post-v1.0.0 patch

- **v1.0.1**: address P0 items 1, 2, 3. These are the "playtest-screenshot makes it look wrong" items. Each is bounded scope (~1 hr each).
- **v1.0.2**: P1 items 4, 5, 6, 7. Touch auto-aim is the biggest accessibility lift for mobile players.
- **v1.0.x**: P2 items as polish lands.
- **v1.1**: P3 items 13–14 with the WebRTC + Brigid release; bushes / destruction tie into the second-arena content.

## What stays divergent on purpose

- **Mature stylized aesthetic** — Brawl Stars is bright cartoon; PANTHÉON is painterly mythology. We don't want the bubbly chibi look. KayKit is a placeholder; final art (v2 with a real artist) doubles down on the painterly direction, not the BS direction.
- **No monetization, no gacha, no skins** — ADR-0005. Permanent.
- **Mythological cultural source vs original IP** — DESIGN §2 brand commitment. We don't move toward BS's invented-character-roster model.
- **Web-first, URL share, PWA install** — DESIGN §1. BS is app-store native; we explicitly went the other way.

The "feel like Brawl Stars to play" target stays intact for v1.0.x patches; the aesthetic and brand are deliberately divergent.
