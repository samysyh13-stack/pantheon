# Sacred Grove — Arena Design (stub)

> **Phase 0 stub.** v1 design source of truth: `/docs/DESIGN_DOCUMENT.md` §7.
> Fully populated by **WA** subagent in Phase 2 task **T-104** (arena polish) with diagram, zone spec, spawn plan, breakable placements, visual mood, perf notes.

## At-a-glance (from DESIGN_DOCUMENT.md §7)

- **Type**: Neutral mythological sanctuary (no single culture; no god favored)
- **Dimensions**: Circular-ish, 40 m diameter
- **Layout**: Gentle slope from edges to central raised dais (0.5 m raise)
- **Zones**: center dais (5 m radius, contested) / inner ring (5–12 m, shrines) / outer ring (12–18 m, pillars) / storm boundary (20+ m, damage zone)
- **Pickups**: health shard, ultimate charge, glyph of haste — spawn every 12–18 s alternating
- **Breakables**: four shrines (300 HP each) at cardinal compass points, drop guaranteed pickup on destruction
- **Lighting**: neutral overcast baseline (diffuse silver-white sky, soft omnidirectional fill, no pronounced sun) — per ADR-0012
- **Spectator hook**: central totem pillar-of-light colored by current holder

## Open questions

- Surface materials for footsteps — stone (dais + pillars), grass (outer ring), water (shallow pools: do they block movement or just slow?)
- Wind banner animation — how expensive (vertex-shader animation vs skeletal)
- Storm-boundary push-force magnitude — must be strong enough to deter but not lock-out if briefly stepped in
- Single-arena visual fatigue (R-13) — day/night variant or LUT shift as v1.1 quick-add?

## Performance target

- Static geometry: ≤ 30k triangles total for arena props + terrain
- Dynamic budget (reserved for characters + projectiles + VFX + pickups + breakables): 120k triangles
- Single directional light + one ambient fill. No dynamic point lights.
- Shadows: cascaded directional on desktop; baked on mobile Low preset.

## Locked in Phase 0 amendments

- Visual direction is **neutral overcast baseline** per ADR-0012. Options (a) dynamic time-of-day and (c) elemental mix were considered and deferred/rejected; see the ADR.
- v1.1 stretch: time-of-day rotation (dawn / dusk / overcast / night) as palette-only variant swaps (no geometry cost).

## Visual references to research in Phase 2

- Breath of the Wild shrine interiors (cel-shaded PBR, minimal but painterly) — for stone + flora treatment
- Hades' mythological-neutral hub-space palette work — for the liminal mood
- *Overcast* environment references: Spiritfarer misty-island compositions, Journey's overcast-hill sections, Gris diffuse-sky passages

---

*Populated further by WA (T-104) in Phase 2.*
