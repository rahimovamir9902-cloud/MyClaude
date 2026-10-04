# Quiet County — Game Design Document

Status legend: **[built]** playable in the current build · **[data]** defined in config, not yet placed in a level/UI · **[planned]** designed here, scheduled in [ROADMAP.md](ROADMAP.md).

## 1. Vision

A linear-mission, third-person survival-action game for phones. Each mission drops you
into a dangerous, hand-built location with a job to do, more things worth taking than you
can carry, and infected that hunt by **sound**. You choose how loud to be: sneak through
cover, take down a lone infected from behind, throw a bottle to pull a group away — or
fire a gun and deal with everything that heard it.

**Pillars**

1. **Noise is the core resource.** Every action has an audible radius, shown on the HUD minimap as a ring. Quiet is slow; loud is fast and costly.
2. **Scarcity forces choices.** Twelve bag slots, finite ammo, weapons that wear out, stamina that runs dry mid-fight.
3. **Places tell stories.** Notes, graffiti, abandoned belongings and the layout of each location explain what happened without cutscenes.
4. **Survivors matter.** People you save join the camp, change it, and come back in later missions.
5. **Built for thumbs.** Short missions (10–20 min), readable silhouettes, context-sensitive buttons, generous aim assist, auto-saves at checkpoints.

**Originality.** All characters, places, story, dialogue, weapon names, enemy designs,
UI, textures, models and audio are created for this project. No names, scenes, maps,
assets or distinctive designs from existing games or series are used. In the build,
geometry, textures and sound are generated procedurally at runtime.

## 2. World and story

**Setting.** Calder Valley, a rural county of farms, timber, one highway (Route 9) and
small towns. The infection ("the Hollowing") spread in under a week. The infected
("Hollows") lose most of their sight but hear extraordinarily well; they gather wherever
noise repeats — generators, alarms, gunfire.

**Premise.** Rowan Hale, a former power-line technician who knows every back road and
substation in the county, scavenges for **Harrow Mill**, an old grain mill turned
survivor camp. A mysterious radio broadcast hints at an evacuation at **Kestrel Point**.
The campaign follows Rowan from scavenging runs to restoring power, rescuing families, and
finally getting the camp to the evacuation zone.

### 2.1 Regions and locations (connected world map)

The world map is a node graph of regions linked by roads, trails and the river. Each
region holds several playable locations; missions start and end at extraction points that
connect to neighbouring regions, so the county reads as one place.

| Region | Playable locations | Connects to |
|---|---|---|
| **Ashby** (abandoned small town) | Main Street (pharmacy, hardware store, diner), Ashby Elementary, sheriff's substation, the water tower, Larch Court cul-de-sac | Route 9, Calder Flats |
| **Calder Flats** (rural farmland) | Okonjo farm (farmhouse, barn, root cellar, fields), grain co-op elevator, irrigation canal | Ashby, Harrow Mill, Pellham Woods |
| **Pellham Woods** (forest) | ranger station, Bluegill campground, logging road, Weller Creek bridge, Signal Ridge | Calder Flats, Route 9 north |
| **Route 9** (highway) | south pileup, north overpass, rest area, weigh station | Ashby, Calder Junction, Riverside |
| **Calder Junction** (gas station) **[built]** | fuel canopy, store (shop, office, walk-in cooler, storage), maintenance garage, farm field, Walt's hidden camp | Route 9 |
| **Riverside** (industrial district) | sawmill, rail yard, water treatment plant | Route 9, Brandt Freight |
| **Brandt Freight** (warehouse area) | loading dock, dispatch offices, cold storage, maintenance tunnels | Riverside |
| **St. Imelda County Hospital** (abandoned hospital) | emergency department, quarantine wing, pharmacy, generator plant, helipad | Ashby, Riverside |
| **Harrow Mill** (survivor settlement, hub) | mill yard, weigh room clinic, workshop, loft storage, quarters, watch platform | Calder Flats |
| **Kestrel Point** (final evacuation zone) | military checkpoint, ferry dock, airstrip | Pellham Woods, Riverside |

Every major location follows the level-design contract in §13 (main entrance,
alternatives, interiors and exteriors, loot, spawn zones, NPC zones, objectives, optional
areas, an extraction point and environmental storytelling).

