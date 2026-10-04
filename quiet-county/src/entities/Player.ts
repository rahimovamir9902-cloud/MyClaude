import * as THREE from 'three';
import { getItem } from '../config/items';
import { PLAYER } from '../config/player';
import { getWeapon } from '../config/weapons';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { clamp01, damp, dampAngle, dirFromYaw, lerp, yawFromDir } from '../core/math';
import type { InputState } from '../input/InputState';
import type { Inventory } from '../systems/Inventory';
import type { NoiseSystem } from '../systems/NoiseSystem';
import type { PlayerSaveState } from '../systems/SaveSystem';
import { HealingQueue, Health, Stamina } from '../systems/Vitals';
import { WeaponRuntime } from '../systems/WeaponLogic';
import type { Surface } from '../world/LevelTypes';
import { CF, rayBox, type CircleResult, type PhysicsWorld } from '../world/Physics';
import type { ZoneManager } from '../world/Zones';
import { HumanoidRig, type Gait } from './HumanoidRig';
import { buildWeaponModel, type WeaponModel } from './WeaponModels';

export type PlayerState = 'normal' | 'vault' | 'takedown' | 'using' | 'dead';

export interface PlayerWorld {
  physics: PhysicsWorld;
  bus: EventBus<GameEvents>;
  noise: NoiseSystem;
  zones: ZoneManager;
  surfaceAt(x: number, z: number): Surface;
  /** 0 daylight .. 1 night. */
  darkness: number;
}

export interface PlayerControlSettings {
  aimMode: 'hold' | 'toggle';
  sprintMode: 'hold' | 'toggle';
}

const SURFACE_NOISE: Record<Surface, number> = {
  grass: 0.75, dirt: 0.85, asphalt: 1, concrete: 1, gravel: 1.25, floor: 1.1, metal: 1.3, wood: 1.15,
};

export interface VaultOption {
  landingX: number;
  landingZ: number;
}

/**
 * Rowan Hale, the protagonist: movement (walk/run/sprint/crouch/vault), stance, vitals,
 * flashlight, equipped weapon state and procedural animation. Combat resolution lives in
 * the CombatSystem so this class stays independent of enemies.
 */
export class Player {
  x: number;
  z: number;
  y = 0;
  yaw: number;
  vx = 0;
  vz = 0;
  speed = 0;
  state: PlayerState = 'normal';
  crouched = false;
  sprinting = false;
  aiming = false;
  flashlightOn = false;
  battery = 100;
  visibility = 1;
  inGrass = false;
  gait: Gait = 'idle';
  equippedSlot = -1;
  weapon: WeaponRuntime | null = null;
  /** Remaining seconds the body keeps facing the camera after firing. */
  combatFacing = 0;
  readonly health = new Health(PLAYER.maxHealth);
  readonly stamina = new Stamina(PLAYER.maxStamina, PLAYER.staminaRegen, PLAYER.staminaRegenDelay, PLAYER.exhaustedRecover);
  readonly healing = new HealingQueue();
  readonly rig: HumanoidRig;
  readonly flashlight: THREE.SpotLight;
  private weaponModel: WeaponModel | null = null;
  private stepDistance = 0;
  private hitTimer = 0;
  private stateTimer = 0;
  private stateDuration = 0;
  private vaultFrom = { x: 0, z: 0 };
  private vaultTo = { x: 0, z: 0 };
  private useSlot = -1;
  private sprintToggled = false;
  private aimToggled = false;
  private attackAnim = -1;
  private attackStyle: 'swing' | 'claw' | 'shove' | 'stab' = 'swing';
  private attackDuration = 0.5;
  private readonly resolved: CircleResult = { x: 0, z: 0, hit: null };
  aimPitch = 0;

