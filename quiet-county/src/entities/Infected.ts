import type { EnemyArchetype } from '../config/enemies';
import type { QualityPreset } from '../config/quality';
import type { EventBus } from '../core/EventBus';
import type { GameEvents, NoiseEvent } from '../core/GameEvents';
import { angleTo, clamp01, dampAngle, dist2D, wrapAngle, yawFromDir } from '../core/math';
import { Random } from '../core/Random';
import { EnemyBrain, type EnemyStateId, type EnemyVocal } from '../systems/ai/EnemyBrain';
import type { NoiseListener, NoiseSystem } from '../systems/NoiseSystem';
import { Health } from '../systems/Vitals';
import type { SpawnDef } from '../world/LevelTypes';
import { CF, type PhysicsWorld } from '../world/Physics';
import type { Door } from '../world/WorldObjects';
import { HumanoidRig, infectedAppearance } from './HumanoidRig';
import { Locomotion, type PathService } from './Locomotion';
import type { Player } from './Player';

export interface EnemyHost {
  physics: PhysicsWorld;
  paths: PathService;
  bus: EventBus<GameEvents>;
  noise: NoiseSystem;
  player: Player;
  quality: QualityPreset;
  /** Camera yaw, for flashlight cone checks. */
  aimYaw: number;
  isNight(): boolean;
  darkness(): number;
  neighbors(self: Infected, radius: number): Infected[];
  onVocal(enemy: Infected, vocal: EnemyVocal): void;
  onAlert(enemy: Infected): void;
  onStrike(enemy: Infected, hit: boolean): void;
  onDoorBashed(enemy: Infected, door: Door, opened: boolean): void;
}

export interface HitInfo {
  damage: number;
  headshot: boolean;
  crit: boolean;
  fromX: number;
  fromZ: number;
  stagger: number;
  takedown: boolean;
  weaponId: string;
}

export interface RayHitResult {
  t: number;
  head: boolean;
}

/** An infected body: perception, locomotion, door bashing, hit volumes and animation. */
export class Infected implements NoiseListener {
  id = '';
  spawn!: SpawnDef;
  brain!: EnemyBrain;
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  yaw = 0;
  readonly health: Health;
  readonly rig: HumanoidRig;
  readonly loco: Locomotion;
  active = false;
  deadTime = 0;
  distanceToPlayer = 0;
  private thinkAccum = 0;
  private wakeTimer = 0;
  private lying = 0;
  private bashDoor: Door | null = null;
  private bashTimer = 0;
  private bashNoise = 0;
  private hitFlinch = 0;
  private attackTime = 0;
  private lookTime = 0;
  private rng: Random;

  constructor(
    readonly archetype: EnemyArchetype,
    seed: number,
  ) {
    this.rng = new Random(seed * 7919 + 13);
    this.health = new Health(archetype.health);
    this.rig = new HumanoidRig(infectedAppearance(archetype.skinTones, archetype.clothTones, archetype.posture, seed, archetype.scale), seed);
    this.loco = new Locomotion(archetype.radius);
  }

  // NoiseListener
  get hearingMultiplier(): number {
    return this.archetype.hearingMultiplier;
  }
  get canHear(): boolean {
    return this.active && !this.brain.isDead;
  }
  onNoise(e: NoiseEvent, perceived: number): void {
    this.brain.hearNoise(e, perceived);
  }

  get alive(): boolean {
    return this.active && !this.brain.isDead;
  }

  get state(): EnemyStateId {
    return this.brain.state;
  }

  activate(def: SpawnDef, host: EnemyHost): void {
    this.id = def.id;
    this.spawn = def;
    this.x = def.x;
    this.z = def.z;
    this.vx = this.vz = 0;
    this.yaw = def.rot ?? this.rng.next() * Math.PI * 2;
    this.health.max = this.archetype.health;
    this.health.set(this.archetype.health);
    this.active = true;
    this.deadTime = 0;
    this.thinkAccum = this.rng.next() * 0.1;
    this.loco.reset();
    this.bashDoor = null;
    this.lying = def.dormant ? 1 : 0;
    this.wakeTimer = 0;
    this.rig.root.visible = true;
    this.rig.pose.dead = 0;
    this.rig.pose.attack = -1;
    this.brain = new EnemyBrain(
      this.archetype,
      { x: def.x, z: def.z },
      this.rng.fork(def.id),
      { dormant: def.dormant, wanderRadius: def.wanderRadius, patrol: def.patrol },
      (from, to) => {
        host.bus.emit('enemy:stateChanged', { id: this.id, from, to });
        if (to === 'chase') host.onAlert(this);
        if (from === 'dormant') this.wakeTimer = 1.1;
      },
    );
    this.syncTransform();
  }