### 2.2 Characters

**Protagonist — Rowan Hale (she/her).** 34, former Calder Valley Electric Co-op line
technician. Methodical, dry-humoured, protective of people who cannot protect themselves.
Knows how power, pumps and radios work — which drives missions like *No Lights* and
*Last Signal*. Attributes: health, stamina, hunger, carry capacity, weapon proficiency,
stealth, medical condition, noise level (§3).

**Survivors (NPC roster)**

| Name | Type | Personality / background | Skills | Missions |
|---|---|---|---|---|
| **Noor Haddad** | Medic | Calm under pressure; former ER nurse at St. Imelda. Runs the camp clinic. | Treatment, triage, crafting medicine | Briefs M01; key to the hospital arc |
| **Teo Brandt** | Mechanic / driver | Wry, loyal, hates waiting; his family owned Brandt Freight. | Vehicle repair, driving, extraction | Extraction driver; M04 |
| **Ines Barrow** **[built]** | Survivor → Scout | Refrigerated-rig driver trapped at Calder Junction; blunt, grateful, brave once her leg heals. | Route knowledge, scouting | Rescued in M01 |
| **Augusta "Gus" Teller** | Mission giver | Retired school principal who runs Harrow Mill with lists and patience. | Leadership, morale | Mission board |
| **Dell Ramsey** | Hunter | Quiet, territorial woodsman; trades venison for ammo. | Tracking, crossbow, traps | M05 |
| **Mae Okonjo** | Survivor | Farmer whose son is sick; stubborn about leaving her land. | Food production | M03 |
| **Silas Crane** | Trader | Travelling barterer with a pushcart and a story for everything. | Trading, rumours | Camp trading table |
| **Vic Dorn ("the Marshal")** | Hostile survivor | Leads the Tollmen, who "tax" travellers on Route 9 bridges. | Firearms, ambushes | M05 antagonist |
| **Walt Halvorsen** | (missing) | Mechanic who owned the Calder Junction garage; left notes and a camp. | — | M01 notes; reappears later |

Each NPC has: name, personality, background, dialogue, relationship (−100..100), health,
morale, skills, inventory and mission links. NPCs are not static markers: at camp they
follow daily schedules (work stations by day, fire pit at dusk, quarters at night), react
to events (low morale after a death, celebration after a big haul, fear during a camp
alert), and comment on what you bring back. **[built]** relationship, dialogue, follow /
wait / board behaviours, door opening, crouch mirroring. **[planned]** camp schedules,
morale, injuries, assignment to facilities.

## 3. Player

| Attribute | Range / rule | Status |
|---|---|---|
| Health | 100; bandages and medkits heal over time | [built] |
| Stamina | 100; sprint drains 15/s, melee 8–22 per swing; regen after 0.9 s; exhausted at 0 until 30 | [built] |
| Hunger | 100, drains slowly; low hunger caps stamina regen; food restores | [planned] (food items already restore stamina/health) |
| Inventory capacity | 12 slots, item stack sizes (weight tracked) | [built] |
| Weapon proficiency | per category, raises accuracy/reload/swing speed with use | [planned] |
| Stealth | visibility multiplier from stance, cover, light, speed | [built] |
| Medical condition | bleeding / sprain / infection status effects | [planned] |
| Noise level | radius of the last sound you made (HUD meter + minimap ring) | [built] |

**Movement**: walk, run, sprint, crouch, vault (fences, broken windows, barriers), enter
buildings, open/close doors, pry locked doors, unbar doors from inside, search containers,
interact. **[built]** Climbing (ladders, dumpsters to roofs) **[planned]**.

**Visibility model** (how far infected see you, multiplied): standing 1.0, crouched 0.55,
tall grass standing 0.75, tall grass crouched 0.30, sprinting ×1.35, night ×0.5,
flashlight at night up to ×1.5 — and a flashlight beam sweeping across an infected in the
dark alerts it directly.

