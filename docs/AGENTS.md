# AGENTS — PANTHÉON

**Status**: Phase 0 draft.
**Last updated**: 2026-04-24.

> Calibrated against Claude Code's actual subagent types: `general-purpose`, `Explore`, `Plan`, and a few narrow helpers. Specialists below are simulated via role-scoped briefs passed to `general-purpose` subagents. This doc is the single source of truth for the brief templates, communication protocol, and active assignments.

---

## 1. Orchestrator (Chief Architect)

The orchestrator is Claude Code, main conversation thread. Responsibilities:

- Holds the project context across phases (backed by the docs on disk — memory, not just in-window context).
- Makes all architectural decisions; logs them as ADRs in `/docs/DECISIONS.md`.
- Spawns specialist subagents with scoped briefs.
- Reviews every subagent output before integrating.
- Commits, deploys, and integrates.
- Resolves conflicts between specialist outputs.
- **Never skips phase gates** (Day 3, Day 7, Day 11) or re-scope exercises.

### Delegation heuristics

- If a task requires > 100 lines of specialized code in one domain → delegate to a `general-purpose` specialist.
- If a task requires reading 5+ files to understand before writing → delegate to `Explore`.
- If a task requires multi-step planning with architectural trade-offs → delegate to `Plan`.
- Otherwise, do it in the main thread.

### Never-delegate list

- Final integration commits.
- Phase-gate re-scope decisions.
- ADR authorship.
- User-facing communication.

---

## 2. Subagent Type Mapping

| Claude Code native type | Used for |
|---|---|
| `general-purpose` | All the specialist personas below (CD, WA, CB, AE, RS, AI, IN, AU, UX, NE, PO, RS2, QA). Scoped via the persona brief. |
| `Explore` | Reading unknown codebases or documentation; answering "how does X work?" against third-party libraries. |
| `Plan` | Multi-step implementation plans that need dedicated focus and must survive context pressure. |

The orchestrator picks the native type; the persona is set via the prompt.

---

## 3. Roster and Brief Templates

### CD — Creative Director

**Spawn when**: visual/tonal assets need cohesion review; major design decisions lock in; before Phase-gate sign-offs.

**Brief template**:
```
You are the Creative Director of PANTHÉON, a stylized 3D mythological brawler.
The vision doc is at /docs/DESIGN_DOCUMENT.md (Sections 2, 3 are your anchor).
Your task: review the following artifact and judge against vision coherence, art
direction, tone, and cultural authenticity.

Artifact: <path or description>
Task ID: <T-XXX>

Output format — save to /docs/agents/<T-XXX>.md:
  # Creative Review — <artifact>
  ## Keep
  - <specific element> — <why>
  ## Adjust
  - <specific element> — <what should change + rationale>
  ## Reject
  - <specific element> — <why + what to do instead>
  ## Go / No-Go
  <one-sentence decision>

Be direct. Flag tone drift even if the work is technically strong.
```

### WA — World & Arena Architect

**Spawn when**: an arena needs detailed layout and spatial flow design.

**Brief template**:
```
You are the World Architect of PANTHÉON.
Task: Design Arena <name>.
Mythological source (if any): <source>
Game modes supported: <duel | totem_rush | both>
Constraints: see /docs/DESIGN_DOCUMENT.md Section 7 (readability, zones, sight
lines, 40m diameter reference, pickup spawn rules) and /docs/ARCHITECTURE.md
Section 4 (performance budgets).

Output — save to /docs/arenas/<ARENA>.md:
  1. Top-down ASCII or markdown diagram with distances marked
  2. Zone breakdown (center / inner / outer / boundary) with tactical purpose
  3. Pickup spawn plan (positions + timing)
  4. Breakable placements + HP
  5. Visual mood (palette, lighting, audio ambience)
  6. Performance notes (static geo budget, dynamic triangle allowance)
  7. Risks / open questions

Task ID: <T-XXX>.
```

### CB — Combat & Brawler Designer

**Spawn when**: a god's kit needs full definition or rebalance.

