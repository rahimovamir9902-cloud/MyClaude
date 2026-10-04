import * as THREE from 'three';
import { getItem } from '../config/items';
import { PLAYER, STARTING_LOADOUT } from '../config/player';
import type { QualityPreset } from '../config/quality';
import { DIFFICULTY_DAMAGE, type GameSettings } from '../config/settings';
import type { AudioSystem } from '../audio/AudioSystem';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import type { EventBus } from '../core/EventBus';
import type { GameEvents, MissionSummary, ObjectiveStatus } from '../core/GameEvents';
import { createLogger } from '../core/Logger';
import { clamp01, dist2D } from '../core/math';
import { Random } from '../core/Random';
import { EnemyManager } from '../entities/EnemyManager';
import { PathService } from '../entities/Locomotion';
import { Npc, NpcManager } from '../entities/Npc';
import { Player } from '../entities/Player';
import type { InputState } from '../input/InputState';
import { Effects } from '../render/Effects';
import type { MaterialLibrary } from '../render/Materials';
import type { RenderManager } from '../render/RenderManager';
import type { GameAction } from '../systems/Actions';
import { DialogueRunner, type DialogueDef } from '../systems/DialogueSystem';
import { Inventory, type ItemStack } from '../systems/Inventory';
import { LootSystem } from '../systems/LootSystem';
import { MissionSystem, type MissionDef, type ObjectiveView } from '../systems/MissionSystem';
import { NoiseSystem } from '../systems/NoiseSystem';
import type { ProfileState, SaveData, SaveGame, SaveSystem } from '../systems/SaveSystem';
import { TimeOfDay, sampleSky } from '../systems/TimeOfDay';
import { Weather } from '../systems/Weather';
import { WorldState } from '../systems/WorldState';
import { LevelBuilder, type BuiltLevel } from '../world/LevelBuilder';
import type { LevelDef } from '../world/LevelTypes';
import { CF } from '../world/Physics';
import type { Door, ExtractionPoint, Interactable, LootContainer, NoteObject, Pickup, SavePoint } from '../world/WorldObjects';
import { inRect } from '../world/Zones';
import { CombatSystem } from './CombatSystem';
import { InteractionController, type InteractionHandler, type Prompt } from './InteractionController';

const log = createLogger('GameSession');

export interface SessionCallbacks {
  openLoot(container: LootContainer): void;
  openDialogue(runner: DialogueRunner, speaker: string): void;
  openNote(note: NoteObject): void;
  onMissionComplete(summary: MissionSummary): void;
  onPlayerDied(cause: string): void;
}

export interface SessionContext {
  bus: EventBus<GameEvents>;
  renderer: RenderManager;
  materials: MaterialLibrary;
  audio: AudioSystem;
  saves: SaveSystem;
  quality: QualityPreset;
  settings(): GameSettings;
  profile: ProfileState;
  dialogues: Record<string, DialogueDef>;
  callbacks: SessionCallbacks;
  haptic(strength: 'light' | 'medium' | 'heavy'): void;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  exhausted: boolean;
  healing: boolean;
  weaponName: string | null;
  firearm: boolean;
  ammo: number;
  magazine: number;
  reserve: number;
  durability: number;
  reload: number;
  noise: number;
  noiseRadius: number;
  awareness: number;
  hostile: number;
  prompt: (Prompt & { progress: number }) | null;
  takedown: boolean;
  crouched: boolean;
  sprinting: boolean;
  aiming: boolean;
  flashlightOn: boolean;
  battery: number;
  inGrass: boolean;
  objectives: ObjectiveView[];
  marker: { x: number; z: number; label: string; distance: number } | null;
  clock: string;
  phase: string;
  rain: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  camYaw: number;
  usingItem: { name: string; progress: number } | null;
  bottles: number;
  extraction: boolean;
}

interface ActiveAlarm {
  x: number;
  z: number;
  remaining: number;
  pulse: number;
  radius: number;
  light: THREE.Mesh | null;
}

/**
 * Everything that exists while a mission is being played: the built level, the player,
 * infected, NPCs, mission/time/weather/noise systems, combat and interactions. The Game
 * owns menus and the frame loop; the session owns the world.
 */
