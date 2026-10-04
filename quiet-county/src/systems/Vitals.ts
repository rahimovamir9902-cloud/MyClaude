import { clamp } from '../core/math';

/** Health pool with death and temporary invulnerability (used after being hit). */
export class Health {
  private value: number;
  private invulnerableFor = 0;

  constructor(
    public max: number,
    current = max,
  ) {
    this.value = clamp(current, 0, max);
  }

  get current(): number {
    return this.value;
  }

  get fraction(): number {
    return this.value / this.max;
  }

  get dead(): boolean {
    return this.value <= 0;
  }

  get invulnerable(): boolean {
    return this.invulnerableFor > 0;
  }

  setInvulnerable(seconds: number): void {
    this.invulnerableFor = Math.max(this.invulnerableFor, seconds);
  }

  /** Returns damage actually applied. */
  damage(amount: number): number {
    if (this.dead || amount <= 0 || this.invulnerableFor > 0) return 0;
    const applied = Math.min(this.value, amount);
    this.value -= applied;
    return applied;
  }

  heal(amount: number): number {
    if (this.dead || amount <= 0) return 0;
    const applied = Math.min(this.max - this.value, amount);
    this.value += applied;
    return applied;
  }

  set(value: number): void {
    this.value = clamp(value, 0, this.max);
  }

  kill(): void {
    this.value = 0;
  }

  update(dt: number): void {
    if (this.invulnerableFor > 0) this.invulnerableFor = Math.max(0, this.invulnerableFor - dt);
  }
}

/**
 * Stamina for sprinting and melee. Running dry causes exhaustion: no sprinting until it
 * recovers past a threshold, and melee swings lose power.
 */
export class Stamina {
  private value: number;
  private regenCooldown = 0;
  private exhaustedFlag = false;

  constructor(
    public readonly max: number,
    private readonly regenRate: number,
    private readonly regenDelay: number,
    private readonly recoverThreshold: number,
  ) {
    this.value = max;
  }

  get current(): number {
    return this.value;
  }

  get fraction(): number {
    return this.value / this.max;
  }

  get exhausted(): boolean {
    return this.exhaustedFlag;
  }

  canSprint(): boolean {
    return !this.exhaustedFlag && this.value > 0;
  }

  /** Continuous drain, e.g. sprinting: amount per second * dt. */
  drain(amount: number): void {
    if (amount <= 0) return;
    this.value = Math.max(0, this.value - amount);
    this.regenCooldown = this.regenDelay;
    if (this.value <= 0) this.exhaustedFlag = true;
  }

  /**
   * Discrete cost, e.g. a melee swing. Returns the fraction of the cost that could be paid
   * (1 = full power). The action still happens but weaker when tired.
   */
  spend(cost: number): number {
    if (cost <= 0) return 1;
    const paid = Math.min(this.value, cost);
    this.value -= paid;
    this.regenCooldown = this.regenDelay;
    if (this.value <= 0) this.exhaustedFlag = true;
    return paid / cost;
  }

  restore(amount: number): void {
    this.value = Math.min(this.max, this.value + amount);
    if (this.exhaustedFlag && this.value >= this.recoverThreshold) this.exhaustedFlag = false;
  }

  set(value: number): void {
    this.value = clamp(value, 0, this.max);
    this.exhaustedFlag = this.value < this.recoverThreshold && this.exhaustedFlag;
  }

  update(dt: number): void {
    if (this.regenCooldown > 0) {
      this.regenCooldown = Math.max(0, this.regenCooldown - dt);
      return;
    }
    if (this.value < this.max) this.restore(this.regenRate * dt);
  }
}

interface HealOverTime {
  remaining: number;
  rate: number;
}

/** Applies consumable heals that tick over a few seconds. */
export class HealingQueue {
  private readonly entries: HealOverTime[] = [];

  add(amount: number, seconds: number): void {
    if (seconds <= 0) return;
    this.entries.push({ remaining: amount, rate: amount / seconds });
  }

  get active(): boolean {
    return this.entries.length > 0;
  }

  /** Returns health to apply this frame. */
  update(dt: number): number {
    let total = 0;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const e = this.entries[i];
      const tick = Math.min(e.remaining, e.rate * dt);
      e.remaining -= tick;
      total += tick;
      if (e.remaining <= 1e-6) this.entries.splice(i, 1);
    }
    return total;
  }

  clear(): void {
    this.entries.length = 0;
  }
}
