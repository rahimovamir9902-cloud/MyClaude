import { describe, expect, it } from 'vitest';
import { Inventory } from '../src/systems/Inventory';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/core/GameEvents';

describe('Inventory', () => {
  it('stacks up to the item max and spills into new slots', () => {
    const inv = new Inventory(3);
    expect(inv.add('ammo_9mm', 50)).toBe(0); // max stack 36
    expect(inv.usedSlots).toBe(2);
    expect(inv.count('ammo_9mm')).toBe(50);
    expect(inv.getSlot(0)!.quantity).toBe(36);
  });

  it('returns leftovers when full and reports space correctly', () => {
    const inv = new Inventory(2);
    inv.add('w_crowbar');
    inv.add('bandage', 5);
    expect(inv.canAdd('bandage')).toBe(false);
    expect(inv.spaceFor('bandage')).toBe(0);
    expect(inv.add('bandage', 2)).toBe(2);
    expect(inv.add('painkillers', 1)).toBe(1);
  });

  it('initialises weapon instance state from config', () => {
    const inv = new Inventory(4);
    inv.add('w_c9', 1, { ammo: 5 });
    inv.add('w_crowbar');
    const pistol = inv.getSlot(inv.findSlot('w_c9'))!;
    expect(pistol.ammo).toBe(5);
    expect(pistol.durability).toBe(400);
    expect(inv.getSlot(inv.findSlot('w_crowbar'))!.ammo).toBeUndefined();
  });

  it('removes from smallest stacks first and frees empty slots', () => {
    const inv = new Inventory(4);
    inv.add('ammo_9mm', 40); // 36 + 4
    expect(inv.remove('ammo_9mm', 6)).toBe(6);
    expect(inv.count('ammo_9mm')).toBe(34);
    expect(inv.usedSlots).toBe(1);
    expect(inv.remove('ammo_9mm', 100)).toBe(34);
    expect(inv.usedSlots).toBe(0);
  });

  it('protects quest items from being dropped', () => {
    const inv = new Inventory(4);
    inv.add('q_clinic_case');
    inv.add('cloth', 2);
    expect(inv.canDrop(inv.findSlot('q_clinic_case'))).toBe(false);
    expect(inv.canDrop(inv.findSlot('cloth'))).toBe(true);
  });

  it('emits events and round-trips through serialization', () => {
    const bus = new EventBus<GameEvents>();
    const added: string[] = [];
    bus.on('item:added', (e) => added.push(`${e.itemId}x${e.quantity}`));
    const inv = new Inventory(5, bus);
    inv.add('w_c9', 1, { ammo: 3, durability: 120 });
    inv.add('battery', 2);
    const data = inv.serialize();
    const copy = new Inventory(1);
    copy.load(JSON.parse(JSON.stringify(data)));
    expect(copy.capacity).toBe(5);
    expect(copy.count('battery')).toBe(2);
    expect(copy.getSlot(copy.findSlot('w_c9'))).toMatchObject({ ammo: 3, durability: 120 });
    expect(added).toEqual(['w_c9x1', 'batteryx2']);
  });

  it('ignores unknown or corrupted saved stacks', () => {
    const inv = new Inventory(3);
    const spy = console.warn;
    console.warn = () => {};
    inv.load({ capacity: 3, slots: [{ itemId: 'nope', quantity: 1 }, { itemId: 'bandage', quantity: 99 }, null] });
    console.warn = spy;
    expect(inv.getSlot(0)).toBeNull();
    expect(inv.getSlot(1)!.quantity).toBe(5);
  });

  it('takes a partial stack out of a slot', () => {
    const inv = new Inventory(3);
    inv.add('cloth', 6);
    const taken = inv.takeFromSlot(0, 2)!;
    expect(taken).toEqual({ itemId: 'cloth', quantity: 2 });
    expect(inv.count('cloth')).toBe(4);
  });
});