export class GameSession implements InteractionHandler {
  readonly level: BuiltLevel;
  readonly world: WorldState;
  readonly inventory: Inventory;
  readonly player: Player;
  readonly camera: ThirdPersonCamera;
  readonly enemies: EnemyManager;
  readonly npcs: NpcManager;
  readonly noise: NoiseSystem;
  readonly missions: MissionSystem;
  readonly time: TimeOfDay;
  readonly weather: Weather;
  readonly effects: Effects;
  readonly combat: CombatSystem;
  readonly interactions: InteractionController;
  readonly loot: LootSystem;
  readonly paths: PathService;
  readonly rng: Random;
  readonly root = new THREE.Group();
  private readonly alarms: ActiveAlarm[] = [];
  private readonly unsubs: (() => void)[] = [];
  private autosavePending: { label: string; waited: number } | null = null;
  private autosaveTimer = 0;
  private interiorTimer = 0;
  private clock = 0;
  private flickerSeed = 0;
  private deathTimer = -1;
  private completeTimer = -1;
  private completeSummary: MissionSummary | null = null;
  private lastNoiseRadius = 0;
  private heartbeatTimer = 0;
  godMode = false;
  playTime = 0;

  constructor(
    private readonly ctx: SessionContext,
    readonly mission: MissionDef,
    levelDef: LevelDef,
    save: SaveGame | null,
  ) {
    const bus = ctx.bus;
    this.rng = new Random(levelDef.seed ^ 0x5eed);
    const lightBudget = ctx.quality.id === 'low' ? 2 : ctx.quality.id === 'medium' ? 3 : 4;
    this.level = new LevelBuilder(ctx.materials, ctx.quality, bus).build({ ...levelDef, lights: levelDef.lights.slice(0, lightBudget) });
    this.root.name = 'session';
    this.root.add(this.level.root);
    this.world = new WorldState(bus);
    this.loot = new LootSystem(levelDef.seed);
    this.noise = new NoiseSystem(bus, {
      isOccluded: (ax, az, bx, bz) => !this.level.physics.lineClear(ax, 1.2, az, bx, 1.2, bz, CF.Sound),
    });
    this.inventory = new Inventory(PLAYER.inventorySlots, bus);
    const start = levelDef.playerStart;
    this.player = new Player(this.inventory, bus, start.x, start.z, start.yaw);
    this.player.rig.setShadows(ctx.quality.shadows);
    this.root.add(this.player.rig.root, this.player.flashlight, this.player.flashlight.target);
    this.camera = new ThirdPersonCamera(ctx.renderer.camera);
    this.camera.snapBehind(start.yaw);
    this.paths = new PathService(this.level.nav, ctx.quality.id === 'low' ? 2 : 3);
    this.time = new TimeOfDay(mission.startHour, 150, (phase, hour) => {
      bus.emit('time:phaseChanged', { phase, hour });
      this.world.setFlag(`phase:${phase}`);
      if (phase === 'night') this.enemies.spawnNight();
    });
    this.weather = new Weather(levelDef.seed);
    this.effects = new Effects(ctx.materials, ctx.quality.id !== 'low', ctx.quality.rainParticles);
    this.root.add(this.effects.root);

    this.enemies = new EnemyManager(
      this.level.physics, this.paths, bus, this.noise, this.player, ctx.quality, this.world, this.level.spawns,
      { isNight: () => this.time.isNight, darkness: () => this.time.darkness, damageScale: () => DIFFICULTY_DAMAGE[ctx.settings().difficulty] ?? 1 },
      {
        onVocal: (e, vocal) => {
          const pitch = 0.9 + ((e.id.charCodeAt(e.id.length - 1) % 7) / 20);
          if (vocal === 'alert') ctx.audio.play('alert', { x: e.x, z: e.z, pitch });
          else if (vocal === 'attack') ctx.audio.play('attack', { x: e.x, z: e.z, pitch });
          else if (vocal === 'search') ctx.audio.play('groan', { x: e.x, z: e.z, pitch: pitch * 1.1, volume: 0.6 });
          else if (vocal === 'groan') ctx.audio.play('groan', { x: e.x, z: e.z, pitch, volume: 0.8 });
        },
        onStrike: (e, hit) => {
          if (hit) {
            ctx.audio.play('hitFlesh', { x: this.player.x, z: this.player.z, pitch: 0.8 });
            ctx.audio.play('hurt', { pitch: 0.95 + Math.random() * 0.1 });
            this.camera.shake(0.45);
            ctx.haptic('heavy');
            this.effects.puff(new THREE.Vector3(this.player.x, 1.3, this.player.z), true, 3);
          } else ctx.audio.play('swing', { x: e.x, z: e.z, pitch: 0.7 });
        },
        onDoorBashed: (_e, door, opened) => {
          ctx.audio.play('doorBash', { x: door.x, z: door.z });
          if (opened) {
            ctx.audio.play('doorOpen', { x: door.x, z: door.z, pitch: 0.7 });
            this.world.doors.set(door.id, { open: true, locked: false });
          }
        },
      },
      ctx.quality.shadows,
    );
    this.root.add(this.enemies.root);

    this.npcs = new NpcManager(bus);
    for (const n of this.level.npcs) this.npcs.add(n);
    const driver = levelDef.extraction.driverNpc;
    if (driver) this.npcs.add(driver).enabled = false;
    this.root.add(this.npcs.root);

    this.missions = new MissionSystem(
      bus,
      {
        getFlag: (f) => this.world.getFlag(f),
        countItem: (i) => this.inventory.count(i),
        isInZone: (z) => this.level.zones.isInside(z),
        npcState: (n) => this.npcs.state(n),
      },
      (a) => this.runAction(a),
    );

    this.combat = new CombatSystem({
      player: this.player, enemies: this.enemies, physics: this.level.physics, camera: this.camera, effects: this.effects,
      audio: ctx.audio, noise: this.noise, bus, rng: this.rng.fork('combat'), scene: this.root,
      haptic: (s) => ctx.haptic(s), aimAssist: () => ctx.settings().aimAssist,
    });
    this.interactions = new InteractionController(this.level, () => this.npcs.npcs.values(), bus, this);

    this.subscribe();
    if (save) this.restore(save);
    else this.newGame();
    this.enemies.spawnInitial();
    this.level.zones.update(this.player.x, this.player.z);
    this.missions.start(mission, save?.data.mission ?? undefined);
    if (!save) this.requestAutosave('Mission start');
    log.info(`Session ready: ${mission.id} (${this.enemies.enemies.length} infected)`);
  }