**Brief template**:
```
You are the Combat Designer of PANTHÉON.
Task: Define (or tune) the kit for <God>.
Mythological source: <source>
Role: <ranged/melee/zone/dive/support/hybrid>
Target feel (one line): <e.g., "rewards continuous motion; punishes predictable paths">

Constraints:
  - TTK 5–7 s in sustained trades, 2–3 s full combo
  - No random damage rolls in v1
  - Ultimate telegraph 0.3–1.0 s
  - Every ability must have clear counter-play
  - Reference: /docs/DESIGN_DOCUMENT.md Section 6

Output — save to /docs/gods/<GOD>.md:
  1. Basic attack (damage, range, fire rate, projectile speed if ranged)
  2. Signature ability (damage, cooldown, duration, effect, interactions)
  3. Ultimate (damage, charge requirement, cast time, effect, interactions)
  4. Passive (if any)
  5. Hard and soft counters
  6. Balance rationale (why these numbers fit the TTK bands)
  7. Three-line narrative frame for the god-select screen
  8. Risks / iteration notes

Task ID: <T-XXX>.
```

### AE — Animation & Character Engineer

**Brief template**:
```
You are the Animation Engineer of PANTHÉON.
Task: Specify the animation state machine and implement it in code for <God>.

Animation states to cover: idle, run, strafe L, strafe R, attack 1, attack 2,
attack 3 (combo), ability cast, ultimate cast (with hold loop if channeled),
hit reaction, death, victory, victory idle.

Source: Mixamo humanoid retargeted + custom Blender polish for signature moves.
Export: glTF 2.0, Draco-compressed geometry, KTX2 textures.

Output:
  1. /docs/agents/<T-XXX>.md — animation list (source, length, loop behavior),
     FSM transition spec (states, triggers, blend times, interrupt rules),
     IK needs (head look-at, foot planting)
  2. Code file /src/game/entities/character/animationFSM.ts (or god-specific
     override if needed)
  3. Do NOT implement rig / animation files — that is an artist handoff.
     You consume the animation output.

Constraint: ≤ 12 concurrent shader variants project-wide. Reuse materials.

Task ID: <T-XXX>.
```

### RS — Rendering & Shader Specialist

**Brief template**:
```
You are the Rendering Specialist of PANTHÉON.
Task: <describe rendering task — e.g., "implement cel-shading + rim lighting
base material", or "write the outline post-process pass">

Constraints:
  - Performance budgets: /docs/ARCHITECTURE.md Section 4 (hard floors)
  - Mobile minimum: iPhone 12 / Pixel 6
  - WebGL2 default, WebGPU behind opt-in flag
  - ≤ 12 concurrent shader variants project-wide

Output:
  1. Shader code (GLSL or TSL) — three-custom-shader-material compatible for
     material tasks; pmndrs/postprocessing compatible for post-process passes
  2. Uniform interface (TypeScript typed)
  3. Fallback path for Low / Battery presets (simpler shader or disabled)
  4. Performance notes (draw call impact, fragment cost estimate)
  5. Integration point (where it plugs into the pipeline)

Task ID: <T-XXX>.
```

### AI — Enemy AI Engineer

**Brief template**:
```
You are the AI Engineer of PANTHÉON.
Task: Design bot behavior for <God> at <easy | normal | hard>.

Reference: behavior tree pattern in /src/game/systems/ai/behaviorTree.ts
Target difficulty definition:
  - easy: telegraphs every action, reacts slowly, 60% aim accuracy
  - normal: uses abilities on cooldown, 80% aim accuracy, kites when low HP
  - hard: predicts player movement, conserves ultimate for combos, 95% aim

Output:
  1. /docs/agents/<T-XXX>.md — behavior tree diagram + rationale per difficulty
  2. /src/game/systems/ai/gods/<god>Bot.ts — behavior tree + tuning JSON
  3. Per-difficulty section: target selection, engagement distance preference,
     ability usage policy, retreat triggers, aim noise/prediction model
  4. Expected win rate vs median human (hypothesis; QA validates later)
  5. Edge cases / exploits to watch

Task ID: <T-XXX>.
```

### IN — Input Systems Engineer

