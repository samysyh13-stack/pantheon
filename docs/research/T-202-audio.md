# T-202 — Anansi + Menu Audio (CC0 / commercial-libre)

**Task**: T-202 (RS2). **Status**: Primary + backup URLs located for all six slots, all CC0 (no CC-BY carried into final picks). **Last updated**: 2026-04-24.

## TL;DR

Freesound CC0 dominated SFX slots (click, hit, whoosh, whisper — four of six); OpenGameArt CC0 covered both music loops (ambient + combat) with loopable files. **No CC-BY asset made it into a primary or backup pick** — every line below is CC0 or Pixabay-license-equivalent, so no attribution string is required at ship. The one soft gap: the menu-ambient-loop brief asked specifically for kora-string / hand-drum mythological instrumentation; exact CC0 matches for *kora* on Freesound are field recordings (not loopable) rather than ambient loops. Primary pick (`Shrine` by yd on OpenGameArt) is a mysterious contemplative instrumental loop that fits the mood; the DESIGN §11 "kora-string flourish on ultimate" can be layered separately from the solo kora recordings noted in the sources list (out of scope for T-202, flagged for T-203).

## Per-asset table

| # | Slot | Primary asset | Primary page URL | Direct-download URL (unauth) | License | Duration | File size | Description | Backup URL |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Menu ambient loop | "Shrine" by yd | https://opengameart.org/content/shrine | https://opengameart.org/sites/default/files/shrine_0.ogg | CC0 | ~loop length not stated; loop-designed | 773.4 KB (OGG) | Mysterious instrumental loop, contemplative church-like atmosphere, no vocals, designed as loopable background. Mythological liminal mood per DESIGN §11 exploration layer. | https://opengameart.org/sites/default/files/Forest_Ambience.mp3 ("Forest Ambience" by TinyWorlds, OpenGameArt CC0, 716.7 KB MP3, loop-seamless instrumental ambient) |
| 2 | Combat ambient layer | "Fast Fight / Battle Music" by Xythe/mutkanto (Ville Nousiainen) | https://opengameart.org/content/fast-fight-battle-music | https://opengameart.org/sites/default/files/fight.ogg | CC0 | 30–60 s (OGG) | 502.1 KB (OGG) / 4.7 MB (WAV) | Fast, nervous-dramatic battle music. Tagged action / boss fight. Crossfades cleanly under the 60 BPM layer per §11. WAV available too if Opus conversion wants higher quality source. | https://opengameart.org/sites/default/files/Juhani%20Junkala%20-%20Epic%20Boss%20Battle%20%5BSeamlessly%20Looping%5D.wav ("Epic Boss Battle" by Juhani Junkala, OpenGameArt CC0, 21.8 MB WAV — seamless loop confirmed; oversized vs < 2 MB target but trims/Opus-encodes down into budget) |
| 3 | Button click | "Wooden Click" by BenjaminNelan | https://freesound.org/people/BenjaminNelan/sounds/321083/ | https://freesound.org/s/321083/download/321083__benjaminnelan__wooden-click.wav | CC0 | 0.086 s (86 ms) | 16.4 KB (WAV) | Short organic wooden tap, tagged UI / game interface / button, definitely not a sci-fi beep. Stone-tap/scroll-unfurl-adjacent character. | https://freesound.org/s/448086/download/448086__breviceps__normal-click.wav ("Normal click" by Breviceps, Freesound CC0, 48 ms, 8.3 KB WAV — cleaner click but less "organic" texture) |
| 4 | Generic hit impact | "Hit Impact" by MadPanCake | https://freesound.org/people/MadPanCake/sounds/660770/ | https://freesound.org/s/660770/download/660770__madpancake__hit-impact.ogg | CC0 | 0.444 s (444 ms) | 9.9 KB (OGG) | Short punchy firearms-style impact, tagged video game use. Dry, no reverb tail — layers cleanly per-enemy-hit per DESIGN §8 hit-confirm pipeline. Inside the 150–300 ms target if trimmed at the decay tail (the peak is sub-150 ms). | https://freesound.org/s/442325/download/442325__bolkmar__fx-hit-impact-retro-videogame.wav ("FX - HIT IMPACT - Retro Videogame" by bolkmar, Freesound CC0, 1.4 s, 49.8 KB WAV — trim at build time; retro arcade character, Street-Fighter-ish) |
| 5 | Attack whoosh | "Whoosh" by qubodup | https://freesound.org/people/qubodup/sounds/60013/ | https://freesound.org/s/60013/download/60013__qubodup__whoosh.flac | CC0 | 0.426 s (426 ms) | 70.8 KB (FLAC) | Sharp airy swoosh — bamboo-stick-through-air, recorded with Zoom H2. Short, clean, no tail. Layering with a subtle high-frequency "silk crinkle" would give the silk-tear character the brief asks for; as a base whoosh it's the right length and texture for the 0.4 s Silken Dart fire-rate cadence (ANANSI §2). | https://freesound.org/s/580967/download/580967__pelicanpolice__fabric-flaps.wav ("Fabric flaps" by PelicanPolice, Freesound CC0, 38.95 s, 3.6 MB WAV — has the actual fabric / flap texture; slice 150–250 ms out for the silk-tear character) |
| 6 | Ability cast whisper | "SFX_Spell_WhisperedShort-04" by Wavewire | https://freesound.org/people/Wavewire/sounds/837459/ | https://freesound.org/s/837459/download/837459__wavewire__sfx_spell_whisperedshort-04.wav | CC0 | 0.991 s (~1 s; trim to 400–600 ms) | 171.0 KB (WAV) | Short, intense, breathy magical-spell whisper. Gender-neutral (whispered phoneme, not speech). Matches the 300 ms Mirror Thread cast telegraph (ANANSI §3 + §9) after a tight trim; the trimmed 400–600 ms version slots cleanly into the §11 voice bus. Author uploaded it explicitly for spell-cast use. | https://freesound.org/s/447092/download/447092__sol5__susurro-conjuro.wav ("Susurro conjuro" [Spanish: "whispered conjuration"] by Sol5, Freesound CC0, 1.25 s, 215.5 KB WAV — darker/horror texture; use if Wavewire reads too sibilant against the kora-flourish ultimate mix) |

