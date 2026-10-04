export type WeaponCategory = 'melee' | 'pistol' | 'shotgun' | 'rifle' | 'special';

export interface WeaponDef {
  id: string;
  name: string;
  category: WeaponCategory;
  /** Damage per hit (per pellet for shotguns). */
  damage: number;
  /** Effective range in meters. */
  range: number;
  /** 0..1, converted to cone spread. */
  accuracy: number;
  /** Camera kick in degrees per shot. */
  recoil: number;
  /** Radius in meters that infected can hear. */
  noise: number;
  /** Uses before the weapon breaks. */
  durability: number;
  /** Rounds per magazine (0 for melee). */
  magazine: number;
  /** Seconds to reload. */
  reloadTime: number;
  /** Kilograms. */
  weight: number;
  /** Shots or swings per second. */
  fireRate: number;
  /** 0..1 chance of a critical hit. */
  critChance: number;
  critMultiplier: number;
  headshotMultiplier: number;
  pellets: number;
  ammoItem: string | null;
  /** Melee only. */
  staminaCost: number;
  /** Melee swing arc in degrees. */
  arc: number;
  /** Stagger power applied to targets (0..1+). */
  stagger: number;
  automatic: boolean;
  /** Where the model's procedural mesh comes from. */
  model: 'crowbar' | 'machete' | 'bat' | 'pipe' | 'knife' | 'pistol' | 'revolver' | 'shotgun' | 'rifle' | 'crossbow';
}

type WeaponSpec = Partial<WeaponDef> & Pick<WeaponDef, 'id' | 'name' | 'category' | 'model'>;

const base: Omit<WeaponDef, 'id' | 'name' | 'category' | 'model'> = {
  damage: 30,
  range: 2,
  accuracy: 1,
  recoil: 0,
  noise: 5,
  durability: 100,
  magazine: 0,
  reloadTime: 0,
  weight: 1,
  fireRate: 1,
  critChance: 0.1,
  critMultiplier: 2,
  headshotMultiplier: 1,
  pellets: 1,
  ammoItem: null,
  staminaCost: 15,
  arc: 100,
  stagger: 0.5,
  automatic: false,
};

const defs: WeaponSpec[] = [
  // MELEE
  { id: 'crowbar', name: 'Rustline Crowbar', category: 'melee', model: 'crowbar', damage: 34, range: 1.9, noise: 6, durability: 140, weight: 2.0, fireRate: 1.25, critChance: 0.12, staminaCost: 16, arc: 100, stagger: 0.7 },
  { id: 'machete', name: 'Brushcutter Machete', category: 'melee', model: 'machete', damage: 42, range: 1.8, noise: 4, durability: 70, weight: 1.2, fireRate: 1.5, critChance: 0.2, staminaCost: 14, arc: 110, stagger: 0.4 },
  { id: 'bat', name: 'Taped Ash Bat', category: 'melee', model: 'bat', damage: 30, range: 2.1, noise: 6, durability: 90, weight: 1.0, fireRate: 1.1, critChance: 0.1, staminaCost: 18, arc: 120, stagger: 0.95 },
  { id: 'pipe', name: 'Rebar-Wrapped Pipe', category: 'melee', model: 'pipe', damage: 40, range: 2.0, noise: 8, durability: 180, weight: 3.2, fireRate: 0.9, critChance: 0.08, staminaCost: 22, arc: 100, stagger: 1.1 },
  { id: 'knife', name: 'Trail Knife', category: 'melee', model: 'knife', damage: 24, range: 1.4, noise: 2, durability: 90, weight: 0.4, fireRate: 2.2, critChance: 0.3, staminaCost: 8, arc: 70, stagger: 0.2 },

  // PISTOLS
  { id: 'compact_pistol', name: 'Corvid C9 Compact', category: 'pistol', model: 'pistol', damage: 34, range: 40, accuracy: 0.8, recoil: 2.5, noise: 42, durability: 400, magazine: 12, reloadTime: 1.6, weight: 0.9, fireRate: 3.5, critChance: 0.08, headshotMultiplier: 3, ammoItem: 'ammo_9mm', stagger: 0.5 },
  { id: 'heavy_revolver', name: 'Bramble .44', category: 'pistol', model: 'revolver', damage: 75, range: 50, accuracy: 0.84, recoil: 7, noise: 55, durability: 500, magazine: 6, reloadTime: 2.8, weight: 1.6, fireRate: 1.4, critChance: 0.12, headshotMultiplier: 3, ammoItem: 'ammo_44', stagger: 1.0 },

  // SHOTGUNS
  { id: 'pump_shotgun', name: 'Fieldmaster 12 Pump', category: 'shotgun', model: 'shotgun', damage: 14, pellets: 8, range: 18, accuracy: 0.55, recoil: 9, noise: 60, durability: 300, magazine: 6, reloadTime: 3.4, weight: 3.6, fireRate: 1.1, critChance: 0.05, headshotMultiplier: 2, ammoItem: 'ammo_12g', stagger: 1.2 },
  { id: 'double_shotgun', name: 'Twin-Oak Coach Gun', category: 'shotgun', model: 'shotgun', damage: 15, pellets: 9, range: 16, accuracy: 0.5, recoil: 11, noise: 62, durability: 260, magazine: 2, reloadTime: 2.4, weight: 3.2, fireRate: 3.0, critChance: 0.05, headshotMultiplier: 2, ammoItem: 'ammo_12g', stagger: 1.3 },

  // RIFLES
  { id: 'hunting_rifle', name: 'Larkspur Bolt-Action', category: 'rifle', model: 'rifle', damage: 110, range: 90, accuracy: 0.95, recoil: 10, noise: 70, durability: 450, magazine: 5, reloadTime: 3.0, weight: 3.8, fireRate: 0.8, critChance: 0.2, headshotMultiplier: 3, ammoItem: 'ammo_308', stagger: 1.2 },
  { id: 'semi_rifle', name: 'Sentry SR-5', category: 'rifle', model: 'rifle', damage: 48, range: 70, accuracy: 0.86, recoil: 4, noise: 65, durability: 600, magazine: 20, reloadTime: 2.6, weight: 3.4, fireRate: 5, critChance: 0.1, headshotMultiplier: 2.5, ammoItem: 'ammo_556', stagger: 0.7, automatic: true },

  // SPECIAL
  { id: 'crossbow', name: 'Leaf-Spring Crossbow', category: 'special', model: 'crossbow', damage: 90, range: 45, accuracy: 0.9, recoil: 1, noise: 5, durability: 120, magazine: 1, reloadTime: 2.2, weight: 2.6, fireRate: 0.5, critChance: 0.25, headshotMultiplier: 3, ammoItem: 'ammo_bolt', stagger: 0.8 },
];

export const WEAPONS: Readonly<Record<string, WeaponDef>> = Object.freeze(
  Object.fromEntries(defs.map((d) => [d.id, { ...base, ...d } as WeaponDef])),
);

export function getWeapon(id: string): WeaponDef {
  const def = WEAPONS[id];
  if (!def) throw new Error(`Unknown weapon "${id}"`);
  return def;
}

export function isFirearm(def: WeaponDef): boolean {
  return def.category !== 'melee';
}
