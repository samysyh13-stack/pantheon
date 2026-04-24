# DECISIONS — PANTHÉON (ADRs)

**Status**: Seeded with Phase 0 decisions.
**Last updated**: 2026-04-24.

Entry format:
```
## ADR-XXXX — <Title>
Date: YYYY-MM-DD
Status: Proposed | Accepted | Rejected | Superseded by ADR-YYYY
Context: <why this came up>
Options considered: <list>
Decision: <chosen>
Consequences: <trade-offs>
```

ADR numbers are monotonic. Once an ADR is Accepted, it is never edited — a new ADR supersedes it with Status "Superseded by ADR-YYYY" written onto the old one.

---

## ADR-0001 — WebGL2 default, WebGPU opt-in

Date: 2026-04-24
Status: Accepted

Context: WebGPU has better performance characteristics on modern hardware but Safari (mobile and desktop) still has gaps in WebGPU support as of April 2026. Defaulting to WebGPU would break the mobile-first commitment.

Options considered:
- A. WebGPU default everywhere
- B. WebGL2 default, WebGPU opt-in behind a user-settings flag
- C. Detect and autoselect at runtime

Decision: **B**.

Consequences: Slightly more code paths to maintain (two renderer paths). Safari users are not broken at launch. Desktop power users can opt in via Settings > Graphics > Renderer > WebGPU. Mobile users remain on WebGL2 until Safari catches up (re-evaluate at v1.1).

---

## ADR-0002 — WebRTC multiplayer deferred to v1.1

Date: 2026-04-24
Status: Accepted (pending user confirmation of R-03)

Context: The v1 ship-scope section of the kickoff spec defers WebRTC to v1.1, but the modes section lists "private room via WebRTC" as v1. Inconsistent. A full WebRTC + signaling + deterministic lockstep implementation is a multi-day task that blows the 14-day budget.

Options considered:
- A. Ship WebRTC in v1 (compresses other scope)
- B. Defer to v1.1; v1 uses same-device local co-op as the "play with a friend" solution
- C. Ship a broken-but-technically-multiplayer shared-state hack (rejected — quality floor)

Decision: **B**.

Consequences: Some adoption friction at launch versus the hero feature of "share a URL to play together". User explicitly trades this against shipping a polished v1 on time. Same-device split-screen is in v1 scope and covers local-friend play. WebRTC lands in v1.1 with a Cloudflare Worker signaling relay (ADR to come).

---

## ADR-0003 — Three bot difficulties instead of matchmaking

Date: 2026-04-24
Status: Accepted

Context: Matchmaking requires a backend, a player pool, and rating algorithms. None of these are reachable in 14 days with a one-person + Claude team.

Options considered:
- A. Skill-based matchmaking (requires backend; deferred to v2)
- B. Three tuned bot difficulties per god (easy / normal / hard)
- C. No bots, local-co-op-only (insufficient — many players will visit solo)

Decision: **B**.

Consequences: v1 solo play is vs-bot only. Bot quality is load-bearing — hard bots must feel like a competent human opponent or the game reads as "practice mode". AI subagent has a high bar in Phase 2.

---

## ADR-0004 — No damage RNG in v1

Date: 2026-04-24
Status: Accepted

Context: Lockstep determinism for v1.1 networking requires identical simulation across peers. Random damage rolls at a per-hit granularity complicate the desync-detection logic. Additionally, RNG damage feels bad at small sample sizes of a 3-minute match.

Options considered:
- A. Seeded RNG per match (works for lockstep; still feels random)
- B. Fixed damage numbers with deterministic status-effect procs
- C. Damage range rolled at round start and held constant per match

Decision: **B**.

Consequences: Numbers are flat. Status effect procs (burn stack chance, crit on specific triggers) are counted deterministically (every 3rd hit, or similar), not rolled per-hit. Balance design is simpler and more readable; the trade-off is reduced "surprise" from damage variance.

---

## ADR-0005 — No paid monetization in v1

Date: 2026-04-24
Status: Accepted

Context: Building player base is the v1 goal. Monetization design adds scope (paywall flow, account auth, billing integration) and competes with polish time.

Options considered:
- A. Cosmetic-only one-time purchases in v1
- B. No monetization in v1; player-base-first
- C. Donation button

Decision: **B**.

Consequences: No revenue from v1. v2 may add cosmetic-only purchases (skins, arena palette variants). Lootboxes, gacha, pay-to-win mechanics, and energy timers are **permanently excluded** — this is a brand commitment, not a scope deferral.

---

## ADR-0006 — Deterministic simulation architecture from day one

Date: 2026-04-24
Status: Accepted

Context: v1.1 netcode is designed as deterministic lockstep (minimal retrofit if v1 is deterministic). Making simulation deterministic is cheap up-front and expensive later.

Options considered:
- A. v1 non-deterministic, retrofit at v1.1 (expensive, likely incomplete)
- B. Deterministic from day one: seeded RNG, fixed-tick, no wall-clock in simulation
- C. Deterministic only for networked features (hybrid; complexity)