**Mobile controls** **[built]**: floating joystick, camera drag (anywhere right of the
joystick, including while holding FIRE), aim, fire, reload, crouch, sprint, melee, use,
bag, map, weapon swap, throw, flashlight, pause. Customizable: drag-to-rearrange layout,
button size and opacity, left-handed mirror, look sensitivity per axis, invert Y,
hold/toggle aim and sprint, aim assist, vibration.

## 4. Combat

- **Melee** **[built]**: frontal arcs per weapon, stamina cost per swing, damage scales with remaining stamina (exhausted swings are weak), heavy hits stagger, durability wears on hit.
- **Firearms** **[built]**: camera-centred hitscan with spread (tighter when aiming/crouched, wider when moving), headshot multipliers, range falloff, recoil kick, limited ammo and reloads, durability, light touch aim assist. Shotgun pellets and automatic fire are supported by the weapon system **[data]**.
- **Throwables** **[built]**: bottles shatter on impact with an 18 m noise that infected investigate (not attributed to you). Rattle-can timed lure **[data]**.
- **Stealth takedowns** **[built]**: from behind an unaware infected (or one lying dormant): instant, near-silent kill.
- **Noise propagation** **[built]**: every sound has a radius; walls and closed doors cut it to 55%; rain masks footsteps. Gunshots (42–70 m) pull entire areas.
- **Hit reactions** **[built]**: flinches, staggers with knockback (and a stagger-immunity window so melee cannot stun-lock), player hit slowdown, camera shake, directional damage indicator, haptics.
- **Close-range danger** **[built]**: commons lunge when within 4 m, matching your run speed — breaking away costs sprint stamina.

## 5. Weapons (original designs)

All twelve are defined in `src/config/weapons.ts` **[data]**; the crowbar and compact
pistol are in the slice **[built]**.

| Weapon | Type | Dmg | Range m | Acc | Recoil° | Noise m | Durab. | Mag | Reload s | kg | Rate/s | Crit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rustline Crowbar | melee | 34 | 1.9 | – | – | 6 | 140 | – | – | 2.0 | 1.25 | 12% |
| Brushcutter Machete | melee | 42 | 1.8 | – | – | 4 | 70 | – | – | 1.2 | 1.5 | 20% |
| Taped Ash Bat | melee | 30 | 2.1 | – | – | 6 | 90 | – | – | 1.0 | 1.1 | 10% |
| Rebar-Wrapped Pipe | melee | 40 | 2.0 | – | – | 8 | 180 | – | – | 3.2 | 0.9 | 8% |
| Trail Knife | melee | 24 | 1.4 | – | – | 2 | 90 | – | – | 0.4 | 2.2 | 30% |
| Corvid C9 Compact | pistol | 34 | 40 | .80 | 2.5 | 42 | 400 | 12 | 1.6 | 0.9 | 3.5 | 8% |
| Bramble .44 | revolver | 75 | 50 | .84 | 7 | 55 | 500 | 6 | 2.8 | 1.6 | 1.4 | 12% |
| Fieldmaster 12 Pump | shotgun | 14×8 | 18 | .55 | 9 | 60 | 300 | 6 | 3.4 | 3.6 | 1.1 | 5% |
| Twin-Oak Coach Gun | shotgun | 15×9 | 16 | .50 | 11 | 62 | 260 | 2 | 2.4 | 3.2 | 3.0 | 5% |
| Larkspur Bolt-Action | rifle | 110 | 90 | .95 | 10 | 70 | 450 | 5 | 3.0 | 3.8 | 0.8 | 20% |
| Sentry SR-5 | semi-auto rifle | 48 | 70 | .86 | 4 | 65 | 600 | 20 | 2.6 | 3.4 | 5.0 | 10% |
| Leaf-Spring Crossbow | special | 90 | 45 | .90 | 1 | 5 | 120 | 1 | 2.2 | 2.6 | 0.5 | 25% |

Design notes: melee also has stamina cost (8–22) and swing arc (70–120°); firearms have
headshot multipliers (2–3×). The crossbow is the quiet ranged option; its bolts are
recoverable **[planned]**.

## 6. Infected

