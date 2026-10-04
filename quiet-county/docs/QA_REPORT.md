# Quiet County — QA Report (Phase 1 vertical slice)

## How to run

```bash
npm run check       # typecheck, unit tests, production build
npm run test:e2e    # Playwright: desktop + mobile projects (builds and serves the game)
```

The E2E tests drive the real game in Chromium with software WebGL (SwiftShader).
Assertions poll on game state instead of wall-clock time, because simulation time is
clamped per frame on slow renderers.

## Results

| Suite | Result |
|---|---|
| TypeScript (strict) | ✅ clean |
| Unit tests (vitest) | ✅ 108 / 108 |
| E2E tests (Playwright) | ✅ 16 / 16 (desktop 13, mobile 3) |
| Full mission playthrough (QA autopilot) | ✅ all primary + secondary objectives, extraction, results screen |
| Level reachability validator | ✅ 0 issues (all containers, pickups, notes, NPCs, spawns, save points, extraction reachable) |
| Capacitor | ✅ `cap add android` / `cap add ios` generate and sync with 3 plugins; orientation patch applied (no Gradle/Xcode build in this environment) |

### E2E coverage

- Boot → menu → briefing → mission; HUD and starting loadout; no console errors.
- Render budget at four locations: < 220 draw calls, < 160 k triangles; gameplay simulation < 6 ms/frame.
- Keyboard movement, crouch toggle, pause/resume.
- Inventory, map and note overlays; reading a note sets its story flag.
- **Playthrough**: knock on the cooler, dialogue, bandage Ines (she follows), staff door, office door (pry or already bashed open), take the case (siren + horde), unbar the back door, garage locker, fuel can, extraction with Ines → results; profile gains rewards and Ines; mission saves cleared.
- Combat: pistol kills and draws a distant infected; melee costs stamina and kills; rear takedown is instant; a thrown bottle lures an infected away.
- Stealth: crouched in tall grass at 9 m stays hidden; standing in the open at 6.5 m is spotted.
- Saves: manual save at the office radio restores position, inventory, flags, objectives and killed infected after a page reload; saving is refused while hunted; death → failure screen → retry from checkpoint.
- Mobile: joystick moves, drag looks, crouch button toggles, bag opens; every button fully on screen and clear of the minimap at 915×412; controls editor drag + save persists.

## Performance (measured)

Software-rendered FPS in this container is not representative of phones (no GPU), so
GPU-independent metrics are tracked:

| Metric | Value |
|---|---|
| Draw calls (typical views) | 120–131 |
| Triangles (typical views) | 33 k – 40 k |
| Static batching | 969 pieces → 89 meshes |
| Level build time | ~0.5 s (procedural textures + batching + nav bake) |
| Gameplay simulation, normal play | ~0.6–1.0 ms / frame (desktop CPU) |
| Gameplay simulation, stress (27 infected active, hordes + night spawns) | ~0.65–1.7 ms avg, 5–10 ms peaks during path-search bursts |
| Bundle | ~230 KB gzipped (three.js 124 KB + game 107 KB) |

Expect roughly 3–5× slower CPU on mid-range Android: simulation stays well inside a
33 ms (30 FPS) budget. Real-device profiling is scheduled for Phase 5.

## Bugs found during QA and fixed

| # | Issue | Root cause | Fix |
|---|---|---|---|
| 1 | Taps fired twice on slow frames (doors flapped open/shut, toggles cancelled out) | Button edges not cleared between simulation substeps | `InputState.consumeEdges()` between substeps (+ unit test) |
| 2 | Scene ~3× too dark | three.js physical light units (Lambert ÷ π) | Light scale for sun/hemisphere/point/spot/flash lights |
| 3 | Trees and wood nearly black | Dark textures multiplied by dark vertex tints | Neutral "mottle" texture for foliage; lighter wood/rust bases |
| 4 | Back door unreachable from inside the office | Desk + agent-radius inflation sealed the door | Moved the desk under the alarm panel (found by the QA bot) |
| 5 | Quest item hidden behind a container prompt | Equal prompt scoring | Quest pickups win ties |
| 6 | Melee stun-lock made fights trivial | Crowbar damage exceeded stagger threshold | Higher threshold + 1.6 s stagger immunity (+ tests) |
| 7 | Game too easy (reckless run lost 14 HP) | Running was free and far faster than infected | Close-range lunge, damage 16, larger siren horde; reckless run now ends near death |
| 8 | Infected overlapped the player's body | No character separation | Infected pushed out of the player, then out of walls |
| 9 | AI reacted one tick late to new states | New state did not act on entry tick | Immediate second FSM update on transition (+ tests) |
| 10 | Dead player's last known position kept pulling infected | Perception ignored player death | Calm-state perception ignores stimuli when the player is dead |
| 11 | Joystick magnitude wrong past the dead zone | Double scaling | Rescale magnitude, keep direction |
| 12 | Touch buttons clipped at screen edges / pause over minimap | Default layout | New default layout + E2E layout check |
| 13 | Briefing and inventory overflowed 412 px-tall phones | Single-column layouts | Landscape briefing grid; 6-column bag on short screens |
| 14 | Door interaction just out of reach from natural standing spots | 1.7 m radius vs wall thickness | 2.0 m door radius |
| 15 | Duplicate loot rows (guaranteed + rolled same item) | Separate stacks | Merge totals before splitting by stack size |

## Known limitations

- Not yet run on physical Android/iOS devices; no Gradle/Xcode builds in this environment (Capacitor project generation and sync verified).
- Audio is verified to run without errors in automated tests, not listened to by a human tester.
- The headless renderer cannot validate visual quality on real GPUs (shadows on High, anisotropy).
- Only the common infected appears in the slice (by design); other archetypes are data-ready.
- Dropped items are discarded (or stashed in a container) rather than placed on the ground.
- Moderate npm advisory in a dev-only dependency of the Capacitor CLI (iOS project tooling, `uuid` via `xcode`); not shipped in the app bundle.
