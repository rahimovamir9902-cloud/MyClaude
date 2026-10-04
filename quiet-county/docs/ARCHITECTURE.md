# Quiet County — Architecture

## Principles

- **Data separated from code.** Everything a designer tunes lives in `src/config/` as
  typed data: items, weapons, infected archetypes, loot tables, player tuning, quality
  presets, touch layout, settings, crafting, camp facilities, levels, missions, dialogue.
- **Engine-independent core.** Gameplay rules in `src/systems/` and `src/world/Physics`
  / `NavGrid` have no three.js or DOM dependency, so they are unit-tested in Node.
- **Event-driven communication.** Systems publish typed events on one `EventBus`
  (`src/core/GameEvents.ts` lists every event). The mission system, HUD, audio and save
  system listen instead of holding references to each other.
- **Declarative scripting.** Missions and dialogue are data: `Condition`s
  (`systems/Conditions.ts`) decide *when*, `GameAction`s (`systems/Actions.ts`) decide
  *what*. One action handler in the session executes them.
- **Composition roots.** `game/Game.ts` owns application-lifetime services (renderer,
  audio, input, UI, saves). `game/GameSession.ts` builds and owns one mission attempt and
  wires its systems together. Nothing else creates systems.
- **Pools and budgets, not allocation.** Hot paths (raycasts, A*, effects, AI ticks) are
  allocation-free or pooled; expensive work is budgeted per frame.

## Module map (requested systems → code)

| System | Code | Notes |
|---|---|---|
| PlayerController | `entities/Player.ts` | movement, stance, vault, flashlight, vitals, equipped weapon, animation |
| WeaponSystem | `systems/WeaponLogic.ts` (state, spread, damage) + `game/CombatSystem.ts` (resolution) | firearms, melee, takedowns, throwables |
| InventorySystem | `systems/Inventory.ts` | slots, stacks, weapon instance state, serialization |
| HealthSystem | `systems/Vitals.ts` | `Health`, `Stamina`, `HealingQueue` |
| EnemyAI | `systems/ai/EnemyBrain.ts` (pure FSM) + `entities/Infected.ts` (senses, locomotion, body) | brain is unit-tested with synthetic senses |
| NPCSystem | `entities/Npc.ts` (`Npc`, `NpcManager`) | follow / wait / board, door use, relationship |
| MissionSystem | `systems/MissionSystem.ts` | objectives, events, extraction, completion/failure, stats, rewards |
| DialogueSystem | `systems/DialogueSystem.ts` | branching nodes, conditional choices, actions |
| LootSystem | `systems/LootSystem.ts` | seeded per-container rolls from location tables |
| CraftingSystem | `systems/Crafting.ts` + `config/crafting.ts` | rules and recipes (UI in Phase 4) |
| CampSystem | `systems/Camp.ts` + `config/camp.ts` | resources, facility upgrades, starting bonuses (hub in Phase 3) |
| SaveSystem | `systems/SaveSystem.ts` + `platform/Platform.ts` | versioned slots, backups, migrations, validation; Preferences on device |
| AudioSystem | `audio/AudioSystem.ts` | procedural synthesis, spatialization, ambience, alarms |
| UIManager | `game/Game.ts` (screen flow) + `ui/` (`Hud`, `Screens`, `Overlays`, `MapRenderer`) | DOM UI over the canvas |
| WorldManager | `world/LevelBuilder.ts` + `game/GameSession.ts` | builds levels from data; owns world objects, zones, interiors, lights |
| SpawnManager | `entities/EnemyManager.ts` | initial / group / night spawns, pooling, corpse cleanup, queries |
| Noise | `systems/NoiseSystem.ts` | radius + occlusion; drives AI hearing and HUD |
| Physics | `world/Physics.ts` | oriented boxes, grid broadphase, circle resolve, raycasts |
| Navigation | `world/NavGrid.ts` + `entities/Locomotion.ts` | baked grid, A*, string pulling, path budget, path following |
| Time & weather | `systems/TimeOfDay.ts`, `systems/Weather.ts` | sky keyframes, phases, rain |
| Rendering | `render/` | renderer + dynamic resolution, sky, materials, procedural textures, batching, effects |
| Input | `input/` | device-independent `InputState`; touch and keyboard/mouse writers |

## Frame flow

