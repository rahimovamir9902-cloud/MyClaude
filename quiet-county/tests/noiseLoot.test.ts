import { describe, expect, it } from 'vitest';
import { NoiseSystem, type NoiseListener } from '../src/systems/NoiseSystem';
import { LootSystem, rollLootTable } from '../src/systems/LootSystem';
import { LOOT_TABLES } from '../src/config/loot';
import { ITEMS } from '../src/config/items';
import { Random } from '../src/core/Random';
import type { NoiseEvent } from '../src/core/GameEvents';

function listener(id: string, x: number, z: number, hearing = 1) {
  const heard: { e: NoiseEvent; p: number }[] = [];
  const l: NoiseListener & { heard: typeof heard } = {
    id, x, z, hearingMultiplier: hearing, canHear: true, heard,
    onNoise: (e, p) => heard.push({ e, p }),
  };
  return l;
}

const shot: NoiseEvent = { kind: 'gunshot', x: 0, z: 0, radius: 40, fromPlayer: true, priority: 8 };

describe('NoiseSystem', () => {
  it('delivers noise to listeners within the radius with distance falloff', () => {
    const ns = new NoiseSystem(null);
    const near = listener('near', 10, 0);
    const far = listener('far', 50, 0);
    ns.register(near);
    ns.register(far);
    expect(ns.emit(shot)).toBe(1);
    expect(near.heard[0].p).toBeCloseTo(0.75);
    expect(far.heard).toHaveLength(0);
  });

  it('walls muffle sound by shrinking the effective radius', () => {
    const ns = new NoiseSystem(null, { isOccluded: () => true }, 0.5);
    const a = listener('a', 15, 0);
    const b = listener('b', 25, 0);
    ns.register(a);
    ns.register(b);
    ns.emit(shot);
    expect(a.heard).toHaveLength(1);
    expect(b.heard).toHaveLength(0);
  });

  it('rain masking only affects footsteps and the HUD level decays', () => {
    const ns = new NoiseSystem(null, null, 0.5, 0.5);
    const l = listener('l', 3, 0);
    ns.register(l);
    ns.emit({ kind: 'footstep', x: 0, z: 0, radius: 4, fromPlayer: true, priority: 1 });
    expect(l.heard).toHaveLength(0);
    ns.emit(shot);
    expect(ns.playerNoiseLevel).toBe(1);
    ns.update(1);
    expect(ns.playerNoiseLevel).toBeCloseTo(0.4);
  });

  it('skips listeners that cannot hear (dead)', () => {
    const ns = new NoiseSystem(null);
    const l = { ...listener('x', 1, 0), canHear: false };
    ns.register(l);
    expect(ns.emit(shot)).toBe(0);
  });
});

describe('LootSystem', () => {
  it('is deterministic per container and world seed', () => {
    const a = new LootSystem(99).rollContainer('car_1', 'vehicle_trunk');
    const b = new LootSystem(99).rollContainer('car_1', 'vehicle_trunk');
    expect(a).toEqual(b);
  });

  it('always includes guaranteed items and respects stack sizes', () => {
    const loot = new LootSystem(5).rollContainer('office', 'office_desk', [{ itemId: 'q_clinic_case', quantity: 1 }]);
    expect(loot[0]).toEqual({ itemId: 'q_clinic_case', quantity: 1 });
    for (const s of loot) expect(s.quantity).toBeLessThanOrEqual(ITEMS[s.itemId].maxStack);
  });

  it('rolls only items from the table and handles unknown tables', () => {
    const table = LOOT_TABLES.medicine_cabinet;
    const allowed = new Set(table.entries.map((e) => e.itemId));
    const rng = new Random(1);
    for (let i = 0; i < 200; i++) for (const s of rollLootTable(table, rng)) expect(allowed.has(s.itemId)).toBe(true);
    const warn = console.warn;
    console.warn = () => {};
    expect(new LootSystem(1).rollContainer('x', 'missing_table')).toEqual([]);
    console.warn = warn;
  });

  it('every loot table references real items with valid ranges', () => {
    for (const t of Object.values(LOOT_TABLES)) {
      expect(t.rolls[0]).toBeLessThanOrEqual(t.rolls[1]);
      for (const e of t.entries) {
        expect(ITEMS[e.itemId], `${t.id} -> ${e.itemId}`).toBeDefined();
        expect(e.min).toBeGreaterThan(0);
        expect(e.min).toBeLessThanOrEqual(e.max);
        expect(ITEMS[e.itemId].quest).toBeFalsy();
      }
    }
  });
});
