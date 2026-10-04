import { describe, expect, it } from 'vitest';
import { WEAPONS, getWeapon } from '../src/config/weapons';
import { ITEMS } from '../src/config/items';
import { Inventory } from '../src/systems/Inventory';
import { WeaponRuntime, rollDamage, spreadDegrees } from '../src/systems/WeaponLogic';
import { Random } from '../src/core/Random';

function pistolSetup(ammo = 2, reserve = 10) {
  const inv = new Inventory(6);
  inv.add('w_c9', 1, { ammo });
  if (reserve) inv.add('ammo_9mm', reserve);
  const stack = inv.getSlot(inv.findSlot('w_c9'))!;
  return { inv, w: new WeaponRuntime(getWeapon('compact_pistol'), stack) };
}

describe('WeaponRuntime', () => {
  it('consumes ammo, respects fire rate and reports empty', () => {
    const { inv, w } = pistolSetup(2);
    expect(w.use()).toBeNull();
    expect(w.ammo).toBe(1);
    expect(w.use()).toBe('cooldown');
    w.update(1, inv);
    expect(w.use()).toBeNull();
    w.update(1, inv);
    expect(w.use()).toBe('empty');
  });

  it('reloads from reserve ammo after the reload time', () => {
    const { inv, w } = pistolSetup(0, 5);
    expect(w.startReload(inv)).toBe(true);
    expect(w.use()).toBe('reloading');
    w.update(1.0, inv);
    expect(w.reloading).toBe(true);
    expect(w.update(0.7, inv)).toBe(true);
    expect(w.ammo).toBe(5);
    expect(inv.count('ammo_9mm')).toBe(0);
    expect(w.startReload(inv)).toBe(false);
  });

  it('wears down and breaks', () => {
    const inv = new Inventory(2);
    inv.add('w_crowbar', 1, { durability: 2 });
    const w = new WeaponRuntime(getWeapon('crowbar'), inv.getSlot(0)!);
    expect(w.wear(1)).toBe(false);
    expect(w.wear(1)).toBe(true);
    expect(w.broken).toBe(true);
    expect(w.use()).toBe('broken');
  });

  it('melee swings do not consume ammo', () => {
    const inv = new Inventory(2);
    inv.add('w_crowbar');
    const w = new WeaponRuntime(getWeapon('crowbar'), inv.getSlot(0)!);
    expect(w.use()).toBeNull();
    expect(w.durability).toBe(getWeapon('crowbar').durability);
  });
});

describe('damage and spread', () => {
  it('applies headshot multiplier and range falloff', () => {
    const def = getWeapon('compact_pistol');
    const noCrit = { ...def, critChance: 0 };
    const rng = new Random(3);
    expect(rollDamage(noCrit, rng).amount).toBe(34);
    expect(rollDamage(noCrit, rng, { headshot: true }).amount).toBe(102);
    expect(rollDamage(noCrit, rng, { distance: 80 }).amount).toBe(Math.round(34 * 0.35));
  });

  it('aiming and crouching tighten spread; moving widens it', () => {
    const def = getWeapon('compact_pistol');
    const hip = spreadDegrees(def, { aiming: false, moving: false, crouched: false });
    const aim = spreadDegrees(def, { aiming: true, moving: false, crouched: true });
    const run = spreadDegrees(def, { aiming: false, moving: true, crouched: false });
    expect(aim).toBeLessThan(hip);
    expect(run).toBeGreaterThan(hip);
  });
});

describe('weapon config integrity', () => {
  it('defines all 12 designed weapons with sane stats', () => {
    expect(Object.keys(WEAPONS)).toHaveLength(12);
    for (const w of Object.values(WEAPONS)) {
      expect(w.damage).toBeGreaterThan(0);
      expect(w.range).toBeGreaterThan(0);
      expect(w.accuracy).toBeGreaterThan(0);
      expect(w.accuracy).toBeLessThanOrEqual(1);
      expect(w.durability).toBeGreaterThan(0);
      expect(w.fireRate).toBeGreaterThan(0);
      expect(w.critChance).toBeGreaterThanOrEqual(0);
      expect(w.critChance).toBeLessThan(1);
      expect(w.weight).toBeGreaterThan(0);
      if (w.category === 'melee') {
        expect(w.magazine).toBe(0);
        expect(w.staminaCost).toBeGreaterThan(0);
      } else {
        expect(w.magazine).toBeGreaterThan(0);
        expect(w.reloadTime).toBeGreaterThan(0);
        expect(w.ammoItem && ITEMS[w.ammoItem]).toBeTruthy();
        // Firearms must be much louder than melee, except the crossbow.
        if (w.id !== 'crossbow') expect(w.noise).toBeGreaterThan(30);
      }
    }
  });

  it('every weapon item points at a weapon definition', () => {
    for (const item of Object.values(ITEMS)) {
      if (item.category === 'weapon') expect(WEAPONS[item.weaponId!]).toBeDefined();
    }
  });
});