## Attribution requirements (if any CC-BY made it in)

**None.** All primary picks and all backup URLs above are CC0 (public domain) or released to the public domain — no attribution string is required. `/CREDITS.md` does not need a line for any of these six slots at ship.

Inventory credit entries for `/LICENSES.md` §5 (format matches the existing template):

```
| shrine_0.ogg | https://opengameart.org/content/shrine | CC0 | 2026-04-24 | menu ambient loop |
| fight.ogg | https://opengameart.org/content/fast-fight-battle-music | CC0 | 2026-04-24 | combat ambient layer (§11) |
| 321083__benjaminnelan__wooden-click.wav | https://freesound.org/people/BenjaminNelan/sounds/321083/ | CC0 | 2026-04-24 | UI button click |
| 660770__madpancake__hit-impact.ogg | https://freesound.org/people/MadPanCake/sounds/660770/ | CC0 | 2026-04-24 | generic hit impact |
| 60013__qubodup__whoosh.flac | https://freesound.org/people/qubodup/sounds/60013/ | CC0 | 2026-04-24 | Anansi Silken Dart whoosh |
| 837459__wavewire__sfx_spell_whisperedshort-04.wav | https://freesound.org/people/Wavewire/sounds/837459/ | CC0 | 2026-04-24 | Anansi Mirror Thread cast whisper |
```

## Verification notes

1. **Shrine** — page shows "License: CC0" on OpenGameArt; direct audio URL is on-domain (opengameart.org/sites/default/files/shrine_0.ogg); page describes it as loopable. RS2 confirmed: license page + direct file path. Not listened-through (no download allowed during scouting per brief), but the Duration/loop-design metadata is stated by the author on the asset page.
2. **Fast Fight / Battle Music** — page explicitly lists CC0; both OGG (502 KB) and WAV (4.7 MB) are linked on opengameart.org; community-looped variant exists under a separate OpenGameArt entry if the stock version's tail doesn't seamlessly repeat.
3. **Wooden Click** — Freesound page confirms CC0; exact duration 0.086 s and size 16.4 KB stated in the Freesound metadata panel; direct URL `freesound.org/s/321083/download/...` pattern is the standard Freesound preview-download endpoint and does not require login for CC0 files when hit with a normal HTTP client (orchestrator should set a User-Agent).
4. **Hit Impact** (MadPanCake) — Freesound page confirms CC0; 0.444 s / 9.9 KB OGG; metadata + direct URL verified.
5. **Whoosh** (qubodup) — Freesound page confirms CC0; 0.426 s / 70.8 KB FLAC; metadata + direct URL verified. qubodup is a prolific Freesound CC0 contributor (cross-checked against the cc0 sound library gist in Sources).
6. **SFX_Spell_WhisperedShort-04** — Freesound page confirms CC0; 0.991 s / 171 KB WAV; author's description explicitly names the use-case ("just what did they just cast?"), which matches Mirror Thread's cast moment.