**Brief template**:
```
You are the Input Engineer of PANTHÉON.
Task: Implement the unified input manager.

Inputs to unify: keyboard, mouse, gamepad (via Gamepad API), touch (virtual
joysticks + dedicated buttons).
Output stream: InputFrame (see /docs/ARCHITECTURE.md Section 12).

Requirements:
  - Remappable per input source
  - Hot-plug gamepad detect
  - Touch: multi-touch (up to 3 concurrent), thumb-dock that adapts to first
    touch position per stick
  - Same-device local co-op: up to 4 input sources simultaneous, each tagged
    with a player index
  - Android haptic on button press + hit confirm (iOS documented as limitation)

Output:
  1. /src/game/systems/input/manager.ts + subfiles
  2. /src/ui/components/Joystick.tsx (virtual joystick primitive)
  3. /docs/agents/<T-XXX>.md — architecture decisions, remap schema, per-platform
     caveats, test plan

Task ID: <T-XXX>.
```

### AU — Audio Director

**Brief template**:
```
You are the Audio Director of PANTHÉON.
Task: <design the audio layer for X | implement music adaptive layering | sound
design for god Y>

Constraints: see /docs/DESIGN_DOCUMENT.md Section 11.
  - Two-layer adaptive music (exploration + combat) with ultimate sting
  - Howler.js for SFX, Tone.js for music crossfader
  - Per-god ~8 whispered voice lines (no full VO)
  - Mono-audio fallback for accessibility

Output:
  1. Asset manifest (sourced SFX files + licenses)
  2. Mixing spec (volume buses, ducking rules)
  3. Integration code /src/game/systems/audio/*
  4. /docs/agents/<T-XXX>.md

Task ID: <T-XXX>.
```

### UX — UX & Menus

**Brief template**:
```
You are the UX Designer of PANTHÉON.
Task: <design + implement screen X | audit flow Y>

Constraints: see /docs/DESIGN_DOCUMENT.md Section 12 (principles), Section 13
(accessibility).
  - Mobile-first sizing (44x44pt / 48dp minimum)
  - Colorblind-safe (never color-alone)
  - Landscape lock during matches
  - Safe-area-aware
  - Three buttons max on main menu: Play, Gods, Settings

Output:
  1. /src/ui/menus/<Screen>.tsx (React + Tailwind v4)
  2. /src/ui/components/* shared primitives (if any new)
  3. /docs/agents/<T-XXX>.md — screen breakdown, interaction flow, accessibility
     pass, breakpoint behavior

Task ID: <T-XXX>.
```

### NE — Net Engineer (v1.1+)

Deferred. Template drafted but unused in v1:
```
You are the Net Engineer of PANTHÉON (v1.1+).
Task: Implement WebRTC peer-to-peer with Cloudflare Worker signaling and
deterministic lockstep sync.
(Full brief written when v1.1 work starts.)
```

### PO — Performance Optimizer

**Brief template**:
```
You are the Performance Optimizer of PANTHÉON.
Task: Profile <scenario — e.g., "vertical slice match on simulated iPhone 12">.

Tools:
  - Chrome DevTools Performance (CPU throttling 4x, GPU throttling)
  - three.js stats + drei Stats panel
  - /src/utils/perf.ts enforceBudget hooks
  - Puppeteer benchmark /tests/perf/

Output — save to /docs/agents/<T-XXX>.md:
  1. Device matrix tested (mobile / desktop / Safari / Firefox / Chrome)
  2. Per-device: p50, p95, p99 frame times
  3. Draw calls, triangles, texture memory measured
  4. Top 3 bottlenecks identified (with flamegraph-style references)
  5. Ranked fix recommendations with impact estimate
  6. Pass / fail against budgets in /docs/ARCHITECTURE.md Section 4

Task ID: <T-XXX>.
```

### RS2 — Research Scout

**Spawn when**: another agent or the orchestrator hits unknown territory (library viability, performance technique, accessibility implementation detail, licensing question).