  deactivate(): void {
    this.active = false;
    this.rig.root.visible = false;
  }

  update(dt: number, host: EnemyHost): void {
    if (!this.active) return;
    const p = host.player;
    this.distanceToPlayer = dist2D(this.x, this.z, p.x, p.z);

    if (this.brain.isDead) {
      this.deadTime += dt;
      this.rig.pose.dead = Math.min(1, this.rig.pose.dead + dt * 1.6);
      if (this.deadTime > 20) this.rig.root.position.y = -Math.min(0.6, (this.deadTime - 20) * 0.05);
      if (this.rig.pose.dead < 1 || this.deadTime < 1.5) this.animate(dt, 0);
      return;
    }

    // Simulation level-of-detail: distant, calm infected think less often.
    const hostile = this.brain.isHostile;
    const interval = hostile || this.distanceToPlayer < host.quality.aiNearDistance ? 0 : this.distanceToPlayer < host.quality.aiFarDistance ? 0.1 : 0.4;
    this.thinkAccum += dt;
    if (this.thinkAccum >= interval) {
      const tdt = this.thinkAccum;
      this.thinkAccum = 0;
      this.think(tdt, host);
    }
    this.act(dt, host);

    const visible = this.distanceToPlayer < host.quality.viewDistance + 5;
    this.rig.root.visible = visible;
    if (visible && this.distanceToPlayer < 70) this.animate(dt, Math.hypot(this.vx, this.vz));
    else this.syncTransform();
  }

  private think(dt: number, host: EnemyHost): void {
    const p = host.player;
    const a = this.archetype;
    let visibility = 0;
    let close = false;
    if (p.alive && this.wakeTimer <= 0) {
      const d = this.distanceToPlayer;
      const dormantFactor = this.brain.state === 'dormant' ? 0.5 : 1;
      const range = a.visionRange * p.visibility * dormantFactor;
      const eyeY = this.lying > 0.5 ? 0.35 : 1.55 * a.scale;
      const targetY = p.y + p.chestHeight;
      const inFov = angleTo(this.yaw, this.x, this.z, p.x, p.z) < (a.visionFov * Math.PI) / 360;
      const needLos = (d < range && inFov) || d < a.proximitySense;
      let los = false;
      if (needLos) los = host.physics.lineClear(this.x, eyeY, this.z, p.x, targetY, p.z, CF.Sight);
      if (los && d < range && inFov) visibility = Math.max(0.2, Math.pow(clamp01(1 - d / range), 0.6));
      if (los && d < a.proximitySense * (p.crouched ? 0.6 : 1)) close = true;
      // A flashlight beam sweeping across an infected at night is very noticeable.
      if (!visibility && p.flashlightOn && host.darkness() > 0.4 && d < 24) {
        const beamAngle = Math.abs(wrapAngle(yawFromDir(this.x - p.x, this.z - p.z) - host.aimYaw));
        if (beamAngle < 0.45 && host.physics.lineClear(this.x, eyeY, this.z, p.x, 1.4, p.z, CF.Sight)) visibility = 0.55;
      }
    }
    const intent = this.brain.think(
      {
        selfX: this.x, selfZ: this.z, playerX: p.x, playerZ: p.z, playerYaw: p.yaw, playerAlive: p.alive,
        playerVisibility: visibility, playerSensedClose: close,
        reachedTarget: this.loco.reached, pathFailed: this.loco.failed, isNight: host.isNight(),
      },
      dt,
    );
    if (this.loco.failed) this.loco.failed = false;
    if (intent.vocal !== 'none') host.onVocal(this, intent.vocal);
    if (intent.strike) this.resolveStrike(host);
  }