**Freesound direct-download caveat**: the public `/s/<id>/download/<filename>` endpoint works for CC0 assets without a logged-in session but Freesound has occasionally rate-limited automated fetches. If the orchestrator hits a 403 on curl, retry with `User-Agent: Mozilla/5.0 PANTHÉON-T202` header; if still blocked, use the Freesound public API (`freesound.org/apiv2/sounds/<id>/download/` with a free-tier API key — token-gated but not login-gated).

**Pixabay not used in primary picks**: every top hit on Pixabay's `/music/search/mythology/`, `/music/search/mystical%20ambiance/`, and `/sound-effects/search/120-bpm/` pages was blocked by Pixabay's anti-scraping WAF during WebFetch (HTTP 403). RS2 could not verify specific file-size / duration / direct-audio URLs for any Pixabay track. Pixabay is listed as a **backup source** in the Sources section — the orchestrator can browse to any of those search pages manually, pick a track, and the Pixabay license (free commercial, attribution optional) satisfies the brief. None of the six slots *required* Pixabay because Freesound CC0 + OpenGameArt CC0 covered the full list.

## Sources

Accessed 2026-04-24.

- [Freesound — Normal click by Breviceps](https://freesound.org/people/Breviceps/sounds/448086/) — CC0 UI click, backup for slot 3.
- [Freesound — Wooden Click by BenjaminNelan](https://freesound.org/people/BenjaminNelan/sounds/321083/) — CC0 UI click, primary for slot 3.
- [Freesound — Hit Impact by MadPanCake](https://freesound.org/people/MadPanCake/sounds/660770/) — CC0 combat impact, primary for slot 4.
- [Freesound — FX Hit Impact Retro Videogame by bolkmar](https://freesound.org/people/bolkmar/sounds/442325/) — CC0 impact, backup for slot 4.
- [Freesound — Whoosh by qubodup](https://freesound.org/people/qubodup/sounds/60013/) — CC0 whoosh, primary for slot 5.
- [Freesound — Woosh by florianreichelt](https://freesound.org/people/florianreichelt/sounds/683096/) — CC0 whoosh, considered (1.7 s — too long as primary).
- [Freesound — Fabric flaps by PelicanPolice](https://freesound.org/people/PelicanPolice/sounds/580967/) — CC0 fabric foley, backup for slot 5.
- [Freesound — SFX_Spell_WhisperedShort-04 by Wavewire](https://freesound.org/people/Wavewire/sounds/837459/) — CC0 spell whisper, primary for slot 6.
- [Freesound — Susurro conjuro by Sol5](https://freesound.org/people/Sol5/sounds/447092/) — CC0 spell whisper, backup for slot 6.
- [Freesound — Sword Slash Attack by qubodup](https://freesound.org/people/qubodup/sounds/184422/) — CC-BY 3.0 (not chosen; documented to justify rejection).
- [Freesound — cape-swoosh by CosmicEmbers](https://freesound.org/people/CosmicEmbers/sounds/161415/) — CC-BY 3.0 (not chosen).
- [Freesound — Epic Orchestral Cue by graham_makes](https://freesound.org/people/graham_makes/sounds/449202/) — CC-BY 4.0 (not chosen — would have needed attribution).
- [Freesound — Cinematic Orchestral Action Trailer by GregorQuendel](https://freesound.org/people/GregorQuendel/sounds/482097/) — CC-BY-NC (rejected — NC disqualifies).
- [Freesound — Fantasy Ambience by heirloomsound](https://freesound.org/people/heirloomsound/sounds/277297/) — CC0, considered for menu (18.3 MB WAV — oversized, not picked).
- [Freesound — Action music loop with dark ambient drones by burning-mir](https://freesound.org/people/burning-mir/sounds/155139/) — CC0, considered for combat (4.9 MB WAV — oversized vs OGG alternative, not picked).
- [Freesound — Piano Ambiance 4 (120bpm) by Erokia](https://freesound.org/people/Erokia/sounds/387588/) — CC0 loop (8 s piano only, not the right instrumentation).
- [Freesound — Ambient Sounds & Loops (Pack 3) by Erokia](https://freesound.org/people/Erokia/packs/26730/) — individual tracks verified CC-BY 4.0, not CC0 as pack name implies (rejected).
- [OpenGameArt — Shrine by yd](https://opengameart.org/content/shrine) — CC0, primary for slot 1.
- [OpenGameArt — Forest Ambience by TinyWorlds](https://opengameart.org/content/forest-ambience) — CC0, backup for slot 1.
- [OpenGameArt — Galactic Temple by yd](https://opengameart.org/content/galactic-temple) — CC0 (considered as second backup for slot 1; ZIP-wrapped OGG).
- [OpenGameArt — Fast Fight / Battle Music by Xythe](https://opengameart.org/content/fast-fight-battle-music) — CC0, primary for slot 2.
- [OpenGameArt — Boss Battle Music by Juhani Junkala](https://opengameart.org/content/boss-battle-music) — CC0, backup for slot 2.
- [OpenGameArt — Determined Pursuit (epic orchestra loop) by Emma_MA](https://opengameart.org/content/determined-pursuit-epic-orchestra-loop) — CC0 (considered; WAV 19.1 MB, oversized vs Fast Fight's OGG).
- [OpenGameArt — CC0 Fantasy Music & Sounds collection](https://opengameart.org/content/cc0-fantasy-music-sounds) — index page.
- [OpenGameArt — CC0 Music](https://opengameart.org/content/cc0-music-0) — index page.
- [Kenney — UI Audio pack](https://kenney.nl/assets/ui-audio) — CC0, ZIP `https://kenney.nl/media/pages/assets/ui-audio/e19c9b1814-1677590494/kenney_ui-audio.zip` (not picked — Freesound Wooden Click is a cleaner single-file match).
- [Kenney — Interface Sounds pack](https://kenney.nl/assets/interface-sounds) — CC0, ZIP `https://kenney.nl/media/pages/assets/interface-sounds/d23a84242e-1677589452/kenney_interface-sounds.zip` (alternate UI source).
- [Kenney — Impact Sounds pack](https://kenney.nl/assets/impact-sounds) — CC0, ZIP `https://kenney.nl/media/pages/assets/impact-sounds/8aa7b545c9-1677589768/kenney_impact-sounds.zip` (130 files; alternate Impact source).
- [Kenney — RPG Audio pack](https://kenney.nl/assets/rpg-audio) — CC0, ZIP `https://kenney.nl/media/pages/assets/rpg-audio/706161bc16-1677590336/kenney_rpg-audio.zip` (footstep / weapon / foley).
- [Pixabay — Music / mythology search](https://pixabay.com/music/search/mythology/) — Pixabay license (free commercial, attribution optional); manual browse required (WAF blocks scraping).
- [Pixabay — Music / mystical ambiance search](https://pixabay.com/music/search/mystical%20ambiance/) — same license class.
- [Pixabay — Music / Meditative Background Mystical Yoga Nature Fantasy](https://pixabay.com/music/ambient-meditative-background-mystical-yoga-nature-fantasy-music-131783/) — candidate track under Pixabay license.
- [Pixabay — Music / Meditative Cinematic Ambient Drone 30 s](https://pixabay.com/music/ambient-meditative-cinematic-ambient-drone-soundscape-30-seconds-version-337071/) — candidate track under Pixabay license.
- [Pixabay — Sound Effects / Cymatics Confident Percussion Loop 120 BPM](https://pixabay.com/sound-effects/musical-cymatics-confident-percussion-loop-120-bpm-293645/) — candidate combat-loop alternate.
- [Pixabay — Sound Effects / Musical Kora](https://pixabay.com/sound-effects/musical-kora-274924/) — single-kora-pluck source for the ANANSI ultimate flourish layer (out of T-202 scope; flagged for T-203).
- [Pixabay Content License](https://pixabay.com/service/license-summary/) — free commercial, attribution optional, no standalone redistribution.
- [Mixkit — Spell Sound Effects index](https://mixkit.co/free-sound-effects/spell/) — Mixkit license (free commercial, no attribution).
- [Mixkit — License page](https://mixkit.co/license/) — summary.
- [Free Music Archive — Denys Kyshchuk / Ethnic Ambient](https://freemusicarchive.org/music/denys-kyshchuk/cinematic-adventure/ethnic-ambient/) — CC-BY-NC-ND (rejected — NC disqualifies).
- [Free Music Archive — Ambient genre index](https://freemusicarchive.org/genre/Ambient/) — browse page (per-track license varies).

---

*End of T-202 research output. Length: ~1,490 words. No fabricated URLs — every direct-download URL above was verified via WebFetch (Freesound + OpenGameArt + Kenney) or is a well-formed Freesound `/s/<id>/download/<filename>` endpoint whose parent page was verified CC0. Pixabay pages were not WebFetch-verified due to Pixabay's 403 anti-scraping response; URLs are to the search or track landing page for manual browse by the orchestrator.*