| Archetype | HP | Walk / chase m/s | Hit | Vision | Hearing | Signature |
|---|---|---|---|---|---|---|
| **Hollow** (common) **[built]** | 100 | 0.85 / 3.4 (lunge 4.4) | 16 | 17 m, 120° | 1.0× | Slow alone, deadly in groups; groans alert others within 13 m |
| **Runner** **[data]** | 65 | 1.3 / 5.6 | 10 | 20 m, 130° | 1.2× | Fresh and frantic; screams pull others from 20 m |
| **Brute** **[data]** | 380 | 0.75 / 2.6 | 32 | 14 m, 100° | 0.9× | Cannot be taken down; knockback; splinters doors fast |
| **Stalker** **[data]** | 85 | 1.1 / 4.2 | 18 | 22 m, 140° | 1.4× | Silent; circles to approach from behind |

**AI states [built]**: idle, wander (or patrol), investigate sound, detect (awareness
builds from partial glimpses), chase, attack (wind-up then strike), lose target, search,
return to patrol, stagger, dormant (lying still until woken), dead. **Group behaviour**:
an infected that starts hunting alerts nearby ones toward your last known position.

**Reacts to [built]**: gunshots, melee impacts, broken bottles, doors (opening and
bashing), player footsteps by gait and surface, flashlight beams at night, alarms and
other environmental sounds. Night makes them slightly faster.

## 7. Survivor NPC system

Types: medic, mechanic, scout, hunter, trader, survivor, hostile survivor, mission giver
(roster in §2.2). Runtime model per NPC: state machine (hiding, idle, following, waiting,
boarded **[built]**; working, resting, fleeing, fighting **[planned]**), relationship,
health, morale, skills, small inventory. Hostile survivors (the Tollmen) use the same
perception model as infected but fire weapons, take cover, and can be talked down
depending on reputation **[planned]**.

## 8. Survivor camp — Harrow Mill

Persistent hub between missions. Resources brought home (medicine, food, fuel,
materials, ammo, parts, survivors) fund facility upgrades. **[built]** resources persist in
the profile after every mission; facility logic and data are in place
(`systems/Camp.ts`, `config/camp.ts`) **[data]**; the walkable camp hub is **[planned]**.

| Facility | Levels | Effect |
|---|---|---|
| Medical Station | 2 | Start missions with a bandage, then a medkit |
| Workshop | 2 | Workbench recipes at camp; weapon repair between missions |
| Storage Loft | 2 | +8 / +16 stash slots |
| Weapon Rack | 1 | Start missions with extra 9 mm |
| Trading Table | 1 | Trades with travelling survivors |
| Mission Board | 1 | Lists missions and rumours |
| Survivor Quarters | 1 | Room for more rescued survivors |

## 9. Inventory **[built]**

Twelve slots; categories: weapons, ammunition, food, medicine, crafting materials, tools,
quest items. Stacks have per-item limits; weapons keep their own ammo and durability.
Quest items cannot be discarded. Containers show what they hold; you can take items, take
all, or leave items from your bag in a container to make room.

## 10. Crafting (original recipes) **[data]**

| Recipe | Inputs | Output | Where |
|---|---|---|---|
| Bandage | 2 cloth scraps | 1 bandage | anywhere |
| Improvised medkit | bandage + painkillers + duct tape | 1 medkit | anywhere |
| Rattle can (noise maker) | scrap metal + electrical parts + duct tape | 1 timed lure | anywhere |
| Hand-loaded 9mm | 2 gunpowder + scrap metal | 6 rounds | workbench |
| Repair kit | 2 scrap metal + duct tape | 1 kit | workbench |
| Rebuilt battery | 2 electrical parts | 1 flashlight battery | workbench |
| Field ration | canned beans + trail bar | 1 ration | anywhere |

Rules (`systems/Crafting.ts`, tested): inputs must be carried, workbench recipes need a
workbench (garage benches in the field, the camp workshop), and the result must fit.

## 11. Loot **[built]**

Containers: cars (glovebox, trunk, truck bed), cabinets, desks, filing cabinets,
medicine cabinets, lockers, crates, shelves, backpacks, dumpsters, footlockers (dead
drops). Each container rolls from a table chosen by location type
(`config/loot.ts`), seeded by world seed + container id — so loot is procedural but stable
across saves. Guaranteed items (quest hooks) merge with rolled items.

## 12. Environment and art direction