  private act(dt: number, host: EnemyHost): void {
    const intent = this.brain.intent;
    const a = this.archetype;
    if (this.wakeTimer > 0) {
      this.wakeTimer -= dt;
      this.lying = Math.max(0, this.wakeTimer / 1.1);
      this.loco.halt(this, dt, host);
      return;
    }
    if (this.brain.state === 'dormant') {
      this.lying = 1;
      return;
    }
    let sepX = 0;
    let sepZ = 0;
    for (const n of host.neighbors(this, 1.0)) {
      const dx = this.x - n.x;
      const dz = this.z - n.z;
      const d = Math.hypot(dx, dz);
      if (d > 1e-3 && d < 1.0) {
        sepX += (dx / d) * (1.0 - d) * 2.2;
        sepZ += (dz / d) * (1.0 - d) * 2.2;
      }
    }

    if (this.bashDoor) {
      this.updateBash(dt, host);
      return;
    }

    if (intent.move && this.brain.state !== 'attack' && this.brain.state !== 'stagger') {
      const repath = this.brain.isHostile ? 0.6 : 2.5;
      this.loco.moveTo(this, intent.targetX, intent.targetZ, intent.speed, dt, host, repath, 0.6, sepX, sepZ);
      const blocker = this.loco.blockedBy;
      if (blocker && blocker.flags & CF.Door) {
        const door = blocker.ref as Door | null;
        if (door && !door.open && door.def.lock !== 'scripted') {
          this.bashDoor = door;
          this.bashTimer = 0;
          this.bashNoise = 0;
        }
      }
    } else {
      this.loco.halt(this, dt, host, sepX * 0.5, sepZ * 0.5);
    }

    // Face movement, or the look target when standing (e.g. attacking).
    const speed = Math.hypot(this.vx, this.vz);
    let targetYaw = this.yaw;
    if (intent.look) targetYaw = yawFromDir(intent.lookX - this.x, intent.lookZ - this.z);
    else if (speed > 0.2) targetYaw = yawFromDir(this.vx, this.vz);
    this.yaw = dampAngle(this.yaw, targetYaw, a.turnSpeed, dt);
  }

  private updateBash(dt: number, host: EnemyHost): void {
    const door = this.bashDoor!;
    if (door.open || !this.brain.intent.move) {
      this.bashDoor = null;
      return;
    }
    this.vx = this.vz = 0;
    this.yaw = dampAngle(this.yaw, yawFromDir(door.x - this.x, door.z - this.z), 6, dt);
    this.bashTimer += dt;
    this.bashNoise -= dt;
    if (this.bashNoise <= 0) {
      this.bashNoise = 0.8;
      host.noise.emit({ kind: 'door', x: door.x, z: door.z, radius: 12, fromPlayer: false, priority: 3, sourceId: this.id });
      host.onDoorBashed(this, door, false);
    }
    const needed = this.archetype.doorBashTime * (door.locked ? 2 : 1);
    if (this.bashTimer >= needed) {
      door.locked = false;
      door.setOpen(true, this.x, this.z);
      host.onDoorBashed(this, door, true);
      host.bus.emit('door:changed', { id: door.id, open: true, byEnemy: true });
      this.bashDoor = null;
    }
  }

  private resolveStrike(host: EnemyHost): void {
    const p = host.player;
    const a = this.archetype;
    const inRange = this.distanceToPlayer <= a.attackRange + 0.5 && Math.abs(p.y) < 0.6;
    const facing = angleTo(this.yaw, this.x, this.z, p.x, p.z) < 1.3;
    const hit = p.alive && inRange && facing;
    if (hit) p.takeDamage(a.attackDamage, this.x, this.z, `infected:${a.id}`);
    host.onStrike(this, hit);
  }

  /** Applies a hit; returns true if it killed. */
  receiveHit(hit: HitInfo, host: EnemyHost): boolean {
    if (!this.alive) return false;
    const damage = hit.takedown ? this.health.current : hit.damage;
    this.health.damage(damage);
    this.hitFlinch = 1;
    if (this.brain.state === 'dormant') {
      this.wakeTimer = 0;
      this.lying = 0;
    }
    if (this.health.dead) {
      this.brain.kill();
      this.vx = this.vz = 0;
      this.bashDoor = null;
      host.bus.emit('enemy:killed', { id: this.id, archetype: this.archetype.id, takedown: hit.takedown, headshot: hit.headshot });
      return true;
    }
    this.brain.applyHit(damage, hit.fromX, hit.fromZ, hit.stagger);
    // Knockback on stagger.
    if (damage >= this.archetype.staggerThreshold || hit.stagger >= 1) {
      const dx = this.x - hit.fromX;
      const dz = this.z - hit.fromZ;
      const d = Math.hypot(dx, dz) || 1;
      this.vx += (dx / d) * 2.2;
      this.vz += (dz / d) * 2.2;
    }
    return false;
  }

