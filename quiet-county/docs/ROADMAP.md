# Quiet County — Roadmap

The game is built incrementally. Each phase ends with: test the build, fix critical
issues, optimize, verify mobile controls, verify save/load, verify mission completion,
and document what was implemented.

## Phase 1 — Playable prototype / vertical slice ✅ (this build)

| Requirement | Status |
|---|---|
| Original protagonist | ✅ Rowan Hale, procedural skinned model and animation |
| Abandoned rural location | ✅ Calder Junction service stop (highway, store, garage, field, hidden camp) |
| Third-person camera | ✅ shoulder orbit, wall collision, aim zoom, recoil, shake |
| Mobile touch controls | ✅ joystick, drag-look, context buttons, customizable layout |
| Walk / run / crouch | ✅ plus sprint and vault |
| One melee weapon | ✅ Rustline Crowbar |
| One firearm | ✅ Corvid C9 Compact |
| One infected type | ✅ Hollow (common) |
| Basic enemy AI | ✅ full state machine, hearing, vision, group alerts, door bashing |
| Health and stamina | ✅ with exhaustion and healing over time |
| Basic inventory | ✅ 12 slots, stacks, quest items |
| Loot containers | ✅ procedural, seeded, persistent |
| One complete mission | ✅ M01 The Silent Road, completable end to end (verified by the QA bot) |
| Mission objectives | ✅ primary, secondary, optional, extraction |
| Extraction point | ✅ Teo's truck |
| Basic save system | ✅ autosave + manual saves, versioned, migrations, backups |
| Mobile-optimized rendering | ✅ batching, instancing + LOD, interior culling, pooling, dynamic resolution, presets |

Extras delivered early: throwable distractions, rear takedowns, a survivor NPC with
branching dialogue who follows you, notes and environmental storytelling, day-to-night
cycle with flashlight and battery, rain, difficulty setting, minimap with noise ring,
QA autopilot and level validator.

## Phase 2 — Core loop depth (next)

- Hunger and medical conditions (bleeding, sprain) with matching items.
- Weapon proficiency progression.
- Inventory: drop to ground (world pickups at runtime), weight-based encumbrance option.
- AI: hostile-survivor brain on the shared perception model; infected feeding/idle animations; investigation of broken windows and open doors.
- Mission framework: timed objectives, escort objectives, fail conditions for NPC death.
- Accessibility: subtitle sizes, colour-blind safe markers, haptics intensity.

## Phase 3 — Variety and people

- Place the remaining weapons (all twelve are already defined) with models and audio.
- Runner, Brute and Stalker in levels (archetypes and AI already support them).
- Harrow Mill hub: walkable camp, NPC schedules, morale, facility upgrades (logic done in `systems/Camp.ts`), stash.
- Dialogue: relationship-gated choices, camp conversations, trading with Silas Crane.

## Phase 4 — World

- World map (region graph) with travel, supplies and time cost.
- Missions M02–M05 and their locations (designs in GAME_DESIGN.md §14).
- Dynamic events system on top of spawn groups, alarms and actions.
- Crafting UI (rules and recipes done in `systems/Crafting.ts`), workbenches in levels.
- Scene streaming between locations; save slots per campaign.

## Phase 5 — Optimization and polish

- Profiling on reference devices (low: 3 GB Android, mid: Snapdragon 7-series, high: recent iPhone / Snapdragon 8).
- Compressed texture pipeline (KTX2/Basis) when hand-made art replaces procedural textures; optional glTF character models.
- Occlusion portals for complex interiors; shadow cascades on high.
- Audio mix pass, music stingers, localisation.
- Store builds (Play Console, TestFlight), crash reporting, analytics opt-in.
