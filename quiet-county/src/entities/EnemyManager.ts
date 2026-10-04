import * as THREE from 'three';
import { getArchetype, type ArchetypeId } from '../config/enemies';
import type { QualityPreset } from '../config/quality';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { createLogger } from '../core/Logger';
import { angleTo, dist2D, wrapAngle, yawFromDir } from '../core/math';
import { ObjectPool } from '../core/ObjectPool';
import { hashString } from '../core/Random';
import type { EnemyVocal } from '../systems/ai/EnemyBrain';
import type { NoiseSystem } from '../systems/NoiseSystem';
import type { WorldState } from '../systems/WorldState';
import type { SpawnDef } from '../world/LevelTypes';
import { CF, type CircleResult, type PhysicsWorld } from '../world/Physics';
import type { Door } from '../world/WorldObjects';
import { Infected, type EnemyHost, type HitInfo } from './Infected';
import type { PathService } from './Locomotion';
import type { Player } from './Player';

const log = createLogger('SpawnManager');

export interface EnemyHit {
  enemy: Infected;
  t: number;
  head: boolean;
}

export interface EnemyCallbacks {
  onVocal(enemy: Infected, vocal: EnemyVocal): void;
  onStrike(enemy: Infected, hit: boolean): void;
  onDoorBashed(enemy: Infected, door: Door, opened: boolean): void;
}

const MAX_CORPSES = 10;

/**
 * Spawning, pooling and updating of infected. Owns group spawns (scripted hordes), night
 * spawns, group alert propagation, corpse cleanup and spatial queries for combat.
 */
export class EnemyManager implements EnemyHost {
  readonly root = new THREE.Group();
  readonly enemies: Infected[] = [];
  private readonly pools = new Map<ArchetypeId, ObjectPool<Infected>>();
  private readonly neighborScratch: Infected[] = [];
  private readonly sepResult: CircleResult = { x: 0, z: 0, hit: null };
  aimYaw = 0;
  private nightSpawned = false;

  constructor(
    readonly physics: PhysicsWorld,
    readonly paths: PathService,
    readonly bus: EventBus<GameEvents>,
    readonly noise: NoiseSystem,
    readonly player: Player,
    readonly quality: QualityPreset,
    private readonly world: WorldState,
    private readonly spawnDefs: readonly SpawnDef[],
    private readonly env: { isNight(): boolean; darkness(): number; damageScale(): number },
    private readonly callbacks: EnemyCallbacks,
    private readonly shadows: boolean,
  ) {
    this.root.name = 'infected';
  }

  isNight(): boolean {
    return this.env.isNight();
  }

  darkness(): number {
    return this.env.darkness();
  }

  damageScale(): number {
    return this.env.damageScale();
  }

  get aliveCount(): number {
    return this.enemies.reduce((n, e) => n + (e.alive ? 1 : 0), 0);
  }

  /** Spawns everything that should exist now (respecting kills, triggered groups, night). */
  spawnInitial(): void {
    for (const def of this.spawnDefs) {
      if (def.night) continue;
      if (def.group && !this.world.getFlag(`group:${def.group}`)) continue;
      this.spawn(def);
    }
    if (this.env.isNight()) this.spawnNight();
  }

  spawnGroup(groupId: string): number {
    if (this.world.getFlag(`group:${groupId}`)) return 0;
    this.world.setFlag(`group:${groupId}`);
    let n = 0;
    for (const def of this.spawnDefs) if (def.group === groupId && this.spawn(def)) n++;
    log.info(`Spawned group ${groupId} (${n})`);
    return n;
  }

  spawnNight(): void {
    if (this.nightSpawned) return;
    this.nightSpawned = true;
    for (const def of this.spawnDefs) if (def.night) this.spawn(def);
  }

  spawn(def: SpawnDef): Infected | null {
    if (this.world.deadEnemies.has(def.id)) return null;
    if (this.enemies.some((e) => e.id === def.id && e.active)) return null;
    const pool = this.poolFor(def.archetype);
    const e = pool.acquire();
    if (!e) return null;
    e.activate(def, this);
    if (!this.root.children.includes(e.rig.root)) this.root.add(e.rig.root);
    this.enemies.push(e);
    this.noise.register(e);
    this.bus.emit('enemy:spawned', { id: def.id, archetype: def.archetype });
    return e;
  }

  private poolFor(archetype: ArchetypeId): ObjectPool<Infected> {
    let pool = this.pools.get(archetype);
    if (!pool) {
      const def = getArchetype(archetype);
      let n = 0;
      pool = new ObjectPool<Infected>(
        () => {
          const inf = new Infected(def, (hashString(archetype) % 1000) + ++n * 17.3);
          inf.rig.setShadows(this.shadows);
          return inf;
        },
        undefined,
        (inf) => inf.deactivate(),
        40,
      );
      this.pools.set(archetype, pool);
    }
    return pool;
  }

  private release(e: Infected): void {
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    this.noise.unregister(e);
    this.pools.get(e.archetype.id)?.release(e);
  }