  // ---- setup ---------------------------------------------------------------------------

  private newGame(): void {
    for (const s of STARTING_LOADOUT) this.inventory.add(s.itemId, s.quantity, { ammo: s.ammo }, 'start');
    const melee = this.inventory.findSlot('w_crowbar');
    if (melee >= 0) this.player.equip(melee);
  }

  private restore(save: SaveGame): void {
    const d = save.data;
    this.world.load(d.world);
    for (const c of this.level.containers.values()) {
      const s = this.world.containers.get(c.id);
      if (s) {
        c.searched = s.searched;
        c.contents = s.contents.map((x) => ({ ...x }));
      }
    }
    for (const door of this.level.doors.values()) {
      const s = this.world.doors.get(door.id);
      if (s) {
        door.locked = s.locked;
        door.setOpen(s.open, door.x - door.insideX, door.z - door.insideZ, true);
      }
    }
    for (const id of this.world.collected) this.level.pickups.get(id)?.collect();
    this.player.restore(d.player);
    this.npcs.restore(d.npcs);
    this.time.set(d.time.hour, d.time.day);
    this.weather.rain = d.weather.rain;
    this.camera.snapBehind(d.player.yaw);
    this.applyFlagUnlocks();
  }

  private subscribe(): void {
    const bus = this.ctx.bus;
    const audio = this.ctx.audio;
    this.unsubs.push(
      bus.on('player:footstep', (e) => {
        const vol = e.gait === 'crouch' ? 0.35 : e.gait === 'walk' ? 0.6 : e.gait === 'run' ? 0.85 : 1;
        audio.play('footstep', { variant: e.surface, volume: vol, pitch: 0.9 + Math.random() * 0.2 });
      }),
      bus.on('player:vaulted', () => audio.play('vault')),
      bus.on('weapon:reloaded', () => audio.play('reloadDone')),
      bus.on('player:damaged', () => {
        this.camera.shake(0.35);
      }),
      bus.on('player:died', (e) => {
        audio.play('death');
        this.missions.fail('player_dead');
        this.deathTimer = 2.6;
        log.info(`Player died: ${e.cause}`);
      }),
      bus.on('mission:objectiveChanged', (e) => {
        if (e.status === 'completed' && this.missions.state === 'active') audio.play('objective');
      }),
      bus.on('mission:completed', (e) => {
        this.completeSummary = e.summary;
        this.completeTimer = 2.2;
        audio.play('engine');
      }),
      bus.on('inventory:changed', () => this.player.syncEquipped()),
      bus.on('item:used', (e) => audio.play(getItem(e.itemId).category === 'food' ? 'eat' : 'heal')),
      bus.on('flag:changed', () => this.applyFlagUnlocks()),
      bus.on('door:changed', (e) => {
        const d = this.level.doors.get(e.id);
        if (d) this.world.doors.set(d.id, { open: d.open, locked: d.locked });
      }),
    );
  }