  constructor(
    readonly inventory: Inventory,
    private readonly bus: EventBus<GameEvents>,
    x: number,
    z: number,
    yaw: number,
  ) {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.rig = new HumanoidRig(
      { skin: 0xb07a58, shirt: 0x4a5560, pants: 0x3a3a34, hair: 0x2e241c, shoes: 0x3a2e24, jacket: 0x5a5236, backpack: 0x3e4a36 },
      7,
    );
    this.flashlight = new THREE.SpotLight(0xfff1d6, 0, PLAYER.flashlightRange, 0.48, 0.55, 1.3);
    this.flashlight.castShadow = false;
    this.syncTransform();
  }

  get alive(): boolean {
    return this.state !== 'dead';
  }

  get busy(): boolean {
    return this.state !== 'normal';
  }

  get chestHeight(): number {
    return this.crouched ? PLAYER.crouchChestHeight : PLAYER.chestHeight;
  }

  get isUsingItem(): boolean {
    return this.state === 'using';
  }

  get useProgress(): number {
    return this.state === 'using' ? clamp01(this.stateTimer / this.stateDuration) : 0;
  }

  get useItemId(): string | null {
    return this.state === 'using' ? (this.inventory.getSlot(this.useSlot)?.itemId ?? null) : null;
  }

  get attacking(): boolean {
    return this.attackAnim >= 0;
  }

  // ---- update --------------------------------------------------------------------

  update(dt: number, input: InputState, camYaw: number, camPitch: number, world: PlayerWorld, controls: PlayerControlSettings): void {
    this.health.update(dt);
    this.stamina.update(dt);
    const heal = this.healing.update(dt);
    if (heal > 0 && this.alive) {
      const applied = this.health.heal(heal);
      if (applied > 0) this.bus.emit('player:healed', { amount: applied, health: this.health.current });
    }
    if (this.hitTimer > 0) this.hitTimer = Math.max(0, this.hitTimer - dt);
    if (this.combatFacing > 0) this.combatFacing -= dt;
    this.aimPitch = camPitch;

    if (this.weapon && this.weapon.update(dt, this.inventory)) {
      this.bus.emit('weapon:reloaded', { weaponId: this.weapon.def.id, ammo: this.weapon.ammo });
    }

    if (this.state === 'dead') {
      this.rig.pose.dead = Math.min(1, this.rig.pose.dead + dt * 1.4);
      this.updateAnimation(dt);
      return;
    }

    this.updateFlashlight(dt, camYaw, camPitch, world);
    this.updateStanceInputs(input, controls);

    switch (this.state) {
      case 'vault':
        this.updateVault(dt, world);
        break;
      case 'takedown':
        this.stateTimer += dt;
        this.vx = this.vz = 0;
        if (this.stateTimer >= this.stateDuration) this.state = 'normal';
        break;
      case 'using':
        this.stateTimer += dt;
        this.move(dt, input, camYaw, world, 0.45);
        if (this.stateTimer >= this.stateDuration) this.finishUse();
        break;
      default:
        this.move(dt, input, camYaw, world, 1);
    }

    if (this.attackAnim >= 0) {
      this.attackAnim += dt / this.attackDuration;
      if (this.attackAnim >= 1) this.attackAnim = -1;
    }
    this.updateVisibility(world);
    this.updateAnimation(dt);
  }

  private updateStanceInputs(input: InputState, controls: PlayerControlSettings): void {
    if (input.wasPressed('crouch') && this.state === 'normal') {
      this.crouched = !this.crouched;
      if (this.crouched) this.sprintToggled = false;
      this.bus.emit('player:stanceChanged', { crouched: this.crouched });
    }
    if (controls.sprintMode === 'toggle') {
      if (input.wasPressed('sprint')) {
        this.sprintToggled = !this.sprintToggled;
        if (this.sprintToggled && this.crouched) {
          this.crouched = false;
          this.bus.emit('player:stanceChanged', { crouched: false });
        }
      }
    } else {
      this.sprintToggled = input.isHeld('sprint');
      if (this.sprintToggled && this.crouched && input.wasPressed('sprint')) {
        this.crouched = false;
        this.bus.emit('player:stanceChanged', { crouched: false });
      }
    }
    if (controls.aimMode === 'toggle') {
      if (input.wasPressed('aim')) this.aimToggled = !this.aimToggled;
    } else {
      this.aimToggled = input.isHeld('aim');
    }
    this.aiming = this.aimToggled && this.state === 'normal' && !!this.weapon?.isFirearm;
  }

