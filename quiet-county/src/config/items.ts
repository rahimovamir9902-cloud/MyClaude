export type ItemCategory = 'weapon' | 'ammo' | 'food' | 'medicine' | 'material' | 'tool' | 'quest';

export type ItemEffect =
  | { type: 'heal'; amount: number; overSeconds: number }
  | { type: 'restoreStamina'; amount: number }
  | { type: 'battery'; amount: number }
  | { type: 'nourish'; amount: number; heal: number };

export type CampResource = 'medicine' | 'food' | 'fuel' | 'materials' | 'ammo' | 'parts' | 'survivors';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  maxStack: number;
  /** Kilograms. Used for UI and future encumbrance. */
  weight: number;
  icon: string;
  effect?: ItemEffect;
  /** Seconds to use a consumable. */
  useTime?: number;
  weaponId?: string;
  quest?: boolean;
  /** What this item is worth to the camp when brought home. */
  campValue?: { resource: CampResource; amount: number };
}

const defs: ItemDef[] = [
  // Weapons (each inventory slot holds one weapon with its own ammo/durability state)
  { id: 'w_crowbar', name: 'Rustline Crowbar', category: 'weapon', weaponId: 'crowbar', maxStack: 1, weight: 2.0, icon: 'crowbar', description: 'Forged steel, chipped paint. Opens doors and skulls alike.' },
  { id: 'w_machete', name: 'Brushcutter Machete', category: 'weapon', weaponId: 'machete', maxStack: 1, weight: 1.2, icon: 'blade', description: 'A farm blade with a wrapped grip.' },
  { id: 'w_bat', name: 'Taped Ash Bat', category: 'weapon', weaponId: 'bat', maxStack: 1, weight: 1.0, icon: 'bat', description: 'Little-league ash bat wound with hockey tape.' },
  { id: 'w_pipe', name: 'Rebar-Wrapped Pipe', category: 'weapon', weaponId: 'pipe', maxStack: 1, weight: 3.2, icon: 'pipe', description: 'Water main offcut wrapped in tied rebar. Heavy.' },
  { id: 'w_knife', name: 'Trail Knife', category: 'weapon', weaponId: 'knife', maxStack: 1, weight: 0.4, icon: 'knife', description: 'Short and quiet. Ideal for takedowns.' },
  { id: 'w_c9', name: 'Corvid C9 Compact', category: 'weapon', weaponId: 'compact_pistol', maxStack: 1, weight: 0.9, icon: 'pistol', description: 'A polymer compact pistol. Reliable, but every shot carries for half a mile.' },
  { id: 'w_bramble', name: 'Bramble .44', category: 'weapon', weaponId: 'heavy_revolver', maxStack: 1, weight: 1.6, icon: 'revolver', description: 'Six heavy rounds. Ear-splitting.' },
  { id: 'w_fieldmaster', name: 'Fieldmaster 12 Pump', category: 'weapon', weaponId: 'pump_shotgun', maxStack: 1, weight: 3.6, icon: 'shotgun', description: 'Farm-store pump gun with a cracked stock.' },
  { id: 'w_twinoak', name: 'Twin-Oak Coach Gun', category: 'weapon', weaponId: 'double_shotgun', maxStack: 1, weight: 3.2, icon: 'shotgun', description: 'Side-by-side, sawn short. Two chances.' },
  { id: 'w_larkspur', name: 'Larkspur Bolt-Action', category: 'weapon', weaponId: 'hunting_rifle', maxStack: 1, weight: 3.8, icon: 'rifle', description: 'Deer rifle with a fogged scope.' },
  { id: 'w_sentry', name: 'Sentry SR-5', category: 'weapon', weaponId: 'semi_rifle', maxStack: 1, weight: 3.4, icon: 'rifle', description: 'Civilian semi-automatic rifle.' },
  { id: 'w_leafspring', name: 'Leaf-Spring Crossbow', category: 'weapon', weaponId: 'crossbow', maxStack: 1, weight: 2.6, icon: 'crossbow', description: 'Built from a truck suspension spring. Silent.' },

  // Ammunition
  { id: 'ammo_9mm', name: '9mm Rounds', category: 'ammo', maxStack: 36, weight: 0.012, icon: 'ammo', description: 'Pistol ammunition.', campValue: { resource: 'ammo', amount: 0.1 } },
  { id: 'ammo_44', name: '.44 Rounds', category: 'ammo', maxStack: 18, weight: 0.02, icon: 'ammo', description: 'Heavy revolver cartridges.' },
  { id: 'ammo_12g', name: '12-Gauge Shells', category: 'ammo', maxStack: 16, weight: 0.04, icon: 'shell', description: 'Buckshot shells.' },
  { id: 'ammo_308', name: '.308 Rounds', category: 'ammo', maxStack: 15, weight: 0.025, icon: 'ammo', description: 'Rifle cartridges.' },
  { id: 'ammo_556', name: '5.56 Rounds', category: 'ammo', maxStack: 40, weight: 0.012, icon: 'ammo', description: 'Intermediate rifle cartridges.' },
  { id: 'ammo_bolt', name: 'Steel Bolts', category: 'ammo', maxStack: 12, weight: 0.05, icon: 'bolt', description: 'Sharpened rods for the crossbow. Recoverable.' },

  // Medicine
  { id: 'bandage', name: 'Bandage', category: 'medicine', maxStack: 5, weight: 0.05, icon: 'bandage', useTime: 1.2, effect: { type: 'heal', amount: 25, overSeconds: 3 }, description: 'Clean cloth strips. Restores 25 health over a few seconds.', campValue: { resource: 'medicine', amount: 0.5 } },
  { id: 'medkit', name: 'Improvised Medkit', category: 'medicine', maxStack: 2, weight: 0.4, icon: 'medkit', useTime: 2.5, effect: { type: 'heal', amount: 60, overSeconds: 4 }, description: 'Antiseptic, gauze and tape in a lunchbox. Restores 60 health.', campValue: { resource: 'medicine', amount: 2 } },
  { id: 'painkillers', name: 'Painkillers', category: 'medicine', maxStack: 4, weight: 0.05, icon: 'pills', useTime: 0.6, effect: { type: 'heal', amount: 12, overSeconds: 0 }, description: 'Takes the edge off. Restores 12 health instantly.', campValue: { resource: 'medicine', amount: 0.5 } },

  // Food
  { id: 'canned_beans', name: 'Canned Beans', category: 'food', maxStack: 4, weight: 0.4, icon: 'can', useTime: 1.5, effect: { type: 'nourish', amount: 30, heal: 5 }, description: 'Dented but sealed.', campValue: { resource: 'food', amount: 1 } },
  { id: 'water_bottle', name: 'Water Bottle', category: 'food', maxStack: 4, weight: 0.5, icon: 'water', useTime: 1.0, effect: { type: 'restoreStamina', amount: 60 }, description: 'Restores stamina.', campValue: { resource: 'food', amount: 0.5 } },
  { id: 'energy_bar', name: 'Trail Bar', category: 'food', maxStack: 6, weight: 0.08, icon: 'bar', useTime: 0.8, effect: { type: 'nourish', amount: 15, heal: 3 }, description: 'Oats and something sweet.', campValue: { resource: 'food', amount: 0.5 } },

  // Tools
  { id: 'battery', name: 'Flashlight Battery', category: 'tool', maxStack: 4, weight: 0.05, icon: 'battery', useTime: 0.8, effect: { type: 'battery', amount: 100 }, description: 'Fully recharges the flashlight.' },
  { id: 'glass_bottle', name: 'Empty Bottle', category: 'tool', maxStack: 3, weight: 0.3, icon: 'bottle', description: 'Throw it to make a noise somewhere else.' },
  { id: 'repair_kit', name: 'Repair Kit', category: 'tool', maxStack: 2, weight: 0.6, icon: 'wrench', description: 'Restores weapon durability. (Workshop, Phase 4)' },
  { id: 'noise_maker', name: 'Rattle Can', category: 'tool', maxStack: 2, weight: 0.4, icon: 'parts', description: 'A taped tin of bolts on a wind-up timer. Throw it, wait, and let it rattle. (Phase 4)' },
  { id: 'field_ration', name: 'Field Ration', category: 'food', maxStack: 4, weight: 0.3, icon: 'bar', useTime: 1.5, effect: { type: 'nourish', amount: 50, heal: 8 }, description: 'Beans, oats and salt pressed into a brick. Not good. Filling.', campValue: { resource: 'food', amount: 1.5 } },

  // Crafting / camp materials
  { id: 'scrap_metal', name: 'Scrap Metal', category: 'material', maxStack: 10, weight: 0.5, icon: 'scrap', description: 'Bent brackets, bolts, sheet offcuts.', campValue: { resource: 'materials', amount: 1 } },
  { id: 'cloth', name: 'Cloth Scraps', category: 'material', maxStack: 10, weight: 0.1, icon: 'cloth', description: 'Useful for bandages.', campValue: { resource: 'materials', amount: 0.5 } },
  { id: 'duct_tape', name: 'Duct Tape', category: 'material', maxStack: 5, weight: 0.2, icon: 'tape', description: 'Holds the world together.', campValue: { resource: 'materials', amount: 1 } },
  { id: 'electrical_parts', name: 'Electrical Parts', category: 'material', maxStack: 6, weight: 0.3, icon: 'parts', description: 'Relays, wire, a fuse or two.', campValue: { resource: 'parts', amount: 1 } },
  { id: 'gunpowder', name: 'Gunpowder', category: 'material', maxStack: 10, weight: 0.1, icon: 'powder', description: 'Pulled from old shells.', campValue: { resource: 'ammo', amount: 0.5 } },

  // Quest items (cannot be dropped)
  { id: 'q_clinic_case', name: 'Clinic Supply Case', category: 'quest', quest: true, maxStack: 1, weight: 3.0, icon: 'case', description: 'A sealed orange case from the Calder Valley Rural Clinic. Antibiotics, saline, sutures. Noor needs this.', campValue: { resource: 'medicine', amount: 10 } },
  { id: 'q_fuel_can', name: 'Fuel Can', category: 'quest', quest: true, maxStack: 1, weight: 9.0, icon: 'fuel', description: 'Twenty liters of diesel. The mill generator runs on this.', campValue: { resource: 'fuel', amount: 5 } },
];

export const ITEMS: Readonly<Record<string, ItemDef>> = Object.freeze(
  Object.fromEntries(defs.map((d) => [d.id, d])),
);

export function getItem(id: string): ItemDef {
  const def = ITEMS[id];
  if (!def) throw new Error(`Unknown item "${id}"`);
  return def;
}

export function hasItemDef(id: string): boolean {
  return id in ITEMS;
}
