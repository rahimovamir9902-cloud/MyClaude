import { getItem, hasItemDef, type ItemCategory } from '../config/items';
import { getWeapon } from '../config/weapons';
import type { EventBus } from '../core/EventBus';
import type { GameEvents, ItemChangeSource } from '../core/GameEvents';
import { createLogger } from '../core/Logger';

const log = createLogger('Inventory');

export interface ItemStack {
  itemId: string;
  quantity: number;
  /** Weapon instance state: rounds currently loaded. */
  ammo?: number;
  /** Weapon instance state: remaining uses. */
  durability?: number;
}

export interface SerializedInventory {
  capacity: number;
  slots: (ItemStack | null)[];
}

export interface StackExtras {
  ammo?: number;
  durability?: number;
}

/**
 * Slot-limited inventory. Each slot holds one stack; stack sizes come from item config.
 * Limited slots force the player to choose what to carry.
 */
export class Inventory {
  private slotsData: (ItemStack | null)[];

  constructor(
    capacity: number,
    private readonly bus?: EventBus<GameEvents>,
  ) {
    if (capacity <= 0) throw new Error('Inventory capacity must be positive');
    this.slotsData = new Array(capacity).fill(null);
  }

  get capacity(): number {
    return this.slotsData.length;
  }

  get slots(): readonly (ItemStack | null)[] {
    return this.slotsData;
  }

  get usedSlots(): number {
    return this.slotsData.reduce((n, s) => n + (s ? 1 : 0), 0);
  }

  get freeSlots(): number {
    return this.capacity - this.usedSlots;
  }

  getSlot(index: number): ItemStack | null {
    return this.slotsData[index] ?? null;
  }

  count(itemId: string): number {
    let total = 0;
    for (const s of this.slotsData) if (s && s.itemId === itemId) total += s.quantity;
    return total;
  }

  has(itemId: string, quantity = 1): boolean {
    return this.count(itemId) >= quantity;
  }

  findSlot(itemId: string): number {
    return this.slotsData.findIndex((s) => s?.itemId === itemId);
  }

  /** How many units of an item could be added right now. */
  spaceFor(itemId: string): number {
    const def = getItem(itemId);
    let space = 0;
    for (const s of this.slotsData) {
      if (!s) space += def.maxStack;
      else if (s.itemId === itemId && def.maxStack > 1) space += def.maxStack - s.quantity;
    }
    return space;
  }

  canAdd(itemId: string, quantity = 1): boolean {
    return this.spaceFor(itemId) >= quantity;
  }

  /**
   * Adds items, filling existing stacks first. Returns the quantity that did NOT fit.
   */
  add(itemId: string, quantity = 1, extras: StackExtras = {}, source: ItemChangeSource = 'pickup'): number {
    if (!hasItemDef(itemId)) {
      log.warn(`Ignoring unknown item "${itemId}"`);
      return quantity;
    }
    if (quantity <= 0) return 0;
    const def = getItem(itemId);
    let remaining = quantity;

    if (def.maxStack > 1) {
      for (const s of this.slotsData) {
        if (remaining <= 0) break;
        if (s && s.itemId === itemId && s.quantity < def.maxStack) {
          const moved = Math.min(def.maxStack - s.quantity, remaining);
          s.quantity += moved;
          remaining -= moved;
        }
      }
    }
    for (let i = 0; i < this.slotsData.length && remaining > 0; i++) {
      if (this.slotsData[i]) continue;
      const moved = Math.min(def.maxStack, remaining);
      this.slotsData[i] = this.createStack(itemId, moved, extras);
      remaining -= moved;
    }

    const added = quantity - remaining;
    if (added > 0) {
      this.bus?.emit('item:added', { itemId, quantity: added, source });
      this.bus?.emit('inventory:changed', { reason: 'add' });
    }
    return remaining;
  }

  /** Adds an existing stack (keeps weapon state). Returns leftover quantity. */
  addStack(stack: ItemStack, source: ItemChangeSource = 'loot'): number {
    return this.add(stack.itemId, stack.quantity, { ammo: stack.ammo, durability: stack.durability }, source);
  }

