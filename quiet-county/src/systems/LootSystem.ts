import { getItem } from '../config/items';
import { LOOT_TABLES, type LootTable } from '../config/loot';
import { createLogger } from '../core/Logger';
import { Random } from '../core/Random';
import type { ItemStack } from './Inventory';

const log = createLogger('LootSystem');

/** Rolls a table into stacks, merging duplicates and splitting by max stack size. */
export function rollLootTable(table: LootTable, rng: Random): ItemStack[] {
  if (rng.chance(table.emptyChance)) return [];
  const rolls = rng.int(table.rolls[0], table.rolls[1]);
  const totals = new Map<string, number>();
  for (let i = 0; i < rolls; i++) {
    const entry = rng.weighted(table.entries);
    totals.set(entry.itemId, (totals.get(entry.itemId) ?? 0) + rng.int(entry.min, entry.max));
  }
  return splitIntoStacks(totals);
}

export function splitIntoStacks(totals: Map<string, number>): ItemStack[] {
  const out: ItemStack[] = [];
  for (const [itemId, qty] of totals) {
    const max = getItem(itemId).maxStack;
    let left = qty;
    while (left > 0) {
      const n = Math.min(max, left);
      out.push({ itemId, quantity: n });
      left -= n;
    }
  }
  return out;
}

/**
 * Procedural, deterministic loot: each container's contents derive from the world seed
 * and its id, so the same playthrough always finds the same items (and saves stay small).
 */
export class LootSystem {
  constructor(private readonly worldSeed: number) {}

  rollContainer(containerId: string, tableId: string, guaranteed: ItemStack[] = []): ItemStack[] {
    const table = LOOT_TABLES[tableId];
    const result: ItemStack[] = guaranteed.map((s) => ({ ...s }));
    if (!table) {
      if (tableId) log.warn(`Unknown loot table "${tableId}" for ${containerId}`);
      return result;
    }
    const rng = new Random(this.worldSeed).fork(containerId);
    return [...result, ...rollLootTable(table, rng)];
  }
}
