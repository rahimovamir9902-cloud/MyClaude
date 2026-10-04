import type { CampResource } from './items';

/** Harrow Mill camp facilities (Phase 3 content; logic in systems/Camp.ts). */
export type FacilityId = 'medical' | 'workshop' | 'storage' | 'armory' | 'trading' | 'missions' | 'quarters';

export interface FacilityLevel {
  cost: Partial<Record<CampResource, number>>;
  effect: string;
  /** Items handed to the player at the start of each mission. */
  startingItems?: { itemId: string; quantity: number }[];
  /** Extra stash slots at camp. */
  stash?: number;
}

export interface FacilityDef {
  id: FacilityId;
  name: string;
  description: string;
  levels: FacilityLevel[];
}

export const FACILITIES: readonly FacilityDef[] = [
  {
    id: 'medical', name: 'Medical Station', description: "Noor's clinic in the old weigh room.",
    levels: [
      { cost: { medicine: 4, materials: 2 }, effect: 'Start missions with a bandage.', startingItems: [{ itemId: 'bandage', quantity: 1 }] },
      { cost: { medicine: 10, materials: 4, parts: 1 }, effect: 'Start missions with an improvised medkit.', startingItems: [{ itemId: 'bandage', quantity: 1 }, { itemId: 'medkit', quantity: 1 }] },
    ],
  },
  {
    id: 'workshop', name: 'Workshop', description: 'A lathe, a vice and a radio that plays static.',
    levels: [
      { cost: { materials: 6, parts: 2 }, effect: 'Unlocks workbench recipes at camp.' },
      { cost: { materials: 12, parts: 5, fuel: 2 }, effect: 'Repairs carried weapons between missions.' },
    ],
  },
  {
    id: 'storage', name: 'Storage Loft', description: 'Dry shelving above the grain bins.',
    levels: [
      { cost: { materials: 5 }, effect: '+8 stash slots.', stash: 8 },
      { cost: { materials: 10, parts: 2 }, effect: '+16 stash slots.', stash: 16 },
    ],
  },
  {
    id: 'armory', name: 'Weapon Rack', description: "Teo's locked cabinet of things that go bang.",
    levels: [{ cost: { materials: 6, ammo: 2 }, effect: 'Start missions with 6 extra 9mm rounds.', startingItems: [{ itemId: 'ammo_9mm', quantity: 6 }] }],
  },
  {
    id: 'trading', name: 'Trading Table', description: 'Where passing survivors swap what they carry.',
    levels: [{ cost: { food: 6, materials: 3 }, effect: 'Opens trades with travelling survivors.' }],
  },
  {
    id: 'missions', name: 'Mission Board', description: 'A cork board, a county map and a lot of red string.',
    levels: [{ cost: {}, effect: 'Lists available missions and rumours.' }],
  },
  {
    id: 'quarters', name: 'Survivor Quarters', description: 'Cots, curtains and a little privacy.',
    levels: [{ cost: { materials: 8, fuel: 1 }, effect: 'Room for more rescued survivors.' }],
  },
];
