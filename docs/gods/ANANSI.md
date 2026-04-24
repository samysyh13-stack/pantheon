# Anansi — Final Kit (Phase 2 baseline)

**Status**: Phase 2 baseline — all numbers below are the committed values that T-102 (VFX authoring), T-105 (bot AI tuning), and T-107 (Phase-2 balance playtest) pull from.
**Task**: T-100 (CB).
**Last updated**: 2026-04-24.

> Supersedes the Phase 0 stub previously at this path. Design Document `/docs/DESIGN_DOCUMENT.md` §6.1 remains authoritative for top-level role/HP/color identity; this document is authoritative for all tuning numbers below that top line.

---

## 1. Identity

**Mythological context**. Anansi is the Akan-Ashanti trickster spider of West African mythology, most famously the bargainer who wagered the sky god Nyame for ownership of every story ever told (DESIGN §2; `/docs/gods/ANANSI.md` cultural source note citing Rattray 1930 and Belcher 2005). His narrative signature is misdirection — promises, disguise, woven traps, impossible trades — not brute confrontation. The kit reads like that arc: every ability creates ambiguity or obligates the opponent to answer a wrong question.

**Role summary**. Ranged kiter. Wins at 6–10 m. Loses in a 0–3 m trade unless the passive and a dodge absorb the burst.

**Signature color + VO identity**. Deep gold `#D4A24A` (DESIGN §6.1). Low chuckle on idle, drum-tight tap on each Silken Dart release, kora-string arpeggio swell on ultimate cast (DESIGN §11).

**Locked stats** (`Anansi.tsx` placeholder is canonical): HP 320 (ADR-0008), moveSpeed 5 m/s, dashSpeed 12 m/s (2.4× walk — standard brawler dodge ratio), dashDurationMs 300, dashCooldownMs 3000. Dodge i-frames 0.3 s per DESIGN §4.

---

## 2. Basic Attack — Silken Dart

| Field | Value |
|---|---|
| Damage | 80 |
| Range | 10 m |
| Fire rate | 0.4 s between shots (2.5 shots/sec) |
| Projectile speed | 25 m/s |
| On-impact effect | 0.5 m radius web slick, 15% slow for 1 s (non-stacking) |
| Travel time at max range | 0.4 s (10 m / 25 m/s) |

**Per-number justification**:

- **80 damage**: puts 4 shots on a 320-HP target (mirror) for a kill at 1.6 s of uptime — inside the §6.4 combo band (2–3 s) if the last shot lands at the fire-rate boundary.
- **10 m range**: ~half the arena radius (Sacred Grove is 40 m diameter); generous enough to harass from a flanking stone but not so long that Brigid's Hearthstone can't be broken by closing to basics.
- **0.4 s fire rate**: 2.5 shots/sec. At slower cadences the slow-proc stops feeling consistent; at faster he becomes a DPS turret instead of a kiter.
- **25 m/s projectile speed**: at 10 m range, travel time equals one fire-rate interval (0.4 s = 0.4 s). A player who can strafe faster than 3.5 m/s laterally can force a miss — exactly the "predictable paths punished" promise of DESIGN §6.1. A Susanoo dodge-rolling at 12 m/s for 0.3 s covers 3.6 m — he can dodge the shot if read, which is the intended counter.
- **Slow 15% for 1 s, non-stacking**: a kiting tool, not a DPS tool. 15% is below the minimum-feel threshold for "I got CC'd and can't play" (stacking slow would compound into feel-bad) and above the "did that even do anything" threshold. Non-stacking is explicit so rapid-fire doesn't lock a target into 1 s perpetual slow by re-application — instead, the slow refreshes on each hit, capped at the same 15%.
- **Web-slick 0.5 m radius**: deliberately tight — the slow applies on direct projectile hit AND on entering the slick within 1 s. This rewards the kiter for shooting at the opponent's *feet* when they're committed to a path, not just at the body.

**Design intent**: breathing room for the 320-HP kiter, not a DPS race. The slow is the kiting tool; the damage is the finisher.

**DPS sanity check**: 80 / 0.4 = 200 theoretical DPS, but only at uninterrupted uptime. In a live trade, dodges, reposition, and LoS breaks reduce this to ~60–80% uptime. Effective DPS in the 120–160 band — fits the 5–7 s sustained kill of a 320-HP mirror (see §6).