```
requestAnimationFrame
└─ Game.tick(dt)
   ├─ AutoPilot.update (debug builds only; writes InputState)
   ├─ global inputs (pause / bag / map)
   ├─ GameSession.update(dt)            (split in two substeps when dt > 1/30 s)
   │   ├─ camera look
   │   ├─ Player.update                 movement, stance, vitals, footsteps → NoiseSystem
   │   ├─ CombatSystem.update           fire / melee / takedown / throw / reload
   │   ├─ InteractionController.update  best target, prompt, hold-to-act → session handlers
   │   ├─ ZoneManager.update            zone:entered / zone:exited
   │   ├─ EnemyManager.update           per infected: senses → EnemyBrain → Locomotion → animation
   │   ├─ NpcManager.update, doors
   │   ├─ TimeOfDay, Weather, NoiseSystem decay
   │   ├─ MissionSystem.update          re-evaluates on dirty events or every 0.5 s
   │   ├─ alarms (repeated noise pulses)
   │   └─ presentation: camera, environment, vegetation LOD, effects, interiors, lights, audio
   ├─ RenderManager.render              dynamic resolution, stats
   └─ Hud.update, TouchControls.update  (read-only HudSnapshot)
InputState.endFrame()
```

Between substeps `InputState.consumeEdges()` clears one-shot presses so a tap never fires
twice on slow devices.

## Events

`EventBus<GameEvents>` is synchronous and isolates handler exceptions. Examples:

- `noise` → HUD minimap pings; AI hears through `NoiseSystem` listeners directly.
- `inventory:changed`, `flag:changed`, `zone:entered`, `npc:changed`, `enemy:killed` → `MissionSystem` marks itself dirty.
- `weapon:fired`, `container:searched`, `enemy:alerted`, `player:damaged` → mission stats.
- `player:damaged` → HUD damage flash and direction, camera shake, haptics.
- `mission:completed` → profile update, results screen; `player:died` → failure screen.
- `save:completed` → pause menu "last save" label.

## Content pipeline

1. **Level** (`config/levels/*.ts`, schema in `world/LevelTypes.ts`): ground patches,
   roads, buildings (walls with door / window / broken-window / gap openings, interior
   walls), doors (lock types: none, pry, barred, scripted), fences, vehicles, props
   (optionally with containers), pickups, notes, save points, zones, spawns (with groups
   and night spawns), NPCs, extraction, lights, decals, forests, grass, alarm sources.
2. **LevelBuilder** turns it into batched meshes (by layer: world, ground,
   `interior:<id>`, `roof:<id>`), colliders, a baked nav grid, interactables and zones.
3. **Mission** (`config/missions/*.ts`): objectives and events referencing level ids.
4. **Dialogue** (`config/dialogue/*.ts`).
5. **Validation**: `tests/content.test.ts` lints references (zones, items, doors, tables,
   spawn groups, flags that conditions wait on); `debug/LevelValidator.ts` flood-fills the
   nav grid to prove every objective, container, pickup, NPC and spawn is reachable (run
   by the E2E suite).

### Adding things

- **A weapon**: add a `WeaponDef` in `config/weapons.ts`, an item in `config/items.ts`, a
  model case in `entities/WeaponModels.ts`. Combat picks it up automatically.
- **An infected type**: add an `EnemyArchetype` in `config/enemies.ts` and reference it
  from level spawns.
- **A mission**: write a `LevelDef` and a `MissionDef`, add dialogue if needed, register
  them in `Game` (Phase 4 adds a mission registry and world map).
- **A sound**: add a recipe to `AudioSystem.play`.

## Rendering and performance

- One shared vertex-colored Lambert material per surface type; geometry UVs are in meters
  so texture density is consistent and batching works.
- Static batching per (layer, 48 m chunk, material); instanced vegetation with chunk LOD;
  interior groups culled by camera proximity; roofs hidden when inside.
- Characters are single skinned meshes (one draw call each) built from boxes with
  procedural animation; geometry shared per appearance.
- Light count is fixed per session (flicker changes intensity only) to avoid shader
  recompiles; point lights scale with the quality preset.
- Dynamic resolution in `RenderManager`; renderer stats and gameplay `simMs` exposed in
  the FPS overlay and debug API.

## Testing

- **Unit (vitest, 108 tests)**: core utilities, inventory, vitals, weapons, noise, loot,
  missions, dialogue, conditions, saves (round trip, backups, migrations, corruption),
  physics, navigation, AI brain (all transitions, stagger immunity, lunge), time of day,
  crafting, camp, and content lint.
- **End-to-end (Playwright, 16 tests)**: smoke, level reachability, render/CPU budgets,
  keyboard play, overlays, full mission playthrough by the QA autopilot, combat (pistol,
  melee, takedown, bottle lure, gunfire attraction), stealth, save/load, refused saves,
  death/retry, touch controls, on-screen layout and the controls editor.
- **Debug API** (`?debug=1`, `window.__QC`): snapshot, teleport, god mode, spawn, give,
  time, kill all, save, level issues, bot control, logs.