Decision: **B**.

Consequences: Small constraints on gameplay code (no `Math.random()`, no `performance.now()` inside simulation). Large payoff at v1.1. Determinism also enables match-replay and bug reproduction from input logs.

---

## ADR-0007 — Docs on disk are the source of truth, not in-window context

Date: 2026-04-24
Status: Accepted

Context: Claude Code context windows are large (1M on Max 20x plan) but not unlimited across multi-day sessions. Compaction and context drift over time is real.

Options considered:
- A. Rely on in-memory context; re-inject docs when they become relevant
- B. Treat `/docs/*.md` as source of truth; every subagent brief points to paths rather than embedding content; orchestrator re-reads docs when uncertain
- C. Both (redundant)

Decision: **B**.

Consequences: Subagent briefs are shorter and cheaper. Authority lives in the files. The orchestrator must discipline itself to re-read docs rather than trust remembered summaries — when in doubt, Read.

---

## ADR-0008 — Role-tiered HP per god

Date: 2026-04-24
Status: Accepted

Context: Each v1 god needs a base HP that reflects their role. Originally undefined in the draft design doc. User requested explicit values: Anansi 320, Brigid 380, Susanoo 420.

Options considered:
- A. Flat HP for all gods (simple; erases role identity)
- B. Role-tiered HP (glass-cannon ranged / anchor / dive) — pairs with active defenses
- C. Stat-heavy (HP + armor + magic resist) — too complex for v1 scope

Decision: **B**. Anansi 320 (glass-cannon ranged), Brigid 380 (medium anchor), Susanoo 420 (tank-ish dive).

