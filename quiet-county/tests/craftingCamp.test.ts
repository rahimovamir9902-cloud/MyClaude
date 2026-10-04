import { describe, expect, it } from 'vitest';
import { Crafting } from '../src/systems/Crafting';
import { Camp } from '../src/systems/Camp';
import { Inventory } from '../src/systems/Inventory';
import { RECIPES } from '../src/config/crafting';
import { FACILITIES } from '../src/config/camp';
import { ITEMS } from '../src/config/items';
import { emptyProfile } from '../src/systems/SaveSystem';

describe('Crafting', () => {
  const crafting = new Crafting();

  it('every recipe references real items', () => {
    for (const r of RECIPES) {
      expect(ITEMS[r.output.itemId], r.id).toBeDefined();
      for (const i of r.inputs) expect(ITEMS[i.itemId], `${r.id} -> ${i.itemId}`).toBeDefined();
    }
  });

  it('consumes inputs and produces the output', () => {
    const inv = new Inventory(6);
    inv.add('cloth', 3);
    expect(crafting.craft(crafting.get('r_bandage')!, inv, 'anywhere')).toBe(true);
    expect(inv.count('cloth')).toBe(1);
    expect(inv.count('bandage')).toBe(1);
    expect(crafting.check(crafting.get('r_bandage')!, inv, 'anywhere')).toBe('missing');
  });

  it('requires a workbench for workbench recipes', () => {
    const inv = new Inventory(6);
    inv.add('gunpowder', 2);
    inv.add('scrap_metal', 1);
    const r = crafting.get('r_ammo_9mm')!;
    expect(crafting.check(r, inv, 'anywhere')).toBe('station');
    expect(crafting.craft(r, inv, 'workbench')).toBe(true);
    expect(inv.count('ammo_9mm')).toBe(6);
  });

  it('refuses when the result would not fit and leaves the bag untouched', () => {
    const inv = new Inventory(2);
    inv.add('electrical_parts', 2);
    inv.add('w_crowbar');
    // Output (battery) needs a free slot after the 2 parts are used: their slot frees up, so it fits.
    expect(crafting.check(crafting.get('r_battery')!, inv, 'workbench')).toBeNull();
    const full = new Inventory(2);
    full.add('cloth', 4);
    full.add('w_crowbar');
    // 4 cloth -> using 2 keeps the stack, no free slot for a bandage.
    expect(crafting.check(crafting.get('r_bandage')!, full, 'anywhere')).toBe('noRoom');
    expect(crafting.craft(crafting.get('r_bandage')!, full, 'anywhere')).toBe(false);
    expect(full.count('cloth')).toBe(4);
  });
});

describe('Camp', () => {
  it('upgrades facilities by spending camp resources', () => {
    const profile = emptyProfile();
    profile.campResources = { medicine: 10, materials: 3 };
    const camp = new Camp(profile);
    expect(camp.canUpgrade('medical')).toBe(true);
    expect(camp.upgrade('medical')).toBe(true);
    expect(camp.level('medical')).toBe(1);
    expect(camp.resource('medicine')).toBe(6);
    expect(camp.canUpgrade('medical')).toBe(false);
    expect(camp.startingItems()).toEqual([{ itemId: 'bandage', quantity: 1 }]);
  });

  it('applies mission rewards (except XP) and grows the stash', () => {
    const profile = emptyProfile();
    const camp = new Camp(profile);
    camp.applyRewards({
      missionId: 'm', title: '', elapsedSeconds: 1, objectives: [],
      rewards: [{ id: 'materials', label: '', amount: 6 }, { id: 'xp', label: '', amount: 100 }],
      stats: { kills: 0, takedowns: 0, headshots: 0, shotsFired: 0, containersSearched: 0, timesDetected: 0, damageTaken: 0 },
    });
    expect(camp.resource('materials')).toBe(6);
    expect(profile.campResources.xp).toBeUndefined();
    expect(camp.upgrade('storage')).toBe(true);
    expect(camp.stashSlots()).toBe(20);
  });

  it('facility data is consistent', () => {
    for (const f of FACILITIES) {
      expect(f.levels.length).toBeGreaterThan(0);
      for (const l of f.levels) for (const i of l.startingItems ?? []) expect(ITEMS[i.itemId]).toBeDefined();
    }
  });
});
