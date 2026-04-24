# Anansi — God Design (stub)

> **This is a Phase 0 stub.** The v1 design source of truth is `/docs/DESIGN_DOCUMENT.md` §6.1.
> Full design (final tuned numbers, iteration history, animation state list, VFX spec, audio manifest) will be written by the **CB** subagent in Phase 2 task **T-100** and expanded by **AE / RS / AU** in T-101 / T-102 / T-103.

## At-a-glance (from DESIGN_DOCUMENT.md, post-amendment 2026-04-24)

- **Mythology**: West African / Akan-Ashanti
- **Role**: Ranged trickster, zone-control, kiter
- **Max HP**: 320 (glass-cannon ranged) — per ADR-0008
- **Signature color**: Deep gold (#D4A24A)
- **Basic**: Silken Dart (ranged projectile, 80 dmg, 0.4 s fire rate, slow proc)
- **Signature**: Mirror Thread (clone, 8 s CD) — **v1 clone is AI-controlled kiter** per ADR-0010
- **Ultimate**: The Eight-Strand Dome (trap zone, 1500 charge)
- **Passive**: Strider's Balance (-15% dmg while moving)

## Locked in Phase 0 amendments

- Clone behavior: AI-controlled, kites perpendicular to nearest enemy, basic attack only, no ability/ultimate. Symbolic "mirror" naming via identical model + web-weave shimmer. See ADR-0010.
- v1.1 revisit: evaluate input-mirror-on-flipped-axis clone for networked play.

## Open questions to resolve in Phase 2

- Exact projectile speed vs dodge-roll distance ratio (requires feel test).
- Mirror Thread clone interaction with Ult charge — does damage to the clone generate charge for Anansi? Current stance: **no**.
- Strider's Balance + Glyph of Haste pickup stacking rule (additive vs multiplicative).
- Visual: spider-themed symbolism via silhouette and VFX (not literal spider-legged) — see Risk R-06.
- Orochi's Wake (Susanoo ult) vs Anansi's 320 HP: with ADR-0009's 35/head (280 max), Anansi survives a full-channel sweep at 40 HP — verify this feels right in Phase 2 QA or revisit.

## Cultural source notes

Anansi tales are drawn from Akan-Ashanti tradition. Primary sources for research: R.S. Rattray's *Akan-Ashanti Folk-Tales* (1930) and Stephen Belcher's *African Myths of Origin* (2005). Visual and narrative design must treat him as the wily bargainer of Nyame-the-sky-god tales, not a Western "spider-villain" archetype. v1 depicts him as a human trickster figure with symbolic spider motifs in his VFX.

---

*Populated further by CB (T-100) in Phase 2.*
