/** Original crafting recipes (Phase 4 content; logic lives in systems/Crafting.ts). */
export type CraftStation = 'anywhere' | 'workbench';

export interface Recipe {
  id: string;
  name: string;
  inputs: { itemId: string; quantity: number }[];
  output: { itemId: string; quantity: number };
  station: CraftStation;
  /** Seconds of crafting time (noise-free, but you are busy). */
  time: number;
}

export const RECIPES: readonly Recipe[] = [
  { id: 'r_bandage', name: 'Bandage', inputs: [{ itemId: 'cloth', quantity: 2 }], output: { itemId: 'bandage', quantity: 1 }, station: 'anywhere', time: 2 },
  { id: 'r_medkit', name: 'Improvised Medkit', inputs: [{ itemId: 'bandage', quantity: 1 }, { itemId: 'painkillers', quantity: 1 }, { itemId: 'duct_tape', quantity: 1 }], output: { itemId: 'medkit', quantity: 1 }, station: 'anywhere', time: 4 },
  { id: 'r_noise_maker', name: 'Rattle Can', inputs: [{ itemId: 'scrap_metal', quantity: 1 }, { itemId: 'electrical_parts', quantity: 1 }, { itemId: 'duct_tape', quantity: 1 }], output: { itemId: 'noise_maker', quantity: 1 }, station: 'anywhere', time: 3 },
  { id: 'r_ammo_9mm', name: 'Hand-loaded 9mm', inputs: [{ itemId: 'gunpowder', quantity: 2 }, { itemId: 'scrap_metal', quantity: 1 }], output: { itemId: 'ammo_9mm', quantity: 6 }, station: 'workbench', time: 6 },
  { id: 'r_repair_kit', name: 'Repair Kit', inputs: [{ itemId: 'scrap_metal', quantity: 2 }, { itemId: 'duct_tape', quantity: 1 }], output: { itemId: 'repair_kit', quantity: 1 }, station: 'workbench', time: 5 },
  { id: 'r_battery', name: 'Rebuilt Battery', inputs: [{ itemId: 'electrical_parts', quantity: 2 }], output: { itemId: 'battery', quantity: 1 }, station: 'workbench', time: 4 },
  { id: 'r_ration', name: 'Field Ration', inputs: [{ itemId: 'canned_beans', quantity: 1 }, { itemId: 'energy_bar', quantity: 1 }], output: { itemId: 'field_ration', quantity: 1 }, station: 'anywhere', time: 2 },
];