  private move(dt: number, input: InputState, camYaw: number, world: PlayerWorld, speedScale: number): void {
    const mx = input.moveX;
    const my = input.moveY;
    const m = Math.min(1, Math.hypot(mx, my));
    const fwd = dirFromYaw(camYaw);
    const rightX = -fwd.z;
    const rightZ = fwd.x;
    let wishX = rightX * mx + fwd.x * my;
    let wishZ = rightZ * mx + fwd.z * my;
    const wl = Math.hypot(wishX, wishZ);
    if (wl > 1e-4) {
      wishX /= wl;
      wishZ /= wl;
    }

    let speed: number;
    let gait: Gait = 'idle';
    const wantsSprint = this.sprintToggled && !this.crouched && !this.aiming && m > 0.3;
    if (wantsSprint && this.stamina.canSprint()) {
      speed = PLAYER.sprintSpeed;
      gait = 'sprint';
    } else if (this.crouched) {
      speed = PLAYER.crouchSpeed * m;
      gait = m > 0.05 ? 'walk' : 'idle';
    } else if (this.aiming) {
      speed = PLAYER.aimSpeed * m;
      gait = m > 0.05 ? 'walk' : 'idle';
    } else if (m > PLAYER.runThreshold) {
      speed = PLAYER.runSpeed;
      gait = 'run';
    } else {
      speed = PLAYER.walkSpeed * (m / PLAYER.runThreshold);
      gait = m > 0.05 ? 'walk' : 'idle';
    }
    if (this.stamina.exhausted && this.sprintToggled) this.sprintToggled = false;
    if (gait === 'sprint') this.stamina.drain(PLAYER.staminaSprintDrain * dt);
    this.sprinting = gait === 'sprint';
    if (this.hitTimer > 0) speed *= 1 - PLAYER.hitSlowdown * (this.hitTimer / 0.4);
    speed *= speedScale;

    const k = Math.min(1, PLAYER.acceleration * dt);
    this.vx += (wishX * speed - this.vx) * k;
    this.vz += (wishZ * speed - this.vz) * k;

    const ox = this.x;
    const oz = this.z;
    world.physics.resolveCircle(this.x + this.vx * dt, this.z + this.vz * dt, PLAYER.radius, CF.Move, this.resolved);
    this.x = this.resolved.x;
    this.z = this.resolved.z;
    const actual = Math.hypot(this.x - ox, this.z - oz) / Math.max(dt, 1e-5);
    this.speed = actual;
    this.gait = actual > 0.15 ? gait : 'idle';

    // Facing: toward the camera while aiming or fighting, else toward movement.
    let targetYaw = this.yaw;
    if (this.aiming || this.combatFacing > 0) targetYaw = camYaw;
    else if (actual > 0.2) targetYaw = yawFromDir(this.vx, this.vz);
    this.yaw = dampAngle(this.yaw, targetYaw, PLAYER.turnSpeed, dt);

    // Footsteps make noise depending on gait and surface.
    if (this.gait !== 'idle') {
      this.stepDistance += actual * dt;
      const key = this.crouched ? 'crouch' : this.gait === 'sprint' ? 'sprint' : this.gait === 'run' ? 'run' : 'walk';
      if (this.stepDistance >= PLAYER.stepLength[key]) {
        this.stepDistance = 0;
        const surface = world.surfaceAt(this.x, this.z);
        const radius = PLAYER.noise[key] * SURFACE_NOISE[surface];
        world.noise.emit({ kind: 'footstep', x: this.x, z: this.z, radius, fromPlayer: true, priority: 1 });
        this.bus.emit('player:footstep', { x: this.x, z: this.z, surface, gait: key });
      }
    }
  }

