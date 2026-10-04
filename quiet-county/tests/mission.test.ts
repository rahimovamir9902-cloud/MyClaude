import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents, MissionSummary } from '../src/core/GameEvents';
import { MissionSystem, type MissionDef, type MissionWorldQuery } from '../src/systems/MissionSystem';
import type { GameAction } from '../src/systems/Actions';
import { DialogueRunner, type DialogueDef } from '../src/systems/DialogueSystem';
import { evaluateCondition } from '../src/systems/Conditions';

class FakeWorld implements MissionWorldQuery {
  flags = new Map<string, number>();
  items = new Map<string, number>();
  zones = new Set<string>();
  npcs = new Map<string, string>();
  constructor(private readonly bus: EventBus<GameEvents>) {}
  getFlag(f: string) {
    return this.flags.get(f) ?? 0;
  }
  setFlag(f: string, v = 1) {
    this.flags.set(f, v);
    this.bus.emit('flag:changed', { flag: f, value: v });
  }
  countItem(i: string) {
    return this.items.get(i) ?? 0;
  }
  isInZone(z: string) {
    return this.zones.has(z);
  }
  npcState(n: string) {
    return this.npcs.get(n) ?? null;
  }
}

const def: MissionDef = {
  id: 'test_mission',
  number: 0,
  title: 'Test',
  region: 'Nowhere',
  levelId: 'none',
  briefing: { speaker: 'X', lines: ['Go.'] },
  debriefing: 'Done.',
  startHour: 12,
  rewards: [{ id: 'medicine', label: 'Medicine', amount: 3 }],
  objectives: [
    { id: 'get_case', text: 'Get the case', kind: 'primary', completeWhen: { type: 'hasItem', itemId: 'q_clinic_case' } },
    { id: 'find_fuel', text: 'Find fuel', kind: 'secondary', completeWhen: { type: 'hasItem', itemId: 'q_fuel_can' }, reward: [{ id: 'fuel', label: 'Fuel', amount: 5 }] },
    { id: 'secret', text: 'Secret', kind: 'optional', revealWhen: { type: 'flag', flag: 'found_secret' }, completeWhen: { type: 'flag', flag: 'secret_done' } },
    { id: 'extract', text: 'Extract', kind: 'extraction', revealWhen: { type: 'objective', objectiveId: 'get_case' }, completeWhen: { type: 'flag', flag: 'extracted' } },
  ],
  events: [
    { id: 'alarm', when: { type: 'flag', flag: 'alarm' }, actions: [{ type: 'spawnGroup', groupId: 'horde' }] },
  ],
};

describe('MissionSystem', () => {
  let bus: EventBus<GameEvents>;
  let world: FakeWorld;
  let actions: GameAction[];
  let ms: MissionSystem;

  beforeEach(() => {
    bus = new EventBus<GameEvents>();
    world = new FakeWorld(bus);
    actions = [];
    ms = new MissionSystem(bus, world, (a) => actions.push(a));
    ms.start(def);
  });

  it('activates unconditional objectives and hides gated ones', () => {
    const v = Object.fromEntries(ms.objectives().map((o) => [o.id, o.status]));
    expect(v).toEqual({ get_case: 'active', find_fuel: 'active', secret: 'hidden', extract: 'hidden' });
    expect(ms.isExtractionUnlocked()).toBe(false);
  });

  it('completes objectives on item pickup and unlocks extraction', () => {
    let unlocked = false;
    bus.on('mission:extractionUnlocked', () => (unlocked = true));
    world.items.set('q_clinic_case', 1);
    bus.emit('inventory:changed', { reason: 'add' });
    ms.update(0.016);
    expect(ms.objectiveStatus('get_case')).toBe('completed');
    expect(ms.isExtractionUnlocked()).toBe(true);
    expect(unlocked).toBe(true);
  });

  it('fires scripted events once', () => {
    world.setFlag('alarm');
    ms.update(0.016);
    ms.evaluate();
    expect(actions).toEqual([{ type: 'spawnGroup', groupId: 'horde' }]);
  });

  it('completes the mission at extraction with rewards and marks missed objectives', () => {
    let summary: MissionSummary | null = null;
    bus.on('mission:completed', (e) => (summary = e.summary));
    world.items.set('q_clinic_case', 1);
    world.setFlag('extracted');
    ms.update(0.6);
    expect(ms.state).toBe('completed');
    expect(summary).not.toBeNull();
    const s = summary as unknown as MissionSummary;
    expect(s.objectives.find((o) => o.id === 'find_fuel')!.status).toBe('failed');
    expect(s.objectives.find((o) => o.id === 'secret')).toBeUndefined();
    expect(s.rewards).toEqual([{ id: 'medicine', label: 'Medicine', amount: 3 }]);
  });

  it('adds objective rewards when secondaries are done', () => {
    let summary: MissionSummary | null = null;
    bus.on('mission:completed', (e) => (summary = e.summary));
    world.items.set('q_clinic_case', 1);
    world.items.set('q_fuel_can', 1);
    bus.emit('inventory:changed', { reason: 'add' });
    ms.update(0.1);
    world.setFlag('extracted');
    ms.update(0.1);
    expect((summary as unknown as MissionSummary).rewards.map((r) => r.id)).toEqual(['medicine', 'fuel']);
  });

  it('tracks stats from bus events and fails on demand', () => {
    bus.emit('enemy:killed', { id: 'e1', archetype: 'common', takedown: true, headshot: false });
    bus.emit('weapon:fired', { weaponId: 'compact_pistol', x: 0, y: 0, z: 0 });
    expect(ms.stats.kills).toBe(1);
    expect(ms.stats.takedowns).toBe(1);
    expect(ms.stats.shotsFired).toBe(1);
    let reason = '';
    bus.on('mission:failed', (e) => (reason = e.reason));
    ms.fail('player_dead');
    expect(ms.state).toBe('failed');
    expect(reason).toBe('player_dead');
  });

  it('serializes and restores without re-running fired events', () => {
    world.setFlag('alarm');
    world.items.set('q_clinic_case', 1);
    bus.emit('inventory:changed', { reason: 'x' });
    ms.update(0.1);
    const saved = JSON.parse(JSON.stringify(ms.serialize()));
    const actions2: GameAction[] = [];
    const ms2 = new MissionSystem(bus, world, (a) => actions2.push(a));
    ms2.start(def, saved);
    expect(ms2.objectiveStatus('get_case')).toBe('completed');
    expect(ms2.isExtractionUnlocked()).toBe(true);
    expect(actions2).toHaveLength(0);
  });
});