Post-industrial rural decay: faded siding, rusted corrugated metal, cracked asphalt with
oil stains, overgrown verges, abandoned vehicles with open doors, scattered suitcases,
spray-painted warnings, blood that has gone dark. Weather and light carry the mood:
amber dusk, cold moonlight, ground fog, rain, flickering emergency lights. The palette is
muted and desaturated so threats and interactables read clearly on small screens.

**[built]** All textures (asphalt, concrete, siding, brick, wood, rust, corrugated metal,
tile, grass, dirt, gravel, paint, glass, fabric, foliage) are painted procedurally on
canvases at load time; signs, graffiti and decals are generated from text. Characters are
procedural skinned meshes with procedural animation.

## 13. Level design contract

Every major location provides: a **safe route**, a **dangerous shortcut**, a **hidden
area**, and an **optional objective**, plus a main entrance and alternatives, interiors
and exteriors, loot, spawn zones, NPC zones, an extraction point and environmental
storytelling. Calder Junction **[built]** as the reference:

| Requirement | Calder Junction |
|---|---|
| Main entrance | Store front doors facing the pumps |
| Alternative routes | Broken south window (from the field), broken office window (from the back lot), barred back door (opens from inside), garage roll-up gap and side door, broken garage window |
| Safe route | Farm field with tall grass and a gate to the store's south side |
| Dangerous shortcut | Highway past the pileup, alarm car and wanderers |
| Hidden area | Walt's camp through a collapsed section of the back fence (stash + save point) |
| Optional objective | Search Walt's camp |
| Interiors | Shop floor, cooler, storage hall, office, garage |
| NPC zone | Ines in the walk-in cooler; Teo at extraction |
| Environmental storytelling | Receipt warning about car alarms, the clinic van and its log, the owner's generator diary, the mechanic's note, Walt's letter, "THEY HEAR YOU" graffiti, the body bag in storage |
| Extraction | Teo's truck at the north overpass, behind jersey barriers |

Backtracking: the barred back door and broken windows become shortcuts once opened or
known; the siren after taking the case turns the calm approach route into an escape.

## 14. Missions

### Mission framework **[built]**

Data-driven (`systems/MissionSystem.ts`): briefing, primary/secondary/optional objectives
with reveal/complete/fail conditions, scripted events (condition → actions such as spawn
group, alarm, radio, set flag, autosave), stealth and combat encounters authored through
spawn groups and alarms, NPC interactions through dialogue actions, extraction gated on
primaries, mission completion and failure, stats, and rewards that flow into the camp.

### M01 — The Silent Road **[built]**

Reach an abandoned roadside service station and recover the clinic's medical supplies.
Secondary: find fuel, rescue the stranded survivor, search the maintenance building.
The road is quiet; abandoned cars invite searching (one has a blinking alarm light — a
receipt under a wiper warned you). A car alarm or the office siren draws infected from
the woods; fight, hide in the grass or run. Inside the store a trapped trucker begs for
help. Extraction: Teo's truck at the north overpass.

### M02 — No Lights **[planned]**

Restore power to the Weller Creek pump-house safehouse. Explore dark outbuildings for
three electrical components (fuse block, relay, starter cable), avoid infected drawn to
anything that hums, then start the generator — which pulls a large horde. Hold out until
the floodlights come up, then return to the safehouse. Secondary: restore the radio mast;
rescue a hunter (Dell) trapped in a deer stand. Night-heavy; flashlight management.

### M03 — The Farm **[planned]**

Search the Okonjo farm for food and survivors. Farmhouse (two floors, family photographs
and a last diary), barn (hayloft, tractor), underground root cellar (dark, dormant
infected), cornfields (tall cover, poor sightlines both ways), damaged vehicles in the
yard. Mae Okonjo refuses to leave until you find her husband's fate; choices affect her
morale and whether she joins the camp.

### M04 — Dead Freight **[planned]**

Search the Brandt Freight warehouses for fuel and ammunition. Loading dock with trailers
to climb, dispatch offices, storage rooms, and an underground maintenance area; multiple
enemy routes (dock doors, office stairs, tunnels). Introduces the **Brute**. Teo's family
history surfaces in the offices.