  private updateVisibility(world: PlayerWorld): void {
    this.inGrass = world.zones.anyAt(this.x, this.z, 'grass');
    const V = PLAYER.visibility;
    let v: number = this.crouched ? V.crouched : V.standing;
    if (this.inGrass) v = this.crouched ? V.inGrassCrouched : V.inGrassStanding;
    if (this.sprinting) v *= V.sprinting;
    let light = lerp(1, V.nightDarkness, world.darkness);
    if (this.flashlightOn && this.battery > 0) light = Math.max(light, lerp(1, V.flashlightAtNight, world.darkness));
    this.visibility = v * light;
  }

  private updateFlashlight(dt: number, camYaw: number, camPitch: number, world: PlayerWorld): void {
    if (this.flashlightOn) {
      this.battery = Math.max(0, this.battery - PLAYER.flashlightDrainPerSecond * dt);
      if (this.battery <= 0) {
        this.flashlightOn = false;
        this.bus.emit('message', { text: 'Flashlight battery is dead.', kind: 'warning' });
      }
    }
    const target = this.flashlightOn ? 55 * (0.6 + 0.4 * Math.min(1, this.battery / 15)) : 0;
    this.flashlight.intensity = damp(this.flashlight.intensity, target, 20, dt);
    const d = dirFromYaw(camYaw);
    const cp = Math.cos(camPitch);
    this.flashlight.position.set(this.x + d.x * 0.3, this.y + 1.45, this.z + d.z * 0.3);
    this.flashlight.target.position.set(this.x + d.x * 10 * cp, this.y + 1.45 + Math.sin(camPitch) * 10, this.z + d.z * 10 * cp);
    void world;
  }

  toggleFlashlight(): void {
    if (!this.alive) return;
    if (!this.flashlightOn && this.battery <= 0) {
      this.bus.emit('message', { text: 'No battery. Find a flashlight battery.', kind: 'warning' });
      return;
    }
    this.flashlightOn = !this.flashlightOn;
  }

  // ---- vaulting ---------------------------------------------------------------------

  /** Checks for a low obstacle (fence, sill) directly ahead that can be vaulted. */
  findVault(physics: PhysicsWorld, dirX?: number, dirZ?: number): VaultOption | null {
    if (this.state !== 'normal') return null;
    let dx = dirX ?? 0;
    let dz = dirZ ?? 0;
    if (dirX === undefined) {
      const f = dirFromYaw(this.yaw);
      dx = f.x;
      dz = f.z;
    }
    const hit = physics.raycast(this.x, 0.55, this.z, dx, 0, dz, 1.15, CF.Vault);
    if (!hit || hit.collider.yMax > 1.35) return null;
    // Measure the obstacle's thickness by casting back at it from the far side.
    const sx = hit.x + dx * 3;
    const sz = hit.z + dz * 3;
    const back = rayBox(hit.collider, sx, 0.55, sz, -dx, 0, -dz, 3);
    if (!back) return null;
    const thickness = 3 - back.t;
    if (thickness > PLAYER.vaultMaxThickness) return null;
    const landX = back.x + dx * (PLAYER.radius + 0.15);
    const landZ = back.z + dz * (PLAYER.radius + 0.15);
    if (physics.circleBlocked(landX, landZ, PLAYER.radius, CF.Move)) return null;
    return { landingX: landX, landingZ: landZ };
  }

  startVault(v: VaultOption): void {
    this.state = 'vault';
    this.stateTimer = 0;
    this.stateDuration = PLAYER.vaultDuration;
    this.vaultFrom = { x: this.x, z: this.z };
    this.vaultTo = { x: v.landingX, z: v.landingZ };
    this.yaw = yawFromDir(v.landingX - this.x, v.landingZ - this.z);
    this.crouched = false;
    this.vx = this.vz = 0;
  }

  private updateVault(dt: number, world: PlayerWorld): void {
    this.stateTimer += dt;
    const t = clamp01(this.stateTimer / this.stateDuration);
    this.x = lerp(this.vaultFrom.x, this.vaultTo.x, t);
    this.z = lerp(this.vaultFrom.z, this.vaultTo.z, t);
    this.y = Math.sin(t * Math.PI) * 0.75;
    this.speed = 3;
    this.gait = 'run';
    if (t >= 1) {
      this.y = 0;
      this.state = 'normal';
      world.noise.emit({ kind: 'footstep', x: this.x, z: this.z, radius: PLAYER.noise.vault, fromPlayer: true, priority: 2 });
      this.bus.emit('player:vaulted', { x: this.x, z: this.z });
    }
  }

