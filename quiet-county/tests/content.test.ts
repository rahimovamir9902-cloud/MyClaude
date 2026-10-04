import { describe, expect, it } from 'vitest';
import { SILENT_ROAD_LEVEL as L } from '../src/config/levels/silentRoad';
import { M01_SILENT_ROAD as M } from '../src/config/missions/m01_silentRoad';
import { DLG_INES, DLG_TEO } from '../src/config/dialogue/ines';
import { ITEMS } from '../src/config/items';
import { LOOT_TABLES } from '../src/config/loot';
import { ARCHETYPES } from '../src/config/enemies';
import { conditionRefs, type Condition } from '../src/systems/Conditions';
import type { GameAction } from '../src/systems/Actions';
import type { DialogueDef } from '../src/systems/DialogueSystem';
import { inRect } from '../src/world/Zones';

/** Content lint: catches broken references in level, mission and dialogue data. */

const refs = () => ({ flags: new Set<string>(), items: new Set<string>(), zones: new Set<string>(), objectives: new Set<string>(), npcs: new Set<string>() });

function actionsOf(def: DialogueDef): GameAction[] {
  return Object.values(def.nodes).flatMap((n) => [...(n.actions ?? []), ...(n.choices ?? []).flatMap((c) => c.actions ?? [])]);
}

const containers = [
  ...L.vehicles.flatMap((v) => (v.container ? [v.container] : [])),
  ...L.props.flatMap((p) => (p.container ? [p.container] : [])),
];

describe('level data', () => {
  it('has unique ids for containers, pickups, notes, spawns and doors', () => {
    const ids = [...containers.map((c) => c.id), ...L.pickups.map((p) => p.id), ...L.notes.map((n) => n.id), ...L.spawns.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references existing loot tables and items', () => {
    for (const c of containers) {
      expect(LOOT_TABLES[c.tableId], `${c.id} table ${c.tableId}`).toBeDefined();
      for (const g of c.guaranteed ?? []) expect(ITEMS[g.itemId], `${c.id} -> ${g.itemId}`).toBeDefined();
    }
    for (const p of L.pickups) expect(ITEMS[p.itemId]).toBeDefined();
  });

  it('every door opening has a door definition and vice versa', () => {
    const openings = L.buildings.flatMap((b) => [
      ...Object.values(b.openings).flat(),
      ...(b.interiorWalls ?? []).flatMap((w) => w.openings ?? []),
    ]).filter((o) => o!.kind === 'door').map((o) => o!.doorId);
    expect(new Set(openings)).toEqual(new Set(Object.keys(L.doors)));
    for (const d of Object.values(L.doors)) if (d.talkNpc) expect(L.npcs.some((n) => n.id === d.talkNpc)).toBe(true);
  });

  it('spawns use known archetypes and sit inside the level bounds', () => {
    for (const s of L.spawns) {
      expect(ARCHETYPES[s.archetype]).toBeDefined();
      expect(inRect(L.bounds, s.x, s.z), s.id).toBe(true);
    }
    expect(inRect(L.bounds, L.playerStart.x, L.playerStart.z)).toBe(true);
  });

  it('interior props and pickups lie inside their building', () => {
    const rect = (id: string) => L.buildings.find((b) => b.id === id)!.rect;
    for (const p of L.props) if (p.interior) expect(inRect(rect(p.interior), p.x, p.z), `${p.type} at ${p.x},${p.z}`).toBe(true);
    for (const p of L.pickups) if (p.interior) expect(inRect(rect(p.interior), p.x, p.z), p.id).toBe(true);
    for (const n of L.notes) if (n.interior) expect(inRect(rect(n.interior), n.x, n.z), n.id).toBe(true);
  });
});

describe('mission data', () => {
  const allConditions: Condition[] = [
    ...M.objectives.flatMap((o) => [o.completeWhen, ...(o.revealWhen ? [o.revealWhen] : []), ...(o.failWhen ? [o.failWhen] : [])]),
    ...M.events.map((e) => e.when),
  ];
  const r = refs();
  allConditions.forEach((c) => conditionRefs(c, r));
  for (const d of [DLG_INES, DLG_TEO]) {
    d.entries.forEach((e) => e.condition && conditionRefs(e.condition, r));
    Object.values(d.nodes).forEach((n) => (n.choices ?? []).forEach((c) => c.condition && conditionRefs(c.condition, r)));
  }

  it('refers to existing zones, items, objectives and NPCs', () => {
    const zoneIds = new Set([...L.zones.map((z) => z.id), ...L.grass.flatMap((g) => (g.zoneId ? [g.zoneId] : [])), ...L.buildings.map((b) => `interior:${b.id}`)]);
    for (const z of r.zones) expect(zoneIds.has(z), `zone ${z}`).toBe(true);
    for (const i of r.items) expect(ITEMS[i], `item ${i}`).toBeDefined();
    for (const o of r.objectives) expect(M.objectives.some((x) => x.id === o), `objective ${o}`).toBe(true);
    const npcIds = new Set([...L.npcs.map((n) => n.id), L.extraction.driverNpc?.id]);
    for (const n of r.npcs) expect(npcIds.has(n), `npc ${n}`).toBe(true);
  });

  it('every flag a condition waits on can actually be set', () => {
    const producible = new Set<string>([
      ...containers.flatMap((c) => (c.setsFlag ? [c.setsFlag] : [])),
      ...L.notes.map((n) => `note:${n.id}`),
      ...['day', 'dusk', 'night', 'dawn'].map((p) => `phase:${p}`),
      ...L.spawns.flatMap((s) => (s.group ? [`group:${s.group}`] : [])),
      'extracted', 'ines_rescued',
    ]);
    const actions: GameAction[] = [...M.events.flatMap((e) => e.actions), ...M.objectives.flatMap((o) => o.onComplete ?? []), ...actionsOf(DLG_INES), ...actionsOf(DLG_TEO)];
    for (const a of actions) if (a.type === 'setFlag') producible.add(a.flag);
    for (const f of r.flags) expect(producible.has(f), `flag "${f}" is never set`).toBe(true);
  });

  it('scripted actions reference real spawn groups, alarm sources and objectives', () => {
    const actions = [...M.events.flatMap((e) => e.actions), ...M.objectives.flatMap((o) => o.onComplete ?? [])];
    for (const a of actions) {
      if (a.type === 'spawnGroup') expect(L.spawns.some((s) => s.group === a.groupId), a.groupId).toBe(true);
      if (a.type === 'alarm') expect(L.alarmSources?.[a.sourceId], a.sourceId).toBeDefined();
      if (a.type === 'revealObjective') expect(M.objectives.some((o) => o.id === a.objectiveId)).toBe(true);
    }
    expect(M.objectives.filter((o) => o.kind === 'extraction')).toHaveLength(1);
    expect(M.levelId).toBe(L.id);
  });

  it('objective markers lie inside the level', () => {
    for (const o of M.objectives) if (o.marker) expect(inRect(L.bounds, o.marker.x, o.marker.z), o.id).toBe(true);
  });
});

describe('dialogue data', () => {
  for (const d of [DLG_INES, DLG_TEO]) {
    it(`${d.id}: every link points at an existing node`, () => {
      for (const e of d.entries) expect(d.nodes[e.node], e.node).toBeDefined();
      for (const [id, n] of Object.entries(d.nodes)) {
        if (n.next) expect(d.nodes[n.next], `${id}.next`).toBeDefined();
        for (const c of n.choices ?? []) if (c.next) expect(d.nodes[c.next], `${id} -> ${c.next}`).toBeDefined();
      }
    });
  }
});