  /** Removes up to `quantity` units across stacks. Returns the amount removed. */
  remove(itemId: string, quantity = 1, reason = 'used'): number {
    let remaining = quantity;
    // Drain from the smallest stacks first so full stacks stay intact.
    const indices = this.slotsData
      .map((s, i) => (s && s.itemId === itemId ? i : -1))
      .filter((i) => i >= 0)
      .sort((a, b) => this.slotsData[a]!.quantity - this.slotsData[b]!.quantity);
    for (const i of indices) {
      if (remaining <= 0) break;
      const s = this.slotsData[i]!;
      const taken = Math.min(s.quantity, remaining);
      s.quantity -= taken;
      remaining -= taken;
      if (s.quantity <= 0) this.slotsData[i] = null;
    }
    const removed = quantity - remaining;
    if (removed > 0) {
      this.bus?.emit('item:removed', { itemId, quantity: removed, reason });
      this.bus?.emit('inventory:changed', { reason: 'remove' });
    }
    return removed;
  }

  /** Removes from a specific slot and returns the removed portion as a new stack. */
  takeFromSlot(index: number, quantity?: number, reason = 'dropped'): ItemStack | null {
    const s = this.slotsData[index];
    if (!s) return null;
    const amount = Math.min(quantity ?? s.quantity, s.quantity);
    const taken: ItemStack = { ...s, quantity: amount };
    s.quantity -= amount;
    if (s.quantity <= 0) this.slotsData[index] = null;
    this.bus?.emit('item:removed', { itemId: s.itemId, quantity: amount, reason });
    this.bus?.emit('inventory:changed', { reason: 'take' });
    return taken;
  }

  canDrop(index: number): boolean {
    const s = this.slotsData[index];
    return !!s && !getItem(s.itemId).quest;
  }

  swap(a: number, b: number): void {
    if (a === b || a < 0 || b < 0 || a >= this.capacity || b >= this.capacity) return;
    [this.slotsData[a], this.slotsData[b]] = [this.slotsData[b], this.slotsData[a]];
    this.bus?.emit('inventory:changed', { reason: 'swap' });
  }

  indicesByCategory(category: ItemCategory): number[] {
    const out: number[] = [];
    this.slotsData.forEach((s, i) => {
      if (s && getItem(s.itemId).category === category) out.push(i);
    });
    return out;
  }

  totalWeight(): number {
    return this.slotsData.reduce((w, s) => (s ? w + getItem(s.itemId).weight * s.quantity : w), 0);
  }

  clear(): void {
    this.slotsData.fill(null);
    this.bus?.emit('inventory:changed', { reason: 'clear' });
  }

  serialize(): SerializedInventory {
    return { capacity: this.capacity, slots: this.slotsData.map((s) => (s ? { ...s } : null)) };
  }

  load(data: SerializedInventory): void {
    const capacity = Math.max(1, data.capacity | 0);
    this.slotsData = new Array(capacity).fill(null);
    data.slots.slice(0, capacity).forEach((s, i) => {
      if (!s) return;
      if (!hasItemDef(s.itemId) || !(s.quantity > 0)) {
        log.warn(`Dropping invalid saved stack in slot ${i}`, s);
        return;
      }
      const max = getItem(s.itemId).maxStack;
      this.slotsData[i] = { ...s, quantity: Math.min(s.quantity, max) };
    });
    this.bus?.emit('inventory:changed', { reason: 'load' });
  }

  private createStack(itemId: string, quantity: number, extras: StackExtras): ItemStack {
    const def = getItem(itemId);
    const stack: ItemStack = { itemId, quantity };
    if (def.weaponId) {
      const weapon = getWeapon(def.weaponId);
      stack.durability = extras.durability ?? weapon.durability;
      if (weapon.magazine > 0) stack.ammo = Math.min(extras.ammo ?? weapon.magazine, weapon.magazine);
    }
    return stack;
  }
}