  // ---- actions ----------------------------------------------------------------------

  startTakedown(targetX: number, targetZ: number): void {
    this.state = 'takedown';
    this.stateTimer = 0;
    this.stateDuration = PLAYER.takedownDuration;
    this.yaw = yawFromDir(targetX - this.x, targetZ - this.z);
    this.playAttack('stab', PLAYER.takedownDuration * 0.8);
  }

  playAttack(style: 'swing' | 'claw' | 'shove' | 'stab', duration: number): void {
    this.attackAnim = 0;
    this.attackStyle = style;
    this.attackDuration = duration;
  }

  /** Starts using a consumable from an inventory slot. Returns false if not usable now. */
  beginUse(slot: number): boolean {
    const stack = this.inventory.getSlot(slot);
    if (!stack || this.state !== 'normal') return false;
    const def = getItem(stack.itemId);
    if (!def.effect) return false;
    if (def.effect.type === 'heal' && this.health.current >= this.health.max) {
      this.bus.emit('message', { text: 'Already at full health.', kind: 'info' });
      return false;
    }
    if (def.effect.type === 'battery' && this.battery >= 99) {
      this.bus.emit('message', { text: 'Flashlight is already charged.', kind: 'info' });
      return false;
    }
    this.state = 'using';
    this.useSlot = slot;
    this.stateTimer = 0;
    this.stateDuration = def.useTime ?? 1;
    this.weapon?.cancelReload();
    return true;
  }

  cancelUse(): void {
    if (this.state === 'using') this.state = 'normal';
  }

  private finishUse(): void {
    this.state = 'normal';
    const stack = this.inventory.getSlot(this.useSlot);
    if (!stack) return;
    const def = getItem(stack.itemId);
    const effect = def.effect;
    if (!effect) return;
    switch (effect.type) {
      case 'heal':
        if (effect.overSeconds > 0) this.healing.add(effect.amount, effect.overSeconds);
        else {
          const applied = this.health.heal(effect.amount);
          this.bus.emit('player:healed', { amount: applied, health: this.health.current });
        }
        break;
      case 'restoreStamina':
        this.stamina.restore(effect.amount);
        break;
      case 'battery':
        this.battery = Math.min(100, this.battery + effect.amount);
        break;
      case 'nourish':
        this.stamina.restore(effect.amount);
        if (effect.heal > 0) this.healing.add(effect.heal, 2);
        break;
    }
    this.inventory.remove(stack.itemId, 1, 'used');
    this.bus.emit('item:used', { itemId: def.id });
    this.bus.emit('message', { text: `Used ${def.name}`, kind: 'info', duration: 2 });
  }

  /** Returns damage applied (0 while invulnerable or dead). */
  takeDamage(amount: number, fromX: number, fromZ: number, source: string): number {
    if (!this.alive) return 0;
    const applied = this.health.damage(amount);
    if (applied <= 0) return 0;
    this.hitTimer = 0.4;
    this.health.setInvulnerable(PLAYER.hitInvulnerability);
    this.rig.pose.hit = 1;
    if (this.state === 'using') this.cancelUse();
    this.bus.emit('player:damaged', { amount: applied, health: this.health.current, from: { x: fromX, z: fromZ }, source });
    if (this.health.dead) this.die(source);
    return applied;
  }