const dialogue: DialogueDef = {
  id: 'd',
  npcId: 'npc',
  entries: [
    { condition: { type: 'flag', flag: 'met' }, node: 'again' },
    { node: 'hello' },
  ],
  nodes: {
    hello: {
      speaker: 'NPC', text: 'Hi.', actions: [{ type: 'setFlag', flag: 'met' }],
      choices: [
        { text: 'Give bandage', next: 'thanks', condition: { type: 'hasItem', itemId: 'bandage' }, actions: [{ type: 'takeItem', itemId: 'bandage', quantity: 1 }] },
        { text: 'Who are you?', next: 'who', once: true },
        { text: 'Bye', next: null },
      ],
    },
    who: { speaker: 'NPC', text: 'Nobody.', next: 'hello' },
    thanks: { speaker: 'NPC', text: 'Thanks.', next: null },
    again: { speaker: 'NPC', text: 'You again.', next: null },
  },
};

describe('DialogueRunner', () => {
  function ctxWith(items: Record<string, number>, flags: Record<string, number> = {}) {
    return {
      getFlag: (f: string) => flags[f] ?? 0,
      countItem: (i: string) => items[i] ?? 0,
      isInZone: () => false,
      objectiveStatus: () => null,
      killCount: () => 0,
      npcState: () => null,
    };
  }

  it('filters choices by condition and runs actions', () => {
    const actions: GameAction[] = [];
    const r = new DialogueRunner(dialogue, ctxWith({}), (a) => actions.push(a));
    r.start();
    expect(r.choices().map((c) => c.text)).toEqual(['Who are you?', 'Bye']);
    expect(actions[0]).toEqual({ type: 'setFlag', flag: 'met' });
  });

  it('hides once-only choices after use and ends on null', () => {
    const r = new DialogueRunner(dialogue, ctxWith({ bandage: 1 }), () => {});
    r.start();
    r.choose(1);
    expect(r.node!.text).toBe('Nobody.');
    r.continue();
    expect(r.choices().map((c) => c.text)).toEqual(['Give bandage', 'Bye']);
    r.choose(0);
    expect(r.node!.text).toBe('Thanks.');
    r.continue();
    expect(r.finished).toBe(true);
  });

  it('picks the entry node from conditions and rejects hidden choices', () => {
    const r = new DialogueRunner(dialogue, ctxWith({}, { met: 1 }), () => {});
    expect(r.start()!.text).toBe('You again.');
    const r2 = new DialogueRunner(dialogue, ctxWith({}), () => {});
    r2.start();
    r2.choose(0); // hidden (no bandage) -> ignored
    expect(r2.node!.text).toBe('Hi.');
  });
});

describe('Conditions', () => {
  it('composes all/any/not', () => {
    const ctx = { getFlag: (f: string) => (f === 'a' ? 1 : 0), countItem: () => 0, isInZone: () => true, objectiveStatus: () => null, killCount: () => 3, npcState: () => 'following' };
    expect(evaluateCondition({ type: 'all', of: [{ type: 'flag', flag: 'a' }, { type: 'inZone', zoneId: 'z' }] }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'any', of: [{ type: 'flag', flag: 'b' }, { type: 'killCount', atLeast: 4 }] }, ctx)).toBe(false);
    expect(evaluateCondition({ type: 'not', of: { type: 'flag', flag: 'b' } }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'npcState', npcId: 'x', state: 'following' }, ctx)).toBe(true);
  });
});