Consequences: Adds a readable dimension to god identity without introducing a full stat RPG. TTK bands in §4 (5–7 s sustained, 2–3 s full combo) must be re-verified at Phase 2 QA against these HP values. Forces ADR-0009 (Orochi's Wake damage reduction) — 480 total on Anansi's 320 HP would have been a one-shot, violating §4's no-instant-kill principle.

---

## ADR-0009 — Orochi's Wake per-head damage reduced 60 → 35

Date: 2026-04-24
Status: Accepted

Context: With Anansi at 320 HP (ADR-0008), Susanoo's original ultimate at 60 damage × 8 heads = 480 total would have been a one-shot. This violates the §4 "no feel-bad instant-kill" principle — ultimates must have a reaction window that allows counter-play within a survivable HP envelope.

Options considered:
- A. Reduce per-head damage from 60 → 35 (280 total max)
- B. Reduce head count from 8 → 5 (loses the narrative fidelity to Yamata-no-Orochi's eight heads)
- C. Add damage falloff per subsequent head (complex to tune)
- D. Slow the sweep (already 1.5 s; stretching further kills the climactic feel)

Decision: **A**. 35 damage per head, 280 total maximum. Preserves the dramatic eight-head sweep narratively and visually; preserves §4's principle.

Consequences: Susanoo's ultimate becomes a strong combo finisher rather than a solo-kill button. Requires a combo setup (Storm Step → empowered basic → ultimate) to close a target. Balance pass at Phase 2 QA may further tune up or down based on playtest feel.

---

## ADR-0010 — Mirror Thread clone is AI-controlled in v1

Date: 2026-04-24
Status: Accepted

Context: The original "mirror player input on a flipped axis" idea is clever but adds input-routing complexity (intercept player input stream, transform, re-route as a second character) and has no meaningful behavior in solo-vs-bot (v1's primary mode) where there is no shared input surface. The clone needs to *do* something tactically useful; a static decoy is too weak to force disambiguation.

Options considered:
- A. AI-controlled clone with basic kiting logic (perpendicular move, basic attack only)
- B. True input-mirroring on a flipped axis (requires intercepting player input pipeline; no clear payoff solo)
- C. Stationary decoy (fire-and-forget; too easy to ignore)
- D. Clone mirrors last N seconds of player's recorded input (replayable but feels laggy)

Decision: **A** for v1. Clone is AI-controlled, moves perpendicular to nearest enemy, fires Silken Dart only (no ability, no ultimate). "Mirror" naming is symbolic / visual — identical model, identical silhouette, shimmering web-weave particles — not mechanical input mirroring.

Consequences: Clone reuses the bot AI behavior-tree infrastructure (minor scope, already in Phase 2 backlog). Naming remains thematic. In v1.1 (networked multiplayer), re-evaluate option B: input-mirroring is more satisfying when a skilled human is on the other side, and the netcode is already doing lockstep input capture, which reduces the implementation delta.

---

## ADR-0011 — Hearthstone self-heals Brigid

Date: 2026-04-24
Status: Accepted

Context: Original Hearthstone design healed only allies. v1 primary mode is Duel 1v1 — no allies exist. The totem therefore had zero defensive utility for Brigid in 1v1, reducing it to a burn-aura tool and making the ability unreadable with her "anchor" role.

Options considered:
- A. Self-heal always (Brigid + allies within 3 m for 30 HP/s)
- B. Allies-only + compensate with stronger burn aura (keeps the "totem = ally support" framing but hollows the role)
- C. Self-heal only in modes without allies (conditional; adds UX complexity)
- D. Rework totem as purely damage (loses the healing/hearth mythological theme)

Decision: **A**. Totem heals Brigid and allies at the same 30 HP/s rate.

Consequences: Brigid's anchor identity is reinforced — she has reliable self-sustain in her territory. Balance must watch for "totem-park" degenerate gameplay; mitigated by 6-s totem duration, 10-s cooldown, 150 HP destructible. Self-heal carries through to v1.1 3v3 where it stacks with ally healing — verify at Phase 2 balance pass that this doesn't push her into overpowered in team modes.

---

## ADR-0012 — Sacred Grove visual direction: neutral overcast baseline

Date: 2026-04-24
Status: Accepted

Context: Original "afternoon sun through canopy" created a specific time-of-day feel that biased toward certain mythological associations (a warm, daylit grove evokes Celtic and Japanese forest-kami settings more than Aztec or West African ones). For a neutral "liminal meeting place" arena, a more ambiguous lighting mood is better.

Options considered:
- **(a)** Dynamic time-of-day rotation per match (dawn / dusk / overcast / night)
- **(b)** Neutral overcast baseline — diffuse silver-white sky, no pronounced sun
- **(c)** Elemental mix — one standing stone per element (fire / water / wind / stone) drawing subtle motifs from multiple traditions

Decision: **(b) for v1**. **(a)** held for v1.1 as a palette-only variant system (no extra geometry cost — just HDRI + LUT swap). **(c)** rejected: risks cultural-motif collision without a sensitivity-read pass.

Consequences: v1 shipping arena has a single overcast lighting setup — simpler to author, faster to ship, neutral-mood for all gods. v1.1 time-of-day adds visual variety for free (no geometry, just asset swaps). Banner-rune design must be abstract and in-house — no real-world scripts — to avoid the same cultural-collision risk that (c) was rejected for.

---

## ADR-0013 — Hand-rolled InstancedMesh particle layer over three-nebula

Date: 2026-04-24
Status: Accepted

Context: Risk R-05 in /docs/DESIGN_DOCUMENT.md §15 flagged `three-nebula`'s uncertain maintenance status and asked whether it is viable as the v1 particle engine. T-003 (RS2 Research Scout) investigated and wrote up the findings in /docs/research/R-05.md. Summary of dealbreakers:
1. `three-nebula` GPURenderer is documented incompatible with iOS Safari (floating-point-texture dependency), leaving only the CPU SpriteRenderer on our most-constrained target — the opposite of what a 30 FPS iPhone 12 / Pixel 6 floor needs.
2. Package is effectively stalled: last npm publish 2021-11-05, last master commit 2022-08-07, Snyk health 48/100, "Future of the library" meta-issue (#220) unanswered.
3. No shipped `.d.ts` (only a single-author 2025 DefinitelyTyped package), no official R3F wrapper, historical bundle-bloat from shipping a duplicate three.js.
4. Architecture is CPU-loop sprite/mesh, not `InstancedMesh` — poor draw-call story at scale without manual batching.

Options considered:
- A. Adopt `three-nebula` with its risks.
- B. Adopt `three.quarks` (actively maintained, TypeScript-first, has an R3F package).
- C. Hand-roll `InstancedMesh` + `Points` layer (~5 small building blocks: `ParticlePool`, `Emitter`, `particle.glsl`, `RibbonStrip`, `VFXController`). Use drei `<Sparkles />` / `<Trail />` tactically for pickup auras and projectile trails.
- D. `<Sparkles />` / `<Trail />` only (too scoped for full v1 VFX — Anansi dome shimmer, Brigid fire-line ultimate, Susanoo Orochi's Wake ribbon).

Decision: **C**. Hand-rolled layer in `src/vfx/` (Phase 2). Author once, reuse per god. Keep `three.quarks` as the escape-hatch fallback if hand-rolling blocks Phase 2 velocity; decision point at Phase 2 Day 8.

Consequences:
- Phase 2 gets ~6–9 engineer-days of up-front VFX infrastructure work before per-god kits. Anansi / Brigid / Susanoo VFX then become shader and sprite-atlas authoring, not engine authoring.
- We own sprite-atlas packing (fits per-god 8 MB asset budget from R-15), mobile-safe draw-call count (1 call per pool), and accessibility Reduced Motion becomes a uniform scale (trivial).
- Auto-downgrade to `THREE.Points` on the Mobile Low preset is a geometry swap with identical instance attributes.
- Risk: if hand-rolling exceeds 9 engineer-days in Phase 2, we fall back to `three.quarks` per the research doc's watch-list plan. This is a re-scope we accept rather than shipping a dead dependency.
- No net gain in repo footprint from three-nebula: the hand-rolled layer is ≤ 20 KB of TS/GLSL source plus a ≤ 256 KB sprite atlas, well under three-nebula's 2.91 MB unpacked bundle.

---

*End of Decisions Document. Additional ADRs appended as decisions land.*