  update(dt: number): void {
    this.paths.beginFrame();
    for (const e of this.enemies) e.update(dt, this);
    this.separateFromPlayer();
    // Corpse cleanup: keep the most recent few.
    const corpses = this.enemies.filter((e) => !e.alive);
    if (corpses.length > MAX_CORPSES) {
      corpses.sort((a, b) => b.deadTime - a.deadTime);
      corpses.slice(0, corpses.length - MAX_CORPSES).forEach((c) => this.release(c));
    }
    for (const c of corpses) if (c.deadTime > 32) this.release(c);
  }

  /** Bodies do not overlap: infected are pushed out of the player (then out of walls). */
  private separateFromPlayer(): void {
    const p = this.player;
    if (!p.alive) return;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const min = e.archetype.radius + 0.33;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d >= min) continue;
      const nx = d > 1e-4 ? dx / d : 1;
      const nz = d > 1e-4 ? dz / d : 0;
      const push = min - d;
      this.physics.resolveCircle(e.x + nx * push, e.z + nz * push, e.archetype.radius, CF.Move, this.sepResult);
      e.x = this.sepResult.x;
      e.z = this.sepResult.z;
    }
  }

  // ---- EnemyHost ---------------------------------------------------------------------

  neighbors(self: Infected, radius: number): Infected[] {
    const out = this.neighborScratch;
    out.length = 0;
    for (const e of this.enemies) {
      if (e === self || !e.alive) continue;
      if (Math.abs(e.x - self.x) < radius && Math.abs(e.z - self.z) < radius) out.push(e);
    }
    return out;
  }

  onVocal(enemy: Infected, vocal: EnemyVocal): void {
    if (vocal === 'alert' && enemy.archetype.alertRadius > 0) {
      this.noise.emit({ kind: 'voice', x: enemy.x, z: enemy.z, radius: enemy.archetype.alertRadius, fromPlayer: false, priority: 5, sourceId: enemy.id });
    }
    this.callbacks.onVocal(enemy, vocal);
  }

  /** Group behavior: an infected that starts hunting pulls nearby ones toward the player. */
  onAlert(enemy: Infected): void {
    this.bus.emit('enemy:alerted', { id: enemy.id, x: enemy.x, z: enemy.z });
    const r = enemy.archetype.alertRadius;
    if (r <= 0) return;
    const target = enemy.brain.lastKnown ?? { x: this.player.x, z: this.player.z };
    for (const other of this.enemies) {
      if (other === enemy || !other.alive || other.brain.isHostile) continue;
      if (dist2D(other.x, other.z, enemy.x, enemy.z) <= r) other.brain.alertTo(target.x, target.z);
    }
  }

  onStrike(enemy: Infected, hit: boolean): void {
    this.callbacks.onStrike(enemy, hit);
  }

  onDoorBashed(enemy: Infected, door: Door, opened: boolean): void {
    this.callbacks.onDoorBashed(enemy, door, opened);
  }

  // ---- combat queries ----------------------------------------------------------------

  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): EnemyHit | null {
    let best: EnemyHit | null = null;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // Cheap reject: distance from the ray's XZ line.
      const px = e.x - ox;
      const pz = e.z - oz;
      const along = px * dx + pz * dz;
      if (along < -1 || along > maxDist + 1) continue;
      const hit = e.rayTest(ox, oy, oz, dx, dy, dz, best ? best.t : maxDist);
      if (hit) best = { enemy: e, t: hit.t, head: hit.head };
    }
    return best;
  }

  /** Living infected within `range` and inside a frontal arc (melee). */
  inArc(x: number, z: number, yaw: number, range: number, arcRad: number): Infected[] {
    return this.enemies.filter((e) => {
      if (!e.alive) return false;
      const d = dist2D(x, z, e.x, e.z);
      if (d > range + e.archetype.radius) return false;
      return d < 0.6 || angleTo(yaw, x, z, e.x, e.z) <= arcRad / 2;
    });
  }

  /** An unaware infected the player can silently take down from behind, if any. */
  takedownTarget(px: number, pz: number, pyaw: number, range: number, rearAngleDeg: number): Infected | null {
    let best: Infected | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || !e.brain.canBeTakenDown) continue;
      const d = dist2D(px, pz, e.x, e.z);
      if (d > range || d >= bestD) continue;
      // Player must be behind the infected (or it must be lying dormant) and facing it.
      const behind = Math.abs(wrapAngle(yawFromDir(px - e.x, pz - e.z) - e.yaw)) * (180 / Math.PI) >= rearAngleDeg;
      const dormant = e.state === 'dormant';
      const facing = angleTo(pyaw, px, pz, e.x, e.z) < 1.2;
      if ((behind || dormant) && facing) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  /** Highest awareness among nearby infected and whether any are hunting (HUD + safety). */
  threat(x: number, z: number, radius: number): { awareness: number; hostile: number } {
    let awareness = 0;
    let hostile = 0;
    for (const e of this.enemies) {
      if (!e.alive || dist2D(x, z, e.x, e.z) > radius) continue;
      if (e.brain.isHostile) hostile++;
      awareness = Math.max(awareness, e.brain.isHostile ? 1 : e.brain.awareness);
    }
    return { awareness, hostile };
  }

  hit(enemy: Infected, info: HitInfo): boolean {
    const killed = enemy.receiveHit(info, this);
    if (killed) this.world.deadEnemies.add(enemy.id);
    return killed;
  }

  dispose(): void {
    for (const e of [...this.enemies]) this.release(e);
    this.root.clear();
  }
}
