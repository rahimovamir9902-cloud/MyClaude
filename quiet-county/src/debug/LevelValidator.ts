import type { BuiltLevel } from '../world/LevelBuilder';
import { CF } from '../world/Physics';

export interface LevelIssue {
  kind: string;
  id: string;
  message: string;
}

/**
 * Automated level QA: flood-fills the navigation grid from the player start and checks that
 * every objective, container, pickup, note, save point, NPC and spawn is reachable and not
 * embedded in geometry.
 */
export function validateLevel(level: BuiltLevel): LevelIssue[] {
  const issues: LevelIssue[] = [];
  const nav = level.nav;
  const start = level.def.playerStart;
  const reach = new Uint8Array(nav.cellCount);
  const s = nav.nearestWalkable(start.x, start.z, 4);
  if (!s) return [{ kind: 'start', id: 'player', message: 'Player start is not walkable' }];
  const queue: number[] = [nav.indexAt(s.x, s.z)];
  reach[queue[0]] = 1;
  while (queue.length) {
    const i = queue.pop()!;
    const c = i % nav.cols;
    const r = (i - c) / nav.cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= nav.cols || nr >= nav.rows) continue;
      const n = nr * nav.cols + nc;
      if (reach[n] || !nav.isWalkableIndex(n)) continue;
      reach[n] = 1;
      queue.push(n);
    }
  }
  const reachable = (x: number, z: number, radius = 2.2) => {
    const p = nav.nearestWalkable(x, z, Math.ceil(radius / nav.cellSize));
    return !!p && reach[nav.indexAt(p.x, p.z)] === 1;
  };
  const check = (kind: string, id: string, x: number, z: number, radius?: number) => {
    if (!reachable(x, z, radius)) issues.push({ kind, id, message: `${kind} ${id} at (${x.toFixed(1)}, ${z.toFixed(1)}) is unreachable` });
  };
  for (const c of level.containers.values()) check('container', c.id, c.x, c.z);
  for (const p of level.pickups.values()) check('pickup', p.id, p.x, p.z);
  for (const n of level.notes.values()) check('note', n.id, n.x, n.z);
  for (const sp of level.savePoints) check('save', sp.id, sp.x, sp.z);
  for (const n of level.npcs) check('npc', n.id, n.x, n.z);
  check('extraction', 'extraction', level.extraction.x, level.extraction.z);
  for (const sp of level.spawns) {
    if (level.physics.circleBlocked(sp.x, sp.z, 0.3, CF.Move)) issues.push({ kind: 'spawn', id: sp.id, message: `spawn ${sp.id} is inside geometry` });
    check('spawn', sp.id, sp.x, sp.z, 1.5);
  }
  if (level.physics.circleBlocked(start.x, start.z, 0.35, CF.Move)) issues.push({ kind: 'start', id: 'player', message: 'Player start is inside geometry' });
  return issues;
}