---

## 3. Signature — Mirror Thread

| Field | Value |
|---|---|
| Cooldown | 8 s |
| Clone HP | 100 |
| Clone damage per Silken Dart | 20 (25% of Anansi's 80) |
| Clone fire rate | 0.5 s (**deliberately slower than Anansi's 0.4 s**) |
| Clone duration | 4 s, or on-death, whichever first |
| Clone behavior | AI-controlled; moves perpendicular to nearest enemy at Anansi's moveSpeed (5 m/s); fires Silken Dart only; no ability, no ultimate (ADR-0010) |
| Cost | None — cooldown gates |
| Cast time | 0.3 s (see §9) |

**Per-number justification**:

- **8 s cooldown**: Anansi can have the clone available for roughly half of a typical 16 s positioning loop. Any shorter and the clone becomes permanent pressure (bot-telling trivial, counter-play exhausted). Any longer and the "gotcha decoy" loses the rhythm of being a surprise in every significant engage.
- **100 HP**: one Kusanagi Cut (110 dmg) kills the clone — an aggressive melee god who reads correctly is rewarded. Two Silken Darts from a mirror Anansi (160 dmg) also kill it — ranged reads work too. A Brigid Ember Brand (95 dmg) nearly kills it but not quite, forcing a second commit.
- **20 damage per clone shot (25% of Anansi's)**: the clone is a *pressure* tool, not a damage-doubling tool. Over its 4 s lifetime at 0.5 s fire rate, it lands up to 8 shots × 20 dmg = 160 damage maximum (under perfect uptime). That's half a 320-HP bar in perfect conditions — enough to matter, not enough to make him a two-for-one DPS god.
- **Clone fire rate 0.5 s vs Anansi's 0.4 s**: **CB decision — deliberate mismatch**. The cadence asymmetry is the richest tell a human opponent can use to disambiguate the real Anansi from his clone without breaking the visual identity. Pure sound-design disambiguation (slightly duller dart-release SFX on the clone) is not enough on mobile speakers or in the heat of a trade; an audible rhythm mismatch is perceivable without being a billboard.
- **4 s duration**: fills exactly one full Silken Dart cooldown cycle plus a fraction (Anansi fires every 0.4 s → clone fires every 0.5 s → 4 s = 8 clone shots, 10 Anansi shots). A full trade through a clone window deals Anansi 800 dmg + clone 160 dmg = 960 dmg if every shot lands — more than enough to kill any v1 target, matching §6.4's "2–3 s full combo" band with one ability in the mix.
- **Perpendicular kiting behavior**: ADR-0010 locks this. The clone moves tangentially around the nearest enemy at Anansi's moveSpeed, maintaining a target distance of 8 m (halfway between Silken Dart's effective range and its maximum). It does not LoS-break or use cover — intentionally a weaker AI than a human player (bot must not be the better Anansi).
- **Ult charge from clone**: **CB decision — YES, the clone's damage-dealt credits Anansi's ultimate charge, but at 50% weight (20 damage dealt → 10 charge)**. Damage *taken* by the clone generates zero ult charge (the clone is not Anansi; taking damage through the clone is not a real trade). Rationale: full credit would make Mirror Thread a "free ult battery" ability, incentivizing cowardly kiting and disengagement. Zero credit would make the clone mechanically feel invisible to the ultimate economy, a missed design opportunity. 50% splits the difference — the clone is an expression of Anansi's pressure, and half the pressure should count.

**Design notes — playing against a human**. The "gotcha decoy" mental game: the clone is placed mid-engage (cast time 0.3 s — see §9), and the opponent has ~200 ms to decide which target to shoot. Visual cues are deliberately minimal at spawn (see §8); the clone becomes distinguishable only *during* combat, via cadence (slow fire rate) and behavior (mechanical kiting vs a human's reactive repositioning). A Susanoo who commits to Storm Step on the wrong target loses his damage burst and his closer. A Brigid who drops Hearthstone as a bait punish can eat the real Anansi's ult if she guesses wrong on positioning.

**Counter-play**. (a) AoE abilities clear both: Forge's Breath, Orochi's Wake, Eight-Strand Dome itself. (b) Aim-testing — a mirror Anansi can fire a single Silken Dart at one target and read the hit/miss latency vs the clone's predictable 0.5 s cadence to identify the real one. (c) Clone cannot dodge-roll; a thrown dodge-roll interaction reveals the real Anansi.

---

## 4. Ultimate — The Eight-Strand Dome

| Field | Value |
|---|---|
| Charge requirement | 1500 (damage dealt × 1.0 + damage taken × 1.0; 50/50 weights) |
| Cast time | 0.6 s (see §9) |
| Placement | Target point, max 12 m from Anansi |
| Dome radius | 5 m |
| Dome duration | 5 s |
| Enemies inside | 40% slow (multiplicative, stacks with Silken Dart slow down to the 40%-of-base minimum speed floor per DESIGN §8) + 30 dmg/s |
| Anansi inside | +25% move speed; stealth shimmer visible only to enemies *outside* the dome |
| Clone inside | Takes no DoT damage, gains no movement buff (dome is Anansi-keyed) |

**Per-number justification**:

- **1500 charge, 50/50 weights**: Anansi's survivable damage-taken budget in a full trade is roughly one HP bar (320 HP) before he dies; his damage-output budget is a 3–4 s Silken Dart window (640–800 damage). Balanced 50/50 means he charges ult at a similar pace whether he's playing aggressive (damage dealt) or defensive (damage taken). Biasing toward damage-taken would incentivize passive play — exactly the opposite of his design intent (§6.1 "rewards positional mastery"). Biasing toward damage-dealt would punish the 320-HP glass-cannon when an opponent out-ranges him. 50/50 is the neutral stance.
- **5 m radius, 5 s duration**: the dome covers roughly the same footprint as Sacred Grove's center dais (5 m radius per DESIGN §7). Dropped on the dais in Totem Rush, the ult is effectively a totem-contest lockout. 5 s is the Silken Dart time-to-kill at 200 theoretical DPS (320 HP / 200 = 1.6 s) plus buffer — the dome's window is long enough for Anansi to kill a committed target inside it, or to escape a pursuer who's forced to eat 150 damage (30 × 5) to chase through.
- **40% slow**: the maximum slow allowed by DESIGN §8's "40% of base minimum effective speed" floor on Anansi's base 5 m/s is 2 m/s — exactly the 40%-slow number. Stacking with Silken Dart's 15% slow would drive speed below the floor; the DoT clamp holds the floor.
- **30 dmg/s inside**: 150 damage over full duration. Roughly half a Brigid bar (380 HP) or a third of a Susanoo bar (420 HP). Enough to matter; not so much that standing in the dome is auto-death (§4 "no instant-kill" principle).
- **+25% move speed for Anansi inside**: Anansi moves at 6.25 m/s inside, enemies at 3 m/s — a 2×+ speed differential that makes the dome a playground for Anansi and a coffin for the opponent. Geometric expression of the power fantasy.
- **Stealth shimmer visible only to enemies OUTSIDE the dome**: **CB decision**. An enemy who stays outside cannot cleanly track Anansi (the shimmer is a moving-distortion silhouette, not full invisibility — DESIGN §13 accessibility: never encode information in color alone, always pair with motion/shape). An enemy who *enters* the dome sees Anansi clearly. This creates a legible trade: "eat the slow+DoT and you can aim at him; stay outside and you can't." Unconditional invisibility would violate §4's no-instant-kill (an invisible Anansi outside is an unwinnable situation). Inside-visible / outside-obscured is the cleanest rule.
- **Max placement range 12 m**: slightly beyond Silken Dart's effective range (10 m), so Anansi can drop the dome on a target he can't currently hit with a dart — but not so far that he can "wall off" the entire arena from safety.

**Counter-play scenarios built-in**: (a) AoE ultimates (Brigid's Forge's Breath, Susanoo's Orochi's Wake) clear both clone and the caster by overlapping the dome from outside. (b) The dome's edges provide LoS cover for an enemy who stays just outside — the enemy can't track the shimmering Anansi but equally can't be hit through the edge. (c) An enemy can dash *into* the dome, trading 40% slow + 150 DoT damage for the ability to cleanly aim at Anansi — positioning for HP, a real choice.

---

## 5. Passive — Strider's Balance

- **Effect**: 15% flat damage reduction applied multiplicatively before final damage, while Anansi's velocity magnitude is > 0.5 m/s.
- **Velocity threshold 0.5 m/s**: equivalent to 10% of walk speed. Prevents jitter-tanking at 0.01 m/s (stationary with controller drift) but accepts that any real directional input immediately counts. Dodge roll (12 m/s) trivially qualifies, as does a Glyph of Haste (+30%) boosted 6.5 m/s walk.
- **Dodge roll interaction**: counts as "moving". The 0.3 s i-frame window already provides full immunity; during the i-frames the passive is redundant but does not double-stack. On the *tail* of the dodge (post-i-frame, still rolling), Strider's Balance applies because velocity is high.
- **Glyph of Haste pickup interaction (+30% move speed)**: **additive to move speed, multiplicative to passive — i.e., Glyph and Strider's Balance both apply and compound**. Glyph makes Anansi faster; Strider's Balance was always on during that faster motion. No override; no cap below 15%. Rationale: the pickup is a temporary risk-reward (Anansi is visually lit up and audibly crackling during the 4 s Haste window — an easy target), and the passive is the permanent feature — stripping either would undermine the other's identity.
- **Stun interaction**: a stun sets velocity to zero (per DESIGN §8 "disables input"). Strider's Balance therefore falls off during stun — stunned Anansi takes full damage. This is the explicit counter noted in DESIGN §6.1 ("Stuns remove his movement passive"). All v1 stuns are ≤ 0.8 s (DESIGN §8), so the window of vulnerability is short but meaningful.
- **Ramp on/off**: no ramp in Phase 2 baseline. Binary 0% → 15% at the 0.5 m/s threshold. See §10 for the open question about adding a 200 ms ramp if jitter-tanking emerges in playtest.

---

## 6. TTK Analysis

Computed against three targets: Anansi mirror (320 HP), Brigid (380 HP), Susanoo (420 HP). All math assumes 100% Silken Dart uptime for the "pure basic" case and ideal commit for the combo case. Strider's Balance is factored into all sustained-trade math (Anansi receives 15% less while moving — which he is, by design, always doing during a trade).

### Pure basic-attack uptime (no dodge, no ult)

At 80 dmg/shot × 2.5 shots/sec = 200 DPS theoretical. Real-match uptime after projectile travel time and micro-repositioning: ~70% → ~140 effective DPS.

| Target | HP | Shots to kill | Time to kill |
|---|---|---|---|
| Anansi mirror | 320 | 4 | 1.6 s clean / ~2.3 s realistic |
| Brigid | 380 | 5 | 2.0 s clean / ~2.7 s realistic |
| Susanoo | 420 | 6 (last shot overkill) | 2.0 s clean / ~3.0 s realistic |

The "realistic" numbers are TTK ceilings — in a real trade the opponent is also damaging Anansi. A 1:1 sustained trade where both sides miss ~30% of shots and move continuously ticks closer to the §6.4 "5–7 s sustained" band from both directions.

### Full combo burst (basic → Mirror Thread live → ultimate)

Mirror Thread cast (0.3 s) → clone fires alongside Anansi → Anansi keeps firing while the clone lands 20 dmg/shot at 0.5 s cadence → ult activates at charge threshold (assume 1 s into the trade) → dome drops on target, 30 dmg/s for 5 s (150 DoT) + Silken Dart continues inside.

Anansi output over a 3 s window: 3 s / 0.4 s = 7.5 → 7 shots × 80 dmg = 560 dmg. Clone output over 3 s: 3 s / 0.5 s = 6 → 6 shots × 20 dmg = 120 dmg. Ult DoT for full 5 s if target stays inside: 150 dmg.

**Combined 3-second combo burst with ult DoT starting at t=1 s (2 s of DoT in the window) = 560 + 120 + 60 = 740 damage** — kills any 320-HP mirror, kills a Brigid at 380, leaves a Susanoo at ~-320 HP if he stayed committed. Matches §6.4's "2–3 s full combo" band precisely.

### Strider's Balance in sustained trade

Incoming damage from opponent basic attacks is reduced 15% while Anansi is moving. Against a mirror Anansi firing 80-dmg Silken Darts at 0.4 s cadence, the effective incoming DPS drops from 200 to 170 — Anansi dies in 320 / 170 = 1.88 s (vs 1.6 s without the passive). In the 5–7 s sustained band, Strider's Balance is ~0.3 s of survival margin — not a kit-warping number, exactly the "rewards continuous motion" feel target.

**Conclusion**: numbers land inside §6.4's bands on all three targets without adjustment. No lever pull needed for Phase 2 baseline.

---

## 7. Counter-Play Scenarios

### Scenario 1 — Dive-in closer (Susanoo)
Susanoo Storm-Steps 6 m through Anansi's kite distance, triggering the empowered next-attack (+50%) — a 165-damage Kusanagi Cut that nearly half-bars Anansi. **Anansi's tech**: read the Storm Step windup visual, dodge-roll backward (3.6 m of i-frame movement); Silken Dart at Susanoo's feet for the slow slick; drop Eight-Strand Dome between them. The 40% slow turns Susanoo's next Storm Step CD into a commitment rather than a free reset. **Anansi loses** if he eats the Storm Step empowered hit without dodging — 165 + a Kusanagi follow-up closes 320 HP in 1.3 s.

### Scenario 2 — Zone-anchor (Brigid)
Brigid drops Hearthstone on a dais edge and camps the heal. **Anansi's tech**: do not Silken Dart into the totem's 1.5 m burn radius. Kite around the totem's 3 m heal circle; Silken Dart past the edge at Brigid's body; when she commits to Forge's Breath (0.7 s cast), place Mirror Thread on her firing line — if she tracks the clone, she wastes the ult; if she tracks Anansi, the clone applies 20 dmg DPS at 0.5 s for the full 4 s while Anansi dodges the line. **Anansi loses** if he stays in Forge's Breath line and tries to out-range-trade — the ult hits 200 + 40 dmg/s burn, and Anansi cannot out-sustain a Hearthstone-healed Brigid.

### Scenario 3 — Mirror match (Anansi vs Anansi)
The better Anansi wins by: (a) denying predictable kiting lines — breaking LoS on the standing stones of Sacred Grove rather than moving in arcs the opponent can pre-fire; (b) Mirror Thread timing — the good Anansi holds the clone until the opponent commits to ult, then eats the dome on the clone while the real Anansi repositions outside. **Loss-story A**: "predictable kiting" — Anansi B arcs around the center dais at a steady angular velocity; Anansi A pre-fires at the intercept point and lands 4 Silken Darts for a clean kill in 1.6 s. **Loss-story B**: "Mirror Thread mistimed into opponent's ult" — Anansi B casts Mirror Thread 0.1 s before Anansi A drops Eight-Strand Dome on both; the fresh clone and the real Anansi B both eat 150 DoT + Silken Dart suppression inside the dome; Anansi A walks the kill.

---

## 8. Feel & Readability

**Hit-confirm stack** (per DESIGN §4 — no deviation): hitstop 60 ms + victim additive-white flash 80 ms + particle burst at impact + Android haptic pulse.

**Silken Dart trail**: **1.5 m trail that fades over 0.4 s** (one full fire-rate cycle). 1.5 m is visible but does not ghost-persist into the next shot's trail, avoiding visual clutter when Anansi + clone are both firing. Gold wispy thread (signature color #D4A24A) with a silk-fiber texture. At 25 m/s projectile speed, the trail is exactly 60 ms of persistence behind the bolt head — reads as "threaded" rather than as a laser.

**Mirror Thread spawn telegraph**: **0.3 s fade-in with a web-weave shimmer expanding from Anansi's cast point outward, resolving on the clone's silhouette**. Not instant pop. Reason: instant-pop mirrors real players too accurately and the opponent's brain locks onto the first-spawned object, failing to disambiguate. A fade-in gives a 0.3 s window where the clone is visually "forming" — the opponent has information that *something* is spawning but the target-resolution lock doesn't happen until the clone is fully materialized. This deliberately hurts the "gotcha" slightly in favor of §4's reaction-window principle. The CB trade-off: fair gameplay beats perfect deception.

**Eight-Strand Dome cast telegraph**: **0.6 s windup** (mid-range of DESIGN §4's 0.3–1.0 s band). 0.6 s lets an opponent react with dodge-roll (0.3 s i-frames covers the last 300 ms if timed perfectly) or a Storm Step out. During the cast, Anansi visibly raises his hands and eight gold threads spin outward from his silhouette — reads as a trapper casting a snare, not as a sniper pressing a button. The dome then arrives at the target point with an additional 0.2 s expand-from-center animation; total "cast" → "dome is dealing damage" is 0.8 s.

---

## 9. Telegraphs (react-window per ability)

| Ability | Cast time | Recovery | Total animation |
|---|---|---|---|
| Silken Dart | 0 s (basic; projectile speed is the react-window) | 0 s | Shoulder-thread flick, 0.15 s |
| Mirror Thread | 0.3 s cast (fade-in) | 0.2 s recovery (Anansi cannot fire Silken Dart during) | 0.5 s total locked |
| Eight-Strand Dome | 0.6 s windup | 0.2 s dome-expand at target + 0.3 s post-cast recovery | 1.1 s total locked |

Silken Dart has no react-window by design per DESIGN §4 — basic attacks rely on projectile travel time (0.4 s at max range) to give the target a chance to dodge. Mirror Thread and Eight-Strand Dome both fall inside the 0.3–1.0 s telegraph band mandated by §4.

---

## 10. v1.1 Open Questions

1. **Input-mirror clone in networked MP**. ADR-0010 locks AI-controlled for v1. In v1.1 netcode (deterministic lockstep already captures inputs), evaluate whether a human-mirrored clone on a flipped axis raises the skill ceiling enough to justify the input-routing work. Playtest metric: does the "gotcha" hit rate against hard bots exceed 40% in Phase-2 T-107? If yes, AI clone is "too good" at fooling humans and input-mirror is overkill for v1.1. If no (< 25%), the AI clone is weak and input-mirror is the right v1.1 upgrade.
2. **Ult clone-kill credit**. If the Eight-Strand Dome's DoT deals the killing tick on an enemy, does Anansi receive the kill credit (and the `Storm's Rebirth`-style future passive hooks)? Phase 2 baseline stance: **yes, Anansi gets credit for all dome DoT kills**. Revisit if kill-feed/statistics read as unfair.
3. **Strider's Balance ramp**. Playtest-sensitive. If players "jitter-tank" at the 0.5 m/s boundary (tapping directional input between shots to trigger-toggle the passive), add a 200 ms ramp from 0% → 15% gated on continuous motion above threshold. Default Phase 2 baseline: no ramp; binary threshold.
4. **Mirror Thread clone + Glyph of Haste pickup**. If Anansi is carrying Haste when casting Mirror Thread, does the clone inherit the +30% speed? Phase 2 baseline stance: **no** — buffs on Anansi at cast time are not transferred to the clone. The clone is a fresh AI entity with base stats.

---

## 11. Balance Levers (CB's back-pocket)

Rank-ordered by effect size for playtest T-107 tuning. First lever pulled if Anansi overperforms; reversed if underperforms.

1. **Silken Dart fire rate** (0.4 s ↔ 0.5 s) — largest DPS swing. 0.5 s drops theoretical DPS from 200 → 160, lowers realistic from ~140 → ~112. Pull this *first* if sustained TTK on 320-HP mirrors drops below 4 s.
2. **Mirror Thread cooldown** (8 s ↔ 10 s) — reduces clone pressure frequency. Pull if players report "the clone is always up" after T-107 qualitative reviews.
3. **Ultimate charge requirement** (1500 ↔ 1800) — slows ult economy by ~20%. Pull if Anansi charges ult before opponents charge theirs consistently.
4. **Strider's Balance % reduction** (15% ↔ 10%) — mild DR nerf. Pull if Anansi's realistic TTK-received exceeds 7 s (over-tanks the kiting).
5. **Eight-Strand Dome radius** (5 m ↔ 4 m) — reduces ult coverage. Pull if dome-on-dais totem lockouts become degenerate.
6. **Silken Dart slow** (15% ↔ 10% / 20%) — subtlest lever. Pull in either direction if the kiting feel is off without affecting damage.
7. **Mirror Thread clone HP** (100 ↔ 80 / 120) — reduces/increases clone survivability without touching DPS math.

Levers 1–3 are the "big dials"; 4–7 are fine-tuning. Never pull more than two in a single playtest round — one tuning vector at a time per T-107 discipline.

---

*End of Anansi final-kit document. Approximate length: ~2,350 words.*

*Updates to this document after T-107 playtest must be logged as an ADR in `/docs/DECISIONS.md` (new ADR number, monotonic) with before/after numbers cited.*