  /** Doors tied to a flag (e.g. the cooler Ines barricaded) open once the flag is set. */
  private applyFlagUnlocks(): void {
    for (const d of this.level.doors.values()) {
      if (d.locked && d.def.unlockFlag && this.world.getFlag(d.def.unlockFlag)) {
        d.locked = false;
        d.setOpen(true, d.x + d.insideX, d.z + d.insideZ);
        this.world.doors.set(d.id, { open: true, locked: false });
        this.ctx.audio.play('doorOpen', { x: d.x, z: d.z });
        const npc = d.def.talkNpc ? this.npcs.get(d.def.talkNpc) : undefined;
        if (npc && npc.state === 'hiding') npc.command('stay');
      }
    }
  }

  // ---- frame update --------------------------------------------------------------------

  update(dt: number, input: InputState): void {
    this.clock += dt;
    this.playTime += dt;
    const settings = this.ctx.settings();
    const sens = 0.0042;
    this.camera.look(input.lookX * sens * settings.lookSensitivityX, input.lookY * sens * settings.lookSensitivityY * (settings.invertY ? -1 : 1));

    // QA god mode only protects health so stamina/combat behave normally in tests.
    if (this.godMode) this.player.health.set(this.player.health.max);
    this.player.update(dt, input, this.camera.yaw, this.camera.pitch, this.playerWorld(), settings);
    this.combat.update(dt, input);
    this.interactions.update(dt, input, this.player);
    this.level.zones.update(this.player.x, this.player.z);

    this.enemies.aimYaw = this.camera.yaw;
    this.enemies.update(dt);
    this.npcs.update(dt, this.player, { physics: this.level.physics, paths: this.paths }, this.level.doors);
    for (const d of this.level.doors.values()) d.update(dt);

    this.time.update(dt);
    this.weather.update(dt, this.time.darkness);
    this.noise.masking = this.weather.footstepMasking;
    this.noise.update(dt);
    this.missions.update(dt);
    this.updateAlarms(dt);

    this.updatePresentation(dt);
    this.updateAutosave(dt);

    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.ctx.callbacks.onPlayerDied('infected');
    }
    if (this.completeTimer > 0) {
      this.completeTimer -= dt;
      if (this.completeTimer <= 0 && this.completeSummary) this.ctx.callbacks.onMissionComplete(this.completeSummary);
    }
  }

  /** While a menu is open: keep the world frozen but the camera, sky and audio alive. */
  updateFrozen(dt: number): void {
    this.updatePresentation(dt, true);
  }

  private playerWorld() {
    return {
      physics: this.level.physics,
      bus: this.ctx.bus,
      noise: this.noise,
      zones: this.level.zones,
      surfaceAt: (x: number, z: number) => this.level.surfaceAt(x, z),
      darkness: this.time.darkness,
    };
  }

  private updatePresentation(dt: number, frozen = false): void {
    const p = this.player;
    this.camera.update(dt, { x: p.x, y: p.y, z: p.z, crouched: p.crouched, aiming: p.aiming, alive: p.alive }, this.level.physics);
    // Hide the protagonist when the camera is squeezed against them in tight rooms.
    p.rig.root.visible = this.camera.actualDistance > 0.75 || !p.alive;
    const sample = sampleSky(this.time.hour);
    this.ctx.renderer.applyEnvironment(sample, p.x, p.z, this.weather);
    this.level.vegetation.update(this.ctx.renderer.camera.position.x, this.ctx.renderer.camera.position.z, frozen ? 0 : dt);
    this.effects.update(dt, this.ctx.renderer.camera, this.weather.rain, this.clock);

    // Interior culling + roof hiding.
    this.interiorTimer -= dt;
    if (this.interiorTimer <= 0) {
      this.interiorTimer = 0.15;
      const cam = this.ctx.renderer.camera.position;
      for (const g of this.level.interiors) {
        const inside = inRect(g.rect, p.x, p.z);
        const near = inRect({ x0: g.rect.x0 - 16, z0: g.rect.z0 - 16, x1: g.rect.x1 + 16, z1: g.rect.z1 + 16 }, cam.x, cam.z);
        g.roof.forEach((o) => (o.visible = !inside));
        g.interior.forEach((o) => (o.visible = inside || near));
      }
    }
    // Flickering lights (intensity only, never visibility, to avoid shader recompiles).
    this.flickerSeed += dt;
    for (const l of this.level.lights) {
      if (!l.def.flicker) continue;
      const n = Math.sin(this.flickerSeed * 23.1 + l.def.x) * Math.sin(this.flickerSeed * 7.3 + l.def.z);
      const drop = Math.sin(this.flickerSeed * 1.7 + l.def.x * 3) > 0.93 ? 0.1 : 1;
      l.light.intensity = l.base * (0.75 + 0.25 * n) * drop;
    }
    // Extraction beacon pulses once unlocked.
    const ex = this.level.extraction;
    ex.beacon.visible = this.missions.isExtractionUnlocked();
    if (ex.beacon.visible) ((ex.beacon as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.08 * Math.sin(this.clock * 2.5);

    const cam = this.ctx.renderer.camera;
    this.ctx.audio.setListener(cam.position.x, cam.position.z, this.camera.yaw);
    const threat = this.enemies.threat(p.x, p.z, 25);
    this.ctx.audio.update(dt, { darkness: this.time.darkness, rain: this.weather.rain, tension: threat.hostile > 0 ? 1 : threat.awareness * 0.5, time: this.clock });
    if (!frozen && p.alive && p.health.fraction < 0.3) {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.heartbeatTimer = 0.9;
        this.ctx.audio.play('heartbeat', { volume: 1 - p.health.fraction * 2 });
      }
    }
  }

  // ---- alarms ----------------------------------------------------------------------------

  private startAlarm(kind: 'car' | 'siren', x: number, z: number, seconds: number, light: THREE.Mesh | null = null): void {
    this.alarms.push({ x, z, remaining: seconds, pulse: 0, radius: kind === 'car' ? 55 : 65, light });
    this.ctx.audio.startAlarm(kind, x, z, seconds);
    this.ctx.bus.emit('message', { text: kind === 'car' ? 'A car alarm is blaring!' : 'An alarm siren is wailing!', kind: 'danger', duration: 3 });
  }

  private updateAlarms(dt: number): void {
    for (let i = this.alarms.length - 1; i >= 0; i--) {
      const a = this.alarms[i];
      a.remaining -= dt;
      a.pulse -= dt;
      if (a.pulse <= 0) {
        a.pulse = 1.5;
        // Repeated pulses so infected spawned mid-alarm still hear it.
        this.noise.emit({ kind: 'alarm', x: a.x, z: a.z, radius: a.radius, fromPlayer: false, priority: 7, sourceId: 'alarm' });
      }
      if (a.light) a.light.visible = Math.floor(this.clock * 4) % 2 === 0;
      if (a.remaining <= 0) {
        if (a.light) a.light.visible = false;
        this.alarms.splice(i, 1);
      }
    }
    // Idle alarm LEDs blink slowly as a warning.
    for (const av of this.level.alarmVehicles) {
      const c = this.level.containers.get(av.containerId);
      if (c && !c.searched) av.light.visible = Math.floor(this.clock * 1.2) % 2 === 0;
    }
  }

  // ---- actions (missions, dialogue) -------------------------------------------------------

  runAction(a: GameAction): void {
    const bus = this.ctx.bus;
    switch (a.type) {
      case 'setFlag':
        this.world.setFlag(a.flag, a.value ?? 1);
        break;
      case 'message':
        bus.emit('message', { text: a.text, kind: a.kind ?? 'info', duration: a.duration });
        break;
      case 'radio':
        bus.emit('message', { text: `${a.speaker}: "${a.text}"`, kind: 'radio', duration: 6 });
        this.ctx.audio.play('radio');
        break;
      case 'spawnGroup':
        this.enemies.spawnGroup(a.groupId);
        break;
      case 'noise':
        this.noise.emit({ kind: a.kind, x: a.x, z: a.z, radius: a.radius, fromPlayer: false, priority: 6 });
        break;
      case 'revealObjective':
        this.missions.revealObjective(a.objectiveId);
        break;
      case 'autosave':
        this.requestAutosave('Checkpoint');
        break;
      case 'giveItem': {
        const left = this.inventory.add(a.itemId, a.quantity, {}, 'dialogue');
        if (left > 0) bus.emit('message', { text: 'Your bag is full.', kind: 'warning' });
        break;
      }
      case 'takeItem':
        this.inventory.remove(a.itemId, a.quantity, 'given');
        break;
      case 'npc':
        this.npcs.get(a.npcId)?.command(a.command);
        break;
      case 'relationship': {
        const n = this.npcs.get(a.npcId);
        if (n) n.relationship += a.delta;
        break;
      }
      case 'sound':
        this.ctx.audio.play(a.sound as never, { x: a.x, z: a.z });
        break;
      case 'alarm': {
        const src = this.level.def.alarmSources?.[a.sourceId];
        if (src) this.startAlarm(src.kind, src.x, src.z, a.seconds);
        else log.warn(`Unknown alarm source ${a.sourceId}`);
        break;
      }
    }
  }

  // ---- InteractionHandler -----------------------------------------------------------------

  flag(name: string): number {
    return this.world.getFlag(name);
  }

  extractionUnlocked(): boolean {
    return this.missions.isExtractionUnlocked();
  }

  onHoldStarted(target: Interactable | 'vault', prompt: Prompt): void {
    if (target === 'vault') return;
    if (target.kind === 'container') {
      this.ctx.audio.play('search', { x: target.x, z: target.z });
      this.noise.emit({ kind: 'interaction', x: target.x, z: target.z, radius: 3, fromPlayer: true, priority: 2 });
    } else if (target.kind === 'door' && prompt.verb === 'PRY') {
      this.ctx.audio.play('pry', { x: target.x, z: target.z });
    }
  }

  searchContainer(c: LootContainer): void {
    if (!c.searched) {
      c.contents = this.loot.rollContainer(c.id, c.spec.tableId, c.spec.guaranteed);
      c.searched = true;
      this.syncContainer(c);
      if (c.spec.setsFlag) this.world.setFlag(c.spec.setsFlag);
      this.ctx.bus.emit('container:searched', { id: c.id, tableId: c.spec.tableId });
      if (c.spec.alarm) {
        const av = this.level.alarmVehicles.find((v) => v.containerId === c.id);
        this.startAlarm('car', av?.x ?? c.x, av?.z ?? c.z, 14, av?.light ?? null);
      }
    }
    this.ctx.audio.play('uiOpen');
    this.ctx.callbacks.openLoot(c);
  }

  /** Moves items from a container into the bag. index = -1 takes everything that fits. */
  takeFromContainer(c: LootContainer, index: number): { taken: number; full: boolean } {
    let taken = 0;
    let full = false;
    const indices = index >= 0 ? [index] : c.contents.map((_, i) => i);
    const remaining: ItemStack[] = [];
    c.contents.forEach((stack, i) => {
      if (!indices.includes(i)) {
        remaining.push(stack);
        return;
      }
      const left = this.inventory.addStack(stack, 'loot');
      taken += stack.quantity - left;
      if (left > 0) {
        full = true;
        remaining.push({ ...stack, quantity: left });
      }
    });
    c.contents = remaining;
    this.syncContainer(c);
    if (taken > 0) this.ctx.audio.play('pickup');
    if (full) this.ctx.bus.emit('message', { text: 'Your bag is full. Drop something to make room.', kind: 'warning' });
    return { taken, full };
  }

  /** Drops an inventory slot into a container (used from the loot screen). */
  stashInContainer(c: LootContainer, slot: number): boolean {
    if (!this.inventory.canDrop(slot)) return false;
    const stack = this.inventory.takeFromSlot(slot, undefined, 'stashed');
    if (!stack) return false;
    c.contents.push(stack);
    this.syncContainer(c);
    return true;
  }

  private syncContainer(c: LootContainer): void {
    this.world.containers.set(c.id, { searched: c.searched, contents: c.contents.map((s) => ({ ...s })) });
  }

  useDoor(d: Door): void {
    const p = this.player;
    if (d.locked) {
      if (d.def.lock === 'pry') {
        this.noise.emit({ kind: 'impact', x: d.x, z: d.z, radius: 13, fromPlayer: true, priority: 5 });
        this.ctx.audio.play('hitMetal', { x: d.x, z: d.z });
        const bar = this.inventory.findSlot('w_crowbar');
        const stack = bar >= 0 ? this.inventory.getSlot(bar) : null;
        if (stack && stack.durability !== undefined) stack.durability = Math.max(0, stack.durability - 3);
        this.ctx.bus.emit('message', { text: 'The lock gives way with a crack.', kind: 'info', duration: 2 });
      }
      d.locked = false;
    }
    const opening = !d.open;
    d.setOpen(opening, p.x, p.z);
    this.ctx.audio.play('doorOpen', { x: d.x, z: d.z, pitch: opening ? 1 : 1.2 });
    this.noise.emit({ kind: 'door', x: d.x, z: d.z, radius: p.crouched ? 2.5 : 5, fromPlayer: true, priority: 3 });
    this.world.doors.set(d.id, { open: d.open, locked: d.locked });
    this.ctx.bus.emit('door:changed', { id: d.id, open: d.open, byEnemy: false });
  }

  talkThroughDoor(d: Door): void {
    const npc = d.def.talkNpc ? this.npcs.get(d.def.talkNpc) : undefined;
    if (npc) this.talkTo(npc);
  }

  collectPickup(pk: Pickup): void {
    const def = getItem(pk.def.itemId);
    const left = this.inventory.add(pk.def.itemId, pk.def.quantity, { ammo: pk.def.ammo }, 'pickup');
    if (left >= pk.def.quantity) {
      this.ctx.bus.emit('message', { text: `No room for ${def.name}. Drop something first.`, kind: 'warning' });
      return;
    }
    pk.collect();
    this.world.collected.add(pk.id);
    this.ctx.audio.play('pickup');
    this.ctx.bus.emit('message', { text: `Picked up ${def.name}`, kind: 'loot', duration: 2.5 });
    this.ctx.bus.emit('pickup:collected', { id: pk.id, itemId: def.id });
  }

  readNote(n: NoteObject): void {
    this.world.readNotes.add(n.id);
    this.world.setFlag(`note:${n.id}`);
    this.ctx.bus.emit('note:read', { id: n.id });
    this.ctx.audio.play('uiOpen');
    this.ctx.callbacks.openNote(n);
  }

  useSavePoint(s: SavePoint): void {
    const threat = this.enemies.threat(this.player.x, this.player.z, 20);
    if (threat.hostile > 0) {
      this.ctx.bus.emit('message', { text: 'You cannot rest while infected are hunting you.', kind: 'warning' });
      return;
    }
    void this.save('manual', s.def.label).then((ok) => {
      if (ok) {
        this.ctx.audio.play('save');
        this.ctx.bus.emit('message', { text: `Game saved - ${s.def.label}`, kind: 'info' });
      }
    });
  }

  talkTo(npc: Npc): void {
    const def = this.ctx.dialogues[npc.def.dialogueId];
    if (!def) {
      log.warn(`No dialogue ${npc.def.dialogueId}`);
      return;
    }
    const runner = new DialogueRunner(def, this.missions.conditionContext, (a) => this.runAction(a));
    if (!runner.start()) return;
    this.ctx.bus.emit('dialogue:started', { dialogueId: def.id, npcId: npc.id });
    this.ctx.callbacks.openDialogue(runner, npc.name);
  }

  extract(_e: ExtractionPoint): void {
    if (!this.missions.isExtractionUnlocked()) {
      const teo = this.npcs.get('teo');
      if (teo) this.talkTo(teo);
      return;
    }
    const ines = this.npcs.get('ines');
    if (ines && ines.state === 'following' && dist2D(ines.x, ines.z, this.player.x, this.player.z) < 16) {
      this.world.setFlag('ines_rescued');
      ines.command('board');
    } else if (ines && (ines.state === 'following' || ines.state === 'waiting') && ines.treated) {
      this.ctx.bus.emit('message', { text: 'Ines is not with you. Teo will not wait.', kind: 'warning' });
    }
    this.world.setFlag('extracted');
    this.missions.evaluate();
  }

  // ---- saving -------------------------------------------------------------------------------

  requestAutosave(label: string): void {
    this.autosavePending = { label, waited: 0 };
    this.autosaveTimer = 0;
  }

  private updateAutosave(dt: number): void {
    if (!this.autosavePending || !this.player.alive || this.missions.state !== 'active') return;
    this.autosaveTimer -= dt;
    this.autosavePending.waited += dt;
    if (this.autosaveTimer > 0) return;
    this.autosaveTimer = 1;
    // Never checkpoint mid-fight (it could save the player into a death loop).
    const threat = this.enemies.threat(this.player.x, this.player.z, 15);
    if (threat.hostile > 0 && this.autosavePending.waited < 30) return;
    const label = this.autosavePending.label;
    this.autosavePending = null;
    if (threat.hostile > 0) return;
    void this.save('auto', label);
  }

  serialize(): SaveData {
    return {
      levelId: this.level.def.id,
      profile: { ...this.ctx.profile, playTimeSeconds: this.ctx.profile.playTimeSeconds + this.playTime },
      mission: this.missions.serialize(),
      player: this.player.serialize(),
      world: this.world.serialize(),
      npcs: this.npcs.serialize(),
      time: { hour: this.time.hour, day: this.time.day },
      weather: { rain: this.weather.rain },
    };
  }

  async save(slot: 'auto' | 'manual', label: string): Promise<boolean> {
    return this.ctx.saves.save(slot, this.serialize(), `${this.mission.title} - ${label}`);
  }

  // ---- HUD -----------------------------------------------------------------------------------

  hud(): HudSnapshot {
    const p = this.player;
    const w = p.weapon;
    const threat = this.enemies.threat(p.x, p.z, 30);
    const objectives = this.missions.objectives().filter((o) => o.status !== 'hidden');
    const tracked =
      objectives.find((o) => o.status === 'active' && o.kind === 'extraction') ??
      objectives.find((o) => o.status === 'active' && o.kind === 'primary') ??
      objectives.find((o) => o.status === 'active' && !!o.marker);
    const ic = this.interactions.current;
    const noiseRadius = this.noise.playerNoiseLevel * 40;
    this.lastNoiseRadius = noiseRadius;
    const useId = p.useItemId;
    return {
      health: p.health.current,
      maxHealth: p.health.max,
      stamina: p.stamina.current,
      maxStamina: p.stamina.max,
      exhausted: p.stamina.exhausted,
      healing: p.healing.active,
      weaponName: w ? w.def.name : null,
      firearm: !!w?.isFirearm,
      ammo: w?.ammo ?? 0,
      magazine: w?.def.magazine ?? 0,
      reserve: w ? w.reserveAmmo(this.inventory) : 0,
      durability: w ? w.durabilityFraction : 0,
      reload: w?.reloading ? w.reloadProgress : -1,
      noise: this.noise.playerNoiseLevel,
      noiseRadius,
      awareness: threat.awareness,
      hostile: threat.hostile,
      prompt: ic ? { ...ic.prompt, progress: this.interactions.holding ? this.interactions.progress : 0 } : null,
      takedown: !!this.combat.takedownTarget,
      crouched: p.crouched,
      sprinting: p.sprinting,
      aiming: p.aiming,
      flashlightOn: p.flashlightOn,
      battery: p.battery,
      inGrass: p.inGrass,
      objectives,
      marker: tracked?.marker
        ? { x: tracked.marker.x, z: tracked.marker.z, label: tracked.text, distance: dist2D(p.x, p.z, tracked.marker.x, tracked.marker.z) }
        : null,
      clock: this.time.clock,
      phase: this.time.phase,
      rain: this.weather.rain,
      playerX: p.x,
      playerZ: p.z,
      playerYaw: p.yaw,
      camYaw: this.camera.yaw,
      usingItem: useId ? { name: getItem(useId).name, progress: p.useProgress } : null,
      bottles: this.inventory.count('glass_bottle'),
      extraction: this.missions.isExtractionUnlocked(),
    };
  }

  get lastPlayerNoiseRadius(): number {
    return this.lastNoiseRadius;
  }

  objectiveStatus(id: string): ObjectiveStatus | null {
    return this.missions.objectiveStatus(id);
  }

  /** 0 in daylight .. 1 at night. */
  get darkness(): number {
    return clamp01(this.time.darkness);
  }

  dispose(): void {
    this.unsubs.forEach((u) => u());
    this.missions.dispose();
    this.combat.dispose();
    this.enemies.dispose();
    this.noise.clear();
    this.ctx.audio.stopAllLoops();
    this.level.dispose();
    this.root.removeFromParent();
  }
}