  /** Approximate hit volumes: a head sphere and a body cylinder (or a lying box). */
  rayTest(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxT: number): RayHitResult | null {
    if (!this.alive) return null;
    const s = this.rig.height / 1.75;
    const fwdX = -Math.sin(this.yaw);
    const fwdZ = -Math.cos(this.yaw);
    if (this.lying > 0.5) {
      // Lying on the back: head lies behind the hips.
      const hx = this.x - fwdX * 1.45 * s;
      const hz = this.z - fwdZ * 1.45 * s;
      const th = raySphere(ox, oy, oz, dx, dy, dz, hx, 0.2, hz, 0.16 * s);
      if (th !== null && th <= maxT) return { t: th, head: true };
      const tb = raySphere(ox, oy, oz, dx, dy, dz, this.x - fwdX * 0.7 * s, 0.2, this.z - fwdZ * 0.7 * s, 0.55 * s);
      return tb !== null && tb <= maxT ? { t: tb, head: false } : null;
    }
    const lean = 0.16;
    const headY = (this.archetype.posture === 'crouch' ? 1.2 : this.archetype.posture === 'hulk' ? 1.6 : 1.55) * s;
    const th = raySphere(ox, oy, oz, dx, dy, dz, this.x + fwdX * lean, headY, this.z + fwdZ * lean, 0.15 * s);
    const tb = rayCylinder(ox, oy, oz, dx, dy, dz, this.x, this.z, this.archetype.radius * 0.85, 0, headY - 0.14 * s);
    let best: RayHitResult | null = null;
    if (th !== null && th <= maxT) best = { t: th, head: true };
    if (tb !== null && tb <= maxT && (!best || tb < best.t - 0.05)) best = { t: tb, head: false };
    return best;
  }

  private animate(dt: number, speed: number): void {
    const pose = this.rig.pose;
    const intent = this.brain.intent;
    pose.speed = speed;
    pose.gait = speed > 2.2 ? 'run' : speed > 0.1 ? 'walk' : 'idle';
    pose.lying = this.lying;
    pose.limp = this.archetype.posture === 'shamble' && this.id.length % 2 === 0;
    this.hitFlinch = Math.max(0, this.hitFlinch - dt * 3.5);
    pose.hit = Math.max(this.hitFlinch, intent.anim === 'stagger' ? 0.8 : 0);
    if (this.bashDoor) {
      this.attackTime = (this.attackTime + dt / 0.8) % 1;
      pose.attack = this.attackTime;
      pose.attackStyle = 'claw';
    } else if (intent.anim === 'attack') {
      this.attackTime = Math.min(1, this.attackTime + dt / (this.archetype.attackWindup + 0.35));
      pose.attack = this.attackTime;
      pose.attackStyle = 'claw';
    } else {
      this.attackTime = 0;
      pose.attack = -1;
    }
    this.lookTime += dt;
    pose.look = intent.anim === 'look' ? Math.sin(this.lookTime * 1.7) * 0.9 : 0;
    this.syncTransform();
    this.rig.animate(dt);
  }

  syncTransform(): void {
    this.rig.root.position.x = this.x;
    this.rig.root.position.z = this.z;
    if (!this.brain?.isDead) this.rig.root.position.y = 0;
    this.rig.root.rotation.y = this.yaw;
  }
}

function raySphere(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, cy: number, cz: number, r: number): number | null {
  const lx = ox - cx;
  const ly = oy - cy;
  const lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

function rayCylinder(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, cz: number, r: number, y0: number, y1: number): number | null {
  const lx = ox - cx;
  const lz = oz - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = lx * dx + lz * dz;
  const c = lx * lx + lz * lz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t < 0) return null;
  const y = oy + dy * t;
  return y >= y0 && y <= y1 ? t : null;
}