### M05 — Last Signal **[planned]**

Reach the Signal Ridge communications tower and investigate a repeating transmission.
Forest traversal (Pellham Woods), the fenced tower compound held by the Tollmen (hostile
survivors), an infected attack triggered by the tower's generator, the transmission itself
(Kestrel Point evacuation coordinates), and a final extraction down the logging road
under pursuit.

## 15. Dynamic events **[planned]**

Rolled when entering a location and periodically during exploration, weighted by region,
time of day and progress: survivor distress signal, sudden infected swarm, vehicle alarm,
building collapse, radio transmission, hostile survivor encounter, loot opportunity (a
fresh supply crate), injured NPC, supply drop. The building blocks exist today (spawn
groups, alarms, radio messages, conditions/actions); events will be authored as data on
top of them.

## 16. Day / night **[built]**

A game hour lasts 150 seconds; missions start at a set hour (M01: 17:24, so night falls
mid-mission). Night reduces fog distance and lighting, makes infected faster and lets you
hide in darkness, but a flashlight makes you visible from much farther. Batteries drain
while the flashlight is on (resource consumption). Rain rolls in and out, masking
footsteps and reducing visibility.

## 17. Audio direction **[built]**

Every sound is synthesized: footsteps by surface (asphalt, gravel, grass, tile, metal),
wind with gusts, rain, crickets at night, distant groans and building creaks, metal
impacts, gunshot cracks with rolling tails, reload clicks, door creaks and bashing, radio
static, car alarms and sirens, infected groans/screams/snarls with per-infected pitch, a
heartbeat at low health and a low tension drone when you are hunted. All world sounds are
spatialized relative to the camera. Sound is gameplay: what you hear is what they hear.

## 18. UI **[built]**

HUD: health (with healing indicator), stamina (exhaustion tint), stance/cover/light/healing
chips, current weapon with ammo and durability, objective tracker, clock, rotating
minimap with objective markers, alert pings and your noise ring, noise meter, detection
eye (hidden / suspicious / hunted), interaction prompt with hold progress, world-space
objective marker with distance, crosshair with spread, hit markers, damage direction,
takedown hint. Screens: title, main menu with camp status, briefing, pause, settings,
controls editor, inventory, loot, dialogue, notes, map, results, death.

## 19. Mobile optimization

Targets: 60 FPS on high-end, 30–60 FPS on mid-range Android. Implemented techniques:

- **Batching**: static geometry merged per material per 48 m chunk (969 pieces → 89 meshes for Calder Junction; the whole level builds in ~0.5 s).
- **Instancing + LOD**: trees as chunked instanced meshes with detailed/low variants swapped by distance; grass chunks distance-culled.
- **Interior culling**: building interiors (and their extras) are hidden unless the camera is near or the player inside — a precomputed zone-based form of occlusion culling; roofs hide when inside.
- **Object pooling**: infected, tracers, puffs, decals.
- **Dynamic resolution**: pixel ratio adapts to frame time; quality presets (texture size, shadows, grass density, view distance, AI ranges, light budget).
- **Efficient AI**: distance-based think rates (every frame / 10 Hz / 2.5 Hz), per-frame A* budget, straight-line shortcut before A*, typed-array A* with no per-search allocation.
- **Lightweight physics**: oriented boxes on a uniform grid, allocation-free raycasts.
- **Fixed light count** (no shader recompiles), procedural textures sized per quality, CSS-only vignette/flash effects instead of post-processing.

Measured on the vertical slice: ~120–130 draw calls, ~35–40 k triangles, ~1 ms/frame
gameplay simulation on a desktop CPU with 27 infected active (see QA report). Planned:
asset/scene streaming between locations once there are multiple levels (the level
builder and session are already per-location).

## 20. Save system **[built]**

Automatic saves at mission start and checkpoints (never while hunted), manual saves at
safe locations (radios, camps) only when no infected are hunting you. Saved: mission
progress (objective states, fired events, stats), inventory with per-weapon state,
camp profile, NPC states, world state (flags, searched containers and their remaining
contents, door states, collected pickups, killed infected, read notes), time and weather.
Saves are versioned with migrations, validated on load, and keep a backup copy per slot.
