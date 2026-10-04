import * as THREE from 'three';
import { PLAYER } from '../config/player';
import { getItem } from '../config/items';
import { getWeapon, type WeaponDef } from '../config/weapons';
import type { AudioSystem } from '../audio/AudioSystem';
import type { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import type { Random } from '../core/Random';
import type { EnemyManager } from '../entities/EnemyManager';
import type { Infected } from '../entities/Infected';
import type { Player } from '../entities/Player';
import type { InputState } from '../input/InputState';
import type { Effects } from '../render/Effects';
import type { NoiseSystem } from '../systems/NoiseSystem';
import { WeaponRuntime, rollDamage, sampleSpread, spreadDegrees } from '../systems/WeaponLogic';
import { CF, type PhysicsWorld } from '../world/Physics';

interface PendingMelee {
  at: number;
  def: WeaponDef;
  runtime: WeaponRuntime | null;
  power: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export interface CombatDeps {
  player: Player;
  enemies: EnemyManager;
  physics: PhysicsWorld;
  camera: ThirdPersonCamera;
  effects: Effects;
  audio: AudioSystem;
  noise: NoiseSystem;
  bus: EventBus<GameEvents>;
  rng: Random;
  scene: THREE.Object3D;
  haptic(strength: 'light' | 'medium' | 'heavy'): void;
  aimAssist(): boolean;
}

const BARE_HANDS: WeaponDef = {
  ...getWeapon('crowbar'),
  id: 'bare_hands', name: 'Shove', damage: 8, range: 1.5, noise: 3, staminaCost: 10, fireRate: 1.6, stagger: 1.0, critChance: 0, durability: 1,
};

const tmpOrigin = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const tmpMuzzle = new THREE.Vector3();
const tmpEnd = new THREE.Vector3();
const tmpTo = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);

/**
 * Resolves the player's combat actions: hitscan firearms with spread, recoil, aim assist and
 * loud noise; stamina-limited melee arcs; silent rear takedowns; reloads; thrown bottles.
 */
export class CombatSystem {
  private pendingMelee: PendingMelee | null = null;
  private pendingTakedown: { at: number; target: Infected } | null = null;
  private meleeCooldown = 0;
  private readonly projectiles: Projectile[] = [];
  private readonly bottleGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.26, 6);
  private readonly bottleMat = new THREE.MeshLambertMaterial({ color: 0x3a6a3a, transparent: true, opacity: 0.85 });
  takedownTarget: Infected | null = null;
  private time = 0;

  constructor(private readonly d: CombatDeps) {}

  update(dt: number, input: InputState): void {
    this.time += dt;
    const p = this.d.player;
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.updateProjectiles(dt);
    this.resolvePending();
    if (!p.alive) return;

    this.takedownTarget =
      p.state === 'normal' ? this.d.enemies.takedownTarget(p.x, p.z, p.yaw, PLAYER.takedownRange, PLAYER.takedownRearAngle) : null;

    if (input.wasPressed('flashlight')) {
      p.toggleFlashlight();
      this.d.audio.play('flashlight');
    }
    if (p.state !== 'normal') return;

    if (input.wasPressed('switch')) {
      p.cycleWeapon();
      this.d.audio.play('reload', { volume: 0.5 });
    }
    if (input.wasPressed('reload') && p.weapon?.startReload(p.inventory)) {
      this.d.audio.play('reload');
      this.d.bus.emit('weapon:reloadStarted', { weaponId: p.weapon.def.id, duration: p.weapon.def.reloadTime });
    }
    if (input.wasPressed('throw')) this.throwBottle();

    if (input.wasPressed('melee')) {
      if (this.takedownTarget) this.startTakedown(this.takedownTarget);
      else this.quickMelee();
      return;
    }

    const w = p.weapon;
    if (!w) return;
    const firePressed = input.wasPressed('fire');
    const fireHeld = input.isHeld('fire');
    if (w.isFirearm) {
      if (firePressed || (fireHeld && w.def.automatic)) this.fireFirearm(w);
    } else if (firePressed || fireHeld) {
      if (this.takedownTarget && firePressed) this.startTakedown(this.takedownTarget);
      else this.swing(w.def, w);
    }
  }

  // ---- firearms -----------------------------------------------------------------------

  private fireFirearm(w: WeaponRuntime): void {
    const p = this.d.player;
    const blocked = w.use();
    if (blocked === 'empty') {
      if (w.ready) {
        w.delay(0.3);
        this.d.audio.play('dryfire');
        this.d.bus.emit('weapon:dryFire', { weaponId: w.def.id });
        if (w.startReload(p.inventory)) {
          this.d.audio.play('reload');
          this.d.bus.emit('weapon:reloadStarted', { weaponId: w.def.id, duration: w.def.reloadTime });
        } else this.d.bus.emit('message', { text: 'Out of ammo.', kind: 'warning', duration: 2 });
      }
      return;
    }
    if (blocked === 'broken') {
      this.d.bus.emit('message', { text: `${w.def.name} is broken.`, kind: 'warning', duration: 2 });
      w.delay(0.5);
      return;
    }
    if (blocked) return;

    p.combatFacing = 0.9;
    const cam = this.d.camera;
    cam.aimRay(tmpOrigin, tmpDir);
    // Start the ray level with the player so nothing behind them gets hit.
    const toPlayer = (p.x - tmpOrigin.x) * tmpDir.x + (p.y + 1.3 - tmpOrigin.y) * tmpDir.y + (p.z - tmpOrigin.z) * tmpDir.z;
    tmpOrigin.addScaledVector(tmpDir, Math.max(0, toPlayer - 0.2));
    if (this.d.aimAssist()) this.applyAimAssist(tmpOrigin, tmpDir, p.aiming ? 2.5 : 5.5, w.def.range * 1.3);

    const spread = spreadDegrees(w.def, { aiming: p.aiming, moving: p.speed > 0.6, crouched: p.crouched });
    p.muzzleWorldPosition(tmpMuzzle);
    const yawAxis = up;
    const right = new THREE.Vector3().crossVectors(tmpDir, up).normalize();
    let anyHit = false;
    for (let i = 0; i < w.def.pellets; i++) {
      const off = sampleSpread(spread, this.d.rng);
      const dir = tmpDir.clone().applyAxisAngle(yawAxis, off.yaw).applyAxisAngle(right, off.pitch).normalize();
      const maxRange = w.def.range * 2;
      const wall = this.d.physics.raycast(tmpOrigin.x, tmpOrigin.y, tmpOrigin.z, dir.x, dir.y, dir.z, maxRange, CF.Bullet);
      const enemyHit = this.d.enemies.raycast(tmpOrigin.x, tmpOrigin.y, tmpOrigin.z, dir.x, dir.y, dir.z, wall ? wall.t : maxRange);
      let endT = wall ? wall.t : maxRange;
      if (enemyHit) {
        endT = enemyHit.t;
        tmpEnd.copy(tmpOrigin).addScaledVector(dir, endT);
        const dist = Math.hypot(enemyHit.enemy.x - p.x, enemyHit.enemy.z - p.z);
        const roll = rollDamage(w.def, this.d.rng, { headshot: enemyHit.head, distance: dist });
        const killed = this.d.enemies.hit(enemyHit.enemy, {
          damage: roll.amount, headshot: enemyHit.head, crit: roll.crit, fromX: p.x, fromZ: p.z,
          stagger: w.def.stagger, takedown: false, weaponId: w.def.id,
        });
        this.d.bus.emit('weapon:hit', { targetId: enemyHit.enemy.id, damage: roll.amount, headshot: enemyHit.head, crit: roll.crit, killed });
        this.d.effects.puff(tmpEnd, true, enemyHit.head ? 5 : 3);
        if (i === 0) {
          this.d.effects.bloodDecal(enemyHit.enemy.x, enemyHit.enemy.z);
          this.d.audio.play('hitFlesh', { x: tmpEnd.x, z: tmpEnd.z, volume: 0.7 });
          if (killed) this.d.audio.play('infectedDeath', { x: enemyHit.enemy.x, z: enemyHit.enemy.z, pitch: 1 + this.d.rng.range(-0.1, 0.1) });
        }
        anyHit = true;
      } else if (wall) {
        tmpEnd.set(wall.x, wall.y, wall.z);
        this.d.effects.puff(tmpEnd, false, 2);
        if (i === 0) this.d.audio.play(wall.collider.tag.startsWith('vehicle') ? 'hitMetal' : 'impact', { x: wall.x, z: wall.z, volume: 0.6 });
      } else {
        tmpEnd.copy(tmpOrigin).addScaledVector(dir, endT);
      }
      if (i < 3) this.d.effects.tracer(tmpMuzzle, tmpEnd);
    }
    void anyHit;
    this.d.effects.muzzleFlash(tmpMuzzle);
    this.d.audio.play('gunshot', { pitch: w.def.model === 'revolver' ? 0.8 : w.def.category === 'shotgun' ? 0.7 : 1 });
    this.d.noise.emit({ kind: 'gunshot', x: p.x, z: p.z, radius: w.def.noise, fromPlayer: true, priority: 8 });
    cam.kick(w.def.recoil * (p.aiming ? 0.6 : 1));
    cam.shake(0.12 + w.def.recoil * 0.015);
    this.d.haptic('medium');
    this.d.bus.emit('weapon:fired', { weaponId: w.def.id, x: p.x, y: 1.3, z: p.z });
    if (w.broken) {
      this.d.bus.emit('weapon:broken', { weaponId: w.def.id });
      this.d.bus.emit('message', { text: `${w.def.name} broke!`, kind: 'warning' });
    }
  }

  /** Gently bends the shot toward an infected near the crosshair (touch-friendly). */
  private applyAimAssist(origin: THREE.Vector3, dir: THREE.Vector3, maxDeg: number, maxDist: number): void {
    const maxRad = (maxDeg * Math.PI) / 180;
    let best: { angle: number; x: number; y: number; z: number } | null = null;
    for (const e of this.d.enemies.enemies) {
      if (!e.alive) continue;
      const tx = e.x;
      const ty = e.state === 'dormant' ? 0.3 : 1.25 * (e.rig.height / 1.75);
      const tz = e.z;
      tmpTo.set(tx - origin.x, ty - origin.y, tz - origin.z);
      const dist = tmpTo.length();
      if (dist > maxDist || dist < 0.5) continue;
      tmpTo.divideScalar(dist);
      const angle = Math.acos(Math.min(1, tmpTo.dot(dir)));
      if (angle > maxRad || (best && angle >= best.angle)) continue;
      if (!this.d.physics.lineClear(origin.x, origin.y, origin.z, tx, ty, tz, CF.Bullet)) continue;
      best = { angle, x: tx, y: ty, z: tz };
    }
    if (!best) return;
    tmpTo.set(best.x - origin.x, best.y - origin.y, best.z - origin.z).normalize();
    dir.lerp(tmpTo, 0.65).normalize();
  }

  // ---- melee --------------------------------------------------------------------------

  private quickMelee(): void {
    const p = this.d.player;
    if (p.weapon && !p.weapon.isFirearm) {
      this.swing(p.weapon.def, p.weapon);
      return;
    }
    // Holstered melee weapon for a quick swing, else a bare-handed shove.
    const slot = p.inventory.indicesByCategory('weapon').find((i) => {
      const s = p.inventory.getSlot(i)!;
      return getWeapon(getItem(s.itemId).weaponId!).category === 'melee';
    });
    if (slot !== undefined) {
      const stack = p.inventory.getSlot(slot)!;
      const def = getWeapon(getItem(stack.itemId).weaponId!);
      this.swing(def, new WeaponRuntime(def, stack));
    } else {
      this.swing(BARE_HANDS, null);
    }
  }

  private swing(def: WeaponDef, runtime: WeaponRuntime | null): void {
    const p = this.d.player;
    if (this.meleeCooldown > 0 || this.pendingMelee) return;
    if (runtime?.broken) {
      this.d.bus.emit('message', { text: `${def.name} is broken.`, kind: 'warning', duration: 2 });
      return;
    }
    const duration = Math.min(0.75, 0.9 / def.fireRate);
    this.meleeCooldown = 1 / def.fireRate;
    const power = 0.45 + 0.55 * p.stamina.spend(def.staminaCost);
    p.combatFacing = 0.6;
    p.yaw = this.d.camera.yaw;
    p.playAttack(def.id === 'bare_hands' ? 'shove' : def.model === 'knife' ? 'stab' : 'swing', duration);
    this.pendingMelee = { at: this.time + duration * 0.42, def, runtime, power };
    this.d.audio.play('swing', { pitch: 1 / Math.sqrt(def.weight) });
  }

  private resolvePending(): void {
    const p = this.d.player;
    if (this.pendingMelee && this.time >= this.pendingMelee.at) {
      const m = this.pendingMelee;
      this.pendingMelee = null;
      if (!p.alive) return;
      const arc = (m.def.arc * Math.PI) / 180;
      const targets = this.d.enemies.inArc(p.x, p.z, p.yaw, m.def.range, arc).slice(0, m.def.arc >= 110 ? 2 : 1);
      for (const e of targets) {
        const roll = rollDamage(m.def, this.d.rng, { power: m.power });
        const killed = this.d.enemies.hit(e, {
          damage: roll.amount, headshot: false, crit: roll.crit, fromX: p.x, fromZ: p.z,
          stagger: m.def.stagger * m.power, takedown: false, weaponId: m.def.id,
        });
        tmpEnd.set(e.x, 1.3, e.z);
        this.d.effects.puff(tmpEnd, true, 3);
        this.d.audio.play('hitFlesh', { x: e.x, z: e.z, pitch: 0.9 + this.d.rng.range(0, 0.2) });
        if (killed) this.d.audio.play('infectedDeath', { x: e.x, z: e.z });
        this.d.bus.emit('weapon:hit', { targetId: e.id, damage: roll.amount, headshot: false, crit: roll.crit, killed });
      }
      const hit = targets.length > 0;
      if (hit) {
        this.d.noise.emit({ kind: 'melee', x: p.x, z: p.z, radius: m.def.noise, fromPlayer: true, priority: 4 });
        this.d.camera.shake(0.15);
        this.d.haptic('light');
        if (m.runtime && m.runtime.wear(1)) {
          this.d.bus.emit('weapon:broken', { weaponId: m.def.id });
          this.d.bus.emit('message', { text: `${m.def.name} broke!`, kind: 'warning' });
        }
      }
      this.d.bus.emit('weapon:melee', { weaponId: m.def.id, hit });
    }
    if (this.pendingTakedown && this.time >= this.pendingTakedown.at) {
      const t = this.pendingTakedown.target;
      this.pendingTakedown = null;
      if (t.alive) {
        this.d.enemies.hit(t, { damage: 9999, headshot: false, crit: false, fromX: p.x, fromZ: p.z, stagger: 0, takedown: true, weaponId: 'takedown' });
        this.d.noise.emit({ kind: 'melee', x: p.x, z: p.z, radius: 2.5, fromPlayer: true, priority: 2 });
        tmpEnd.set(t.x, 1.0, t.z);
        this.d.effects.puff(tmpEnd, true, 2);
        this.d.haptic('medium');
      }
    }
  }

  private startTakedown(target: Infected): void {
    const p = this.d.player;
    p.startTakedown(target.x, target.z);
    this.pendingTakedown = { at: this.time + PLAYER.takedownDuration * 0.45, target };
    this.d.audio.play('takedown');
    this.d.bus.emit('message', { text: 'Silent takedown', kind: 'info', duration: 1.5 });
  }

  // ---- throwables ---------------------------------------------------------------------

  private throwBottle(): void {
    const p = this.d.player;
    if (!p.inventory.has('glass_bottle')) {
      this.d.bus.emit('message', { text: 'Nothing to throw. Empty bottles make good distractions.', kind: 'info', duration: 2.5 });
      return;
    }
    p.inventory.remove('glass_bottle', 1, 'thrown');
    const cam = this.d.camera;
    cam.aimRay(tmpOrigin, tmpDir);
    p.yaw = cam.yaw;
    p.combatFacing = 0.5;
    p.playAttack('swing', 0.45);
    const mesh = new THREE.Mesh(this.bottleGeo, this.bottleMat);
    mesh.position.set(p.x + tmpDir.x * 0.4, 1.6, p.z + tmpDir.z * 0.4);
    this.d.scene.add(mesh);
    const speed = 15;
    this.projectiles.push({ mesh, vx: tmpDir.x * speed, vy: tmpDir.y * speed + 4.2, vz: tmpDir.z * speed, life: 4 });
    this.d.audio.play('throw');
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.vy -= 9.8 * dt;
      const m = pr.mesh;
      const sx = pr.vx * dt;
      const sy = pr.vy * dt;
      const sz = pr.vz * dt;
      const len = Math.hypot(sx, sy, sz);
      const hit = len > 0 ? this.d.physics.raycast(m.position.x, m.position.y, m.position.z, sx / len, sy / len, sz / len, len, CF.Bullet | CF.Move) : null;
      m.rotation.x += dt * 12;
      if (hit) m.position.set(hit.x, hit.y, hit.z);
      else m.position.set(m.position.x + sx, m.position.y + sy, m.position.z + sz);
      if (hit || m.position.y <= 0.05 || pr.life <= 0) {
        m.position.y = Math.max(0.05, m.position.y);
        this.d.noise.emit({ kind: 'breakable', x: m.position.x, z: m.position.z, radius: 18, fromPlayer: false, priority: 4, sourceId: 'bottle' });
        this.d.audio.play('glass', { x: m.position.x, z: m.position.z });
        this.d.effects.puff(m.position, false, 2);
        this.d.scene.remove(m);
        this.projectiles.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const pr of this.projectiles) this.d.scene.remove(pr.mesh);
    this.projectiles.length = 0;
    this.bottleGeo.dispose();
    this.bottleMat.dispose();
  }
}
