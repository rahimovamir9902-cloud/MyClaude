import type { WeaponDef } from '../config/weapons';
import type { Random } from '../core/Random';
import type { Inventory, ItemStack } from './Inventory';

export type UseBlockReason = 'cooldown' | 'empty' | 'reloading' | 'broken';

/**
 * Runtime state for an equipped weapon. Ammo and durability live on the inventory stack so
 * they persist when the weapon is holstered, dropped or saved.
 */
export class WeaponRuntime {
  private cooldown = 0;
  private reloadTimer = 0;
  private reloadingFlag = false;

  constructor(
    public readonly def: WeaponDef,
    public readonly stack: ItemStack,
  ) {}

  get isFirearm(): boolean {
    return this.def.category !== 'melee';
  }

  get ammo(): number {
    return this.stack.ammo ?? 0;
  }

  get durability(): number {
    return this.stack.durability ?? this.def.durability;
  }

  get durabilityFraction(): number {
    return this.durability / this.def.durability;
  }

  get broken(): boolean {
    return this.durability <= 0;
  }

  get reloading(): boolean {
    return this.reloadingFlag;
  }

  get reloadProgress(): number {
    return this.reloadingFlag ? 1 - this.reloadTimer / this.def.reloadTime : 0;
  }

  get ready(): boolean {
    return this.cooldown <= 0 && !this.reloadingFlag;
  }

  reserveAmmo(inventory: Inventory): number {
    return this.def.ammoItem ? inventory.count(this.def.ammoItem) : 0;
  }

  canUse(): UseBlockReason | null {
    if (this.broken) return 'broken';
    if (this.reloadingFlag) return 'reloading';
    if (this.cooldown > 0) return 'cooldown';
    if (this.isFirearm && this.ammo <= 0) return 'empty';
    return null;
  }

  /**
   * Consumes one use: a round for firearms, a swing for melee. Durability for melee is
   * charged separately on hit via {@link wear}.
   */
  use(): UseBlockReason | null {
    const blocked = this.canUse();
    if (blocked) return blocked;
    this.cooldown = 1 / this.def.fireRate;
    if (this.isFirearm) {
      this.stack.ammo = this.ammo - 1;
      this.wear(1);
    }
    return null;
  }

  /** Reduces durability. Returns true if the weapon just broke. */
  wear(amount: number): boolean {
    const before = this.durability;
    this.stack.durability = Math.max(0, before - amount);
    return before > 0 && this.stack.durability <= 0;
  }

  /** Puts the weapon on cooldown without firing (e.g. a dry-fire click). */
  delay(seconds: number): void {
    this.cooldown = Math.max(this.cooldown, seconds);
  }

  needsReload(): boolean {
    return this.isFirearm && this.ammo < this.def.magazine;
  }

  startReload(inventory: Inventory): boolean {
    if (!this.isFirearm || this.reloadingFlag || this.broken) return false;
    if (this.ammo >= this.def.magazine || this.reserveAmmo(inventory) <= 0) return false;
    this.reloadingFlag = true;
    this.reloadTimer = this.def.reloadTime;
    return true;
  }

  cancelReload(): void {
    this.reloadingFlag = false;
    this.reloadTimer = 0;
  }

  /** Advances timers. Returns true on the frame a reload completes. */
  update(dt: number, inventory: Inventory): boolean {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.reloadingFlag) return false;
    this.reloadTimer -= dt;
    if (this.reloadTimer > 0) return false;
    this.reloadingFlag = false;
    this.reloadTimer = 0;
    const needed = this.def.magazine - this.ammo;
    const taken = this.def.ammoItem ? inventory.remove(this.def.ammoItem, needed, 'ammo') : 0;
    this.stack.ammo = this.ammo + taken;
    return true;
  }
}

export interface SpreadContext {
  aiming: boolean;
  moving: boolean;
  crouched: boolean;
}

/** Cone half-angle in degrees for the next shot. */
export function spreadDegrees(def: WeaponDef, ctx: SpreadContext): number {
  const base = (1 - def.accuracy) * 14;
  let mult = ctx.aiming ? 0.45 : 1.25;
  if (ctx.moving) mult *= 1.6;
  if (ctx.crouched) mult *= 0.8;
  const pelletSpread = def.pellets > 1 ? 4 : 0;
  return base * mult + pelletSpread;
}

export interface DamageRoll {
  amount: number;
  crit: boolean;
}

export function rollDamage(
  def: WeaponDef,
  rng: Random,
  opts: { headshot?: boolean; power?: number; distance?: number } = {},
): DamageRoll {
  let amount = def.damage * (opts.power ?? 1);
  if (opts.distance !== undefined && def.category !== 'melee' && opts.distance > def.range) {
    // Damage falls off beyond effective range, down to 35%.
    const over = (opts.distance - def.range) / def.range;
    amount *= Math.max(0.35, 1 - over);
  }
  const crit = rng.chance(def.critChance);
  if (crit) amount *= def.critMultiplier;
  if (opts.headshot) amount *= def.headshotMultiplier;
  return { amount: Math.round(amount), crit };
}

/** Random direction offset (yaw, pitch in radians) within a cone. */
export function sampleSpread(spreadDeg: number, rng: Random): { yaw: number; pitch: number } {
  const r = Math.sqrt(rng.next()) * spreadDeg * (Math.PI / 180);
  const theta = rng.next() * Math.PI * 2;
  return { yaw: Math.cos(theta) * r, pitch: Math.sin(theta) * r };
}
