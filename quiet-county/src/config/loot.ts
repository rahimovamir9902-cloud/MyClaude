export interface LootEntry {
  itemId: string;
  weight: number;
  min: number;
  max: number;
}

export interface LootTable {
  id: string;
  /** Number of rolls, inclusive range. */
  rolls: [number, number];
  /** Chance the container is simply empty. */
  emptyChance: number;
  entries: LootEntry[];
}

/** Loot is rolled per container from tables chosen by location type. */
const tables: LootTable[] = [
  {
    id: 'vehicle_glovebox', rolls: [1, 2], emptyChance: 0.2,
    entries: [
      { itemId: 'painkillers', weight: 3, min: 1, max: 1 },
      { itemId: 'battery', weight: 3, min: 1, max: 1 },
      { itemId: 'energy_bar', weight: 3, min: 1, max: 2 },
      { itemId: 'ammo_9mm', weight: 2, min: 3, max: 6 },
      { itemId: 'duct_tape', weight: 1, min: 1, max: 1 },
    ],
  },
  {
    id: 'vehicle_trunk', rolls: [1, 3], emptyChance: 0.15,
    entries: [
      { itemId: 'scrap_metal', weight: 4, min: 1, max: 2 },
      { itemId: 'cloth', weight: 3, min: 1, max: 3 },
      { itemId: 'water_bottle', weight: 3, min: 1, max: 1 },
      { itemId: 'canned_beans', weight: 2, min: 1, max: 1 },
      { itemId: 'glass_bottle', weight: 2, min: 1, max: 1 },
      { itemId: 'bandage', weight: 1, min: 1, max: 1 },
    ],
  },
  {
    id: 'store_shelf', rolls: [1, 2], emptyChance: 0.35,
    entries: [
      { itemId: 'canned_beans', weight: 4, min: 1, max: 2 },
      { itemId: 'energy_bar', weight: 4, min: 1, max: 2 },
      { itemId: 'water_bottle', weight: 3, min: 1, max: 1 },
      { itemId: 'battery', weight: 2, min: 1, max: 1 },
      { itemId: 'duct_tape', weight: 1, min: 1, max: 1 },
      { itemId: 'glass_bottle', weight: 2, min: 1, max: 1 },
    ],
  },
  {
    id: 'store_counter', rolls: [1, 2], emptyChance: 0.1,
    entries: [
      { itemId: 'painkillers', weight: 3, min: 1, max: 2 },
      { itemId: 'battery', weight: 3, min: 1, max: 2 },
      { itemId: 'ammo_9mm', weight: 2, min: 4, max: 8 },
      { itemId: 'energy_bar', weight: 2, min: 1, max: 1 },
    ],
  },
  {
    id: 'office_desk', rolls: [1, 2], emptyChance: 0.2,
    entries: [
      { itemId: 'painkillers', weight: 2, min: 1, max: 1 },
      { itemId: 'battery', weight: 3, min: 1, max: 1 },
      { itemId: 'electrical_parts', weight: 2, min: 1, max: 1 },
      { itemId: 'ammo_9mm', weight: 2, min: 3, max: 6 },
    ],
  },
  {
    id: 'medicine_cabinet', rolls: [1, 2], emptyChance: 0.05,
    entries: [
      { itemId: 'bandage', weight: 4, min: 1, max: 2 },
      { itemId: 'painkillers', weight: 3, min: 1, max: 2 },
      { itemId: 'medkit', weight: 1, min: 1, max: 1 },
      { itemId: 'cloth', weight: 2, min: 1, max: 2 },
    ],
  },
  {
    id: 'garage_toolbox', rolls: [1, 3], emptyChance: 0.05,
    entries: [
      { itemId: 'scrap_metal', weight: 4, min: 1, max: 3 },
      { itemId: 'electrical_parts', weight: 3, min: 1, max: 2 },
      { itemId: 'duct_tape', weight: 3, min: 1, max: 1 },
      { itemId: 'repair_kit', weight: 1, min: 1, max: 1 },
    ],
  },
  {
    id: 'locker', rolls: [1, 2], emptyChance: 0.15,
    entries: [
      { itemId: 'ammo_9mm', weight: 3, min: 4, max: 9 },
      { itemId: 'bandage', weight: 2, min: 1, max: 1 },
      { itemId: 'cloth', weight: 2, min: 1, max: 2 },
      { itemId: 'energy_bar', weight: 2, min: 1, max: 1 },
      { itemId: 'battery', weight: 1, min: 1, max: 1 },
    ],
  },
  {
    id: 'backpack', rolls: [1, 3], emptyChance: 0.1,
    entries: [
      { itemId: 'water_bottle', weight: 3, min: 1, max: 1 },
      { itemId: 'energy_bar', weight: 3, min: 1, max: 2 },
      { itemId: 'bandage', weight: 2, min: 1, max: 1 },
      { itemId: 'ammo_9mm', weight: 2, min: 3, max: 6 },
      { itemId: 'battery', weight: 2, min: 1, max: 1 },
      { itemId: 'gunpowder', weight: 1, min: 1, max: 2 },
    ],
  },
  {
    id: 'crate', rolls: [1, 2], emptyChance: 0.25,
    entries: [
      { itemId: 'scrap_metal', weight: 4, min: 1, max: 3 },
      { itemId: 'glass_bottle', weight: 3, min: 1, max: 2 },
      { itemId: 'cloth', weight: 2, min: 1, max: 2 },
      { itemId: 'canned_beans', weight: 1, min: 1, max: 1 },
    ],
  },
];

export const LOOT_TABLES: Readonly<Record<string, LootTable>> = Object.freeze(
  Object.fromEntries(tables.map((t) => [t.id, t])),
);