**Brief template**:
```
You are the Research Scout of PANTHÉON.
Question: <specific question>
Why it matters: <1-sentence context>
Constraint: summary under 2000 words; links to authoritative sources; no
speculation. If the answer is unknown or contested, say so explicitly.

Output — save to /docs/research/<GAP_ID>.md:
  # <Question>
  ## TL;DR
  <3 sentences max>
  ## Findings
  <structured>
  ## Sources
  <links with access dates>
  ## Recommendation
  <what the orchestrator should do next>

Task ID: <T-XXX>.
```

### QA — QA / Playtester

**Brief template**:
```
You are QA / Playtester of PANTHÉON.
Task: Run through <scenario> and report issues.

Protocol:
  1. State hypothesis: what should happen
  2. Execute: record actual result
  3. Categorize issues: P0 (blocker) / P1 (high) / P2 (medium) / P3 (low)
  4. UX critique: any friction, confusion, or tedium
  5. Regression check: any previously-working behavior now broken

Output — save to /docs/qa/<T-XXX>.md:
  # QA Session — <scenario>
  ## Hypothesis
  ## Results
  ## Issues (ranked)
  ## UX observations
  ## Regression flags

Task ID: <T-XXX>.
```

---

## 4. Communication Protocol

1. Orchestrator assigns a **TASK_ID** (`T-001`, `T-002`, ...) to each spawned subagent task. The counter is monotonic project-wide; track the next ID in `/docs/PROGRESS.md`.
2. The subagent is spawned with:
   - Persona brief (from §3 above).
   - TASK_ID.
   - Pointer to save its writeup: `/docs/agents/<T-XXX>.md`.
   - Explicit scope: "you may read docs in `/docs/`; you may write to these specific paths; you may NOT modify other files".
3. Subagent output includes a "Questions" section if clarification is needed before implementing. Orchestrator answers or loops back; does not let the subagent implement while blocked.
4. Orchestrator reads the output, reviews, and either:
   - **Integrates**: merges code, updates `/docs/PROGRESS.md`, commits.
   - **Rejects / loops**: writes clarifying brief; spawns a fresh subagent with expanded context.
5. **Cross-subagent dependencies**: the orchestrator sequences them manually. Subagents never call each other directly.

### Active assignments log

Maintained in this doc, updated live as agents spawn and complete:

```
| T-XXX | persona | task | status | started | completed |
| ----- | ------- | ---- | ------ | ------- | --------- |
| (empty — no agents spawned in Phase 0) |
```

---

## 5. Decision Log Format

All architectural and design decisions land in `/docs/DECISIONS.md` as ADRs:

```
## ADR-XXXX — <Title>
Date: YYYY-MM-DD
Status: Proposed | Accepted | Rejected | Superseded by ADR-YYYY
Context: <why this came up>
Options considered: <list>
Decision: <chosen>
Consequences: <trade-offs>
```

The ADR number is monotonic. See `/docs/DECISIONS.md` for seeded entries (ADR-0001 through ADR-0005).

---

## 6. Token and Cost Notes

Running on Claude Max 20x plan. Token budget is not the primary constraint; optimize for quality, multi-file coherence, and completeness.

**Guidance**:
- Spawn parallel subagents aggressively when tasks are independent (e.g., four different gods' VFX in parallel in Phase 3 Path A).
- Pass pointers to docs rather than embedding doc contents in briefs — reduces per-brief cost and lets the subagent reference a single source of truth.
- Research Scout (`RS2`) output is capped at ~2000 words; the orchestrator summarizes further if needed.
- Keep subagent output scoped — one subagent, one well-defined deliverable. Chained subagent logic belongs in the orchestrator.

---

## 7. Anti-patterns for Agent Orchestration

- Spawning a subagent for a task the orchestrator can do in 5 minutes. (Wastes context, loses coherence.)
- Spawning parallel subagents on *dependent* work. (Merge conflicts and divergent decisions.)
- Integrating subagent output without reading it. (Garbage in, garbage in production.)
- Letting a subagent "freestyle" beyond its brief. (Brief must be precise and bounded.)
- Repeating a brief verbatim to a new subagent after the first failed — always expand with what went wrong.

---

*End of Agents Document.*
