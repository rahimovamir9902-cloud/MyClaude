import { describe, expect, it } from 'vitest';
import { MemoryStorage, SaveSystem, emptyProfile, migrateSave, validateSave, type SaveData } from '../src/systems/SaveSystem';
import { WorldState } from '../src/systems/WorldState';
import { Inventory } from '../src/systems/Inventory';

function sampleData(x = 3): SaveData {
  const inv = new Inventory(12);
  inv.add('w_c9', 1, { ammo: 4 });
  inv.add('bandage', 2);
  const world = new WorldState();
  world.setFlag('car_alarm_triggered');
  world.containers.set('car_a', { searched: true, contents: [{ itemId: 'cloth', quantity: 1 }] });
  world.doors.set('office_door', { open: true, locked: false });
  world.deadEnemies.add('road_1');
  return {
    levelId: 'silent_road',
    profile: emptyProfile(),
    mission: { missionId: 'm01', objectives: { a: 'completed' }, firedEvents: ['alarm'], elapsed: 120, stats: { kills: 1, takedowns: 0, headshots: 0, shotsFired: 2, containersSearched: 1, timesDetected: 1, damageTaken: 5 } },
    player: { x, z: -4, yaw: 1, health: 77, stamina: 50, battery: 80, flashlightOn: false, inventory: inv.serialize(), equippedSlot: 0 },
    world: world.serialize(),
    npcs: { ines: { state: 'following', x: 1, z: 2, relationship: 10, health: 60 } },
    time: { hour: 19.5, day: 1 },
    weather: { rain: 0 },
  };
}

describe('SaveSystem', () => {
  it('round-trips a full save through storage', async () => {
    const store = new MemoryStorage();
    const saves = new SaveSystem(store);
    expect(await saves.save('auto', sampleData(), 'Checkpoint')).toBe(true);
    const loaded = await saves.load('auto');
    expect(loaded).not.toBeNull();
    expect(loaded!.data.player.health).toBe(77);
    const world = new WorldState();
    world.load(loaded!.data.world);
    expect(world.getFlag('car_alarm_triggered')).toBe(1);
    expect(world.containers.get('car_a')!.contents).toHaveLength(1);
    expect(world.deadEnemies.has('road_1')).toBe(true);
    const inv = new Inventory(1);
    inv.load(loaded!.data.player.inventory);
    expect(inv.count('bandage')).toBe(2);
  });

  it('returns the most recent slot', async () => {
    const saves = new SaveSystem(new MemoryStorage());
    await saves.save('manual', sampleData(1), 'Manual');
    await new Promise((r) => setTimeout(r, 5));
    await saves.save('auto', sampleData(2), 'Auto');
    expect((await saves.latest())!.data.player.x).toBe(2);
  });

  it('falls back to the backup copy when the primary is corrupted', async () => {
    const store = new MemoryStorage();
    const saves = new SaveSystem(store);
    await saves.save('manual', sampleData(1), 'First');
    await saves.save('manual', sampleData(2), 'Second');
    store.data.set('qc.save.manual', '{not json');
    const warn = console.warn;
    console.warn = () => {};
    const loaded = await saves.load('manual');
    console.warn = warn;
    expect(loaded!.data.player.x).toBe(1);
  });

  it('rejects structurally invalid saves', () => {
    expect(() => validateSave({ version: 1 })).toThrow();
    expect(() => validateSave({ version: 1, savedAt: 1, slot: 'auto', data: { levelId: 'x', player: { x: NaN } } })).toThrow();
  });

  it('migrates older versions and refuses newer ones', () => {
    const old = { version: 0, savedAt: 1, slot: 'auto', manual: false, label: '', data: { ...sampleData(), weather: undefined } };
    const migrated = migrateSave(old as unknown as Record<string, unknown>) as unknown as { version: number; data: SaveData };
    expect(migrated.version).toBe(1);
    expect(migrated.data.weather).toEqual({ rain: 0 });
    expect(() => migrateSave({ version: 99 })).toThrow();
  });

  it('reports failures when storage throws', async () => {
    const saves = new SaveSystem({
      getItem: async () => null,
      setItem: async () => {
        throw new Error('quota');
      },
      removeItem: async () => {},
    });
    const err = console.error;
    console.error = () => {};
    expect(await saves.save('auto', sampleData(), 'x')).toBe(false);
    console.error = err;
  });

  it('persists a profile separately', async () => {
    const saves = new SaveSystem(new MemoryStorage());
    expect((await saves.loadProfile()).completedMissions).toEqual([]);
    await saves.saveProfile({ ...emptyProfile(), completedMissions: ['m01'], campResources: { medicine: 10 } });
    expect((await saves.loadProfile()).campResources.medicine).toBe(10);
  });
});