  die(cause: string): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.flashlightOn = false;
    this.vx = this.vz = 0;
    this.speed = 0;
    this.rig.pose.dead = 0.01;
    this.bus.emit('player:died', { cause });
  }

  // ---- weapons -----------------------------------------------------------------------

  weaponSlots(): number[] {
    return this.inventory.indicesByCategory('weapon');
  }

  equip(slot: number): void {
    const stack = this.inventory.getSlot(slot);
    if (!stack) return;
    const def = getItem(stack.itemId);
    if (!def.weaponId) return;
    this.weapon?.cancelReload();
    this.equippedSlot = slot;
    this.weapon = new WeaponRuntime(getWeapon(def.weaponId), stack);
    if (this.weaponModel) this.rig.rightHand.remove(this.weaponModel.root);
    this.weaponModel = buildWeaponModel(this.weapon.def);
    this.rig.rightHand.add(this.weaponModel.root);
    this.bus.emit('weapon:equipped', { weaponId: this.weapon.def.id });
  }

  unequip(): void {
    this.weapon?.cancelReload();
    this.weapon = null;
    this.equippedSlot = -1;
    if (this.weaponModel) this.rig.rightHand.remove(this.weaponModel.root);
    this.weaponModel = null;
    this.bus.emit('weapon:equipped', { weaponId: null });
  }

  cycleWeapon(): void {
    const slots = this.weaponSlots();
    if (slots.length === 0) return;
    const i = slots.indexOf(this.equippedSlot);
    this.equip(slots[(i + 1) % slots.length]);
  }

  /** Re-validates the equipped weapon after inventory changes (drops, swaps). */
  syncEquipped(): void {
    const stack = this.equippedSlot >= 0 ? this.inventory.getSlot(this.equippedSlot) : null;
    if (stack && this.weapon && stack === this.weapon.stack) return;
    // The stack moved or was dropped: find it again or pick another weapon.
    if (this.weapon) {
      const idx = this.inventory.slots.indexOf(this.weapon.stack);
      if (idx >= 0) {
        this.equippedSlot = idx;
        return;
      }
    }
    const slots = this.weaponSlots();
    if (slots.length > 0) this.equip(slots[0]);
    else if (this.weapon) this.unequip();
  }

  muzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    if (this.weaponModel) return this.weaponModel.muzzle.getWorldPosition(out);
    return out.set(this.x, 1.4, this.z);
  }

  // ---- presentation ------------------------------------------------------------------

  private updateAnimation(dt: number): void {
    const p = this.rig.pose;
    p.speed = this.speed;
    p.gait = this.gait;
    p.crouch = this.crouched && this.state !== 'vault' ? 1 : this.state === 'vault' ? 0.5 : 0;
    p.aim = this.aiming || (this.combatFacing > 0 && !!this.weapon?.isFirearm) ? 1 : 0;
    p.aimPitch = this.aimPitch;
    p.reload = this.weapon?.reloading ? this.weapon.reloadProgress : this.state === 'using' ? this.useProgress : -1;
    p.attack = this.attackAnim;
    p.attackStyle = this.attackStyle;
    p.meleeReady = this.weapon && !this.weapon.isFirearm ? 1 : 0;
    p.hit = Math.max(0, p.hit - dt * 4);
    this.syncTransform();
    this.rig.animate(dt);
  }

  syncTransform(): void {
    this.rig.root.position.set(this.x, this.y, this.z);
    this.rig.root.rotation.y = this.yaw;
  }

  // ---- persistence -------------------------------------------------------------------

  serialize(): PlayerSaveState {
    return {
      x: this.x,
      z: this.z,
      yaw: this.yaw,
      health: this.health.current,
      stamina: this.stamina.current,
      battery: this.battery,
      flashlightOn: this.flashlightOn,
      inventory: this.inventory.serialize(),
      equippedSlot: this.equippedSlot,
    };
  }

  restore(s: PlayerSaveState): void {
    this.x = s.x;
    this.z = s.z;
    this.yaw = s.yaw;
    this.health.set(s.health);
    this.stamina.set(s.stamina);
    this.battery = s.battery;
    this.flashlightOn = s.flashlightOn;
    this.inventory.load(s.inventory);
    if (s.equippedSlot >= 0 && this.inventory.getSlot(s.equippedSlot)) this.equip(s.equippedSlot);
    else this.syncEquipped();
    this.syncTransform();
  }
}
