import { describe, expect, it } from 'vitest';
import { CF, PhysicsWorld, type CircleResult } from '../src/world/Physics';
import { NavGrid } from '../src/world/NavGrid';
import type { Vec2 } from '../src/core/math';

function world() {
  return new PhysicsWorld(-50, -50, 50, 50, 8);
}

describe('PhysicsWorld', () => {
  it('pushes a circle out of a box', () => {
    const w = world();
    w.add({ cx: 0, cz: 0, hx: 1, hz: 1, flags: CF.Solid });
    const out: CircleResult = { x: 0, z: 0, hit: null };
    w.resolveCircle(1.2, 0, 0.35, CF.Move, out);
    expect(out.x).toBeCloseTo(1.35);
    expect(out.hit).not.toBeNull();
  });

  it('handles rotated boxes', () => {
    const w = world();
    // 45-degree rotated thin wall through the origin.
    w.add({ cx: 0, cz: 0, hx: 3, hz: 0.1, rot: Math.PI / 4, flags: CF.Solid });
    expect(w.circleBlocked(1, -1, 0.3, CF.Move)).toBe(true); // lies on the wall line
    expect(w.circleBlocked(1, 1, 0.3, CF.Move)).toBe(false);
  });

  it('ignores low and high colliders for walking and disabled ones entirely', () => {
    const w = world();
    w.add({ cx: 0, cz: 0, hx: 1, hz: 1, yMax: 0.1, flags: CF.Solid });
    w.add({ cx: 5, cz: 0, hx: 1, hz: 1, yMin: 3, yMax: 3.3, flags: CF.Solid });
    const d = w.add({ cx: 10, cz: 0, hx: 1, hz: 1, flags: CF.Solid });
    d.enabled = false;
    expect(w.circleBlocked(0, 0, 0.3, CF.Move)).toBe(false);
    expect(w.circleBlocked(5, 0, 0.3, CF.Move)).toBe(false);
    expect(w.circleBlocked(10, 0, 0.3, CF.Move)).toBe(false);
  });

  it('raycasts return the nearest hit with a correct normal', () => {
    const w = world();
    w.add({ cx: 10, cz: 0, hx: 1, hz: 2, flags: CF.Solid, tag: 'far' });
    w.add({ cx: 5, cz: 0, hx: 0.5, hz: 2, flags: CF.Solid, tag: 'near' });
    const hit = w.raycast(0, 1, 0, 1, 0, 0, 100, CF.Bullet)!;
    expect(hit.collider.tag).toBe('near');
    expect(hit.t).toBeCloseTo(4.5);
    expect(hit.nx).toBeCloseTo(-1);
  });

  it('raycasts respect vertical extents and masks', () => {
    const w = world();
    w.add({ cx: 5, cz: 0, hx: 0.5, hz: 2, yMax: 1, flags: CF.Move | CF.Vault });
    expect(w.raycast(0, 1.5, 0, 1, 0, 0, 20, CF.Move)).toBeNull(); // over the fence
    expect(w.raycast(0, 0.5, 0, 1, 0, 0, 20, CF.Move)).not.toBeNull();
    expect(w.raycast(0, 0.5, 0, 1, 0, 0, 20, CF.Sight)).toBeNull();
    expect(w.lineClear(0, 0.5, 0, 9, 0.5, 0, CF.Move)).toBe(false);
  });

  it('raycasts across many grid cells and diagonally', () => {
    const w = world();
    w.add({ cx: 30, cz: 30, hx: 1, hz: 1, rot: 0.3, flags: CF.Solid });
    const d = Math.SQRT1_2;
    const hit = w.raycast(-40, 1, -40, d, 0, d, 200, CF.Solid);
    expect(hit).not.toBeNull();
    expect(hit!.x).toBeGreaterThan(28);
  });

  it('removes and reconfigures colliders', () => {
    const w = world();
    const c = w.add({ cx: 0, cz: 0, hx: 1, hz: 1, flags: CF.Solid });
    w.reconfigure(c, { cx: 20, cz: 0, hx: 1, hz: 1, flags: CF.Solid });
    expect(w.circleBlocked(0, 0, 0.3, CF.Move)).toBe(false);
    expect(w.circleBlocked(20, 0, 0.3, CF.Move)).toBe(true);
    w.remove(c);
    expect(w.circleBlocked(20, 0, 0.3, CF.Move)).toBe(false);
  });
});

describe('NavGrid', () => {
  function walledWorld() {
    const w = world();
    // Wall from z=-10..10 at x=0 with a gap at z in (6, 8).
    w.add({ cx: 0, cz: -2, hx: 0.2, hz: 8, flags: CF.Solid });
    w.add({ cx: 0, cz: 9.5, hx: 0.2, hz: 0.5, flags: CF.Solid });
    const nav = new NavGrid(-20, -20, 40, 40, 0.5);
    nav.bake(w, 0.35);
    return { w, nav };
  }

  it('finds a path through the gap and every waypoint is walkable', () => {
    const { nav } = walledWorld();
    const path: Vec2[] = [];
    expect(nav.findPath(-5, 0, 5, 0, path)).toBe(true);
    expect(path.length).toBeGreaterThan(1);
    const viaGap = path.some((p) => p.z > 5.5 && p.z < 8.5 && Math.abs(p.x) < 1.5);
    expect(viaGap).toBe(true);
    path.forEach((p) => expect(nav.isWalkable(p.x, p.z)).toBe(true));
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(5);
    expect(last.z).toBeCloseTo(0);
  });

  it('uses a single straight segment in open space', () => {
    const { nav } = walledWorld();
    const path: Vec2[] = [];
    nav.findPath(-15, -15, -5, -5, path);
    expect(path).toHaveLength(1);
  });

  it('fails when the goal is sealed off', () => {
    const w = world();
    w.add({ cx: 10, cz: 7, hx: 3, hz: 0.2, flags: CF.Solid });
    w.add({ cx: 10, cz: 13, hx: 3, hz: 0.2, flags: CF.Solid });
    w.add({ cx: 7, cz: 10, hx: 0.2, hz: 3, flags: CF.Solid });
    w.add({ cx: 13, cz: 10, hx: 0.2, hz: 3, flags: CF.Solid });
    const nav = new NavGrid(-20, -20, 40, 40, 0.5);
    nav.bake(w, 0.35);
    const path: Vec2[] = [];
    expect(nav.findPath(-10, -10, 10, 10, path)).toBe(false);
    expect(nav.stats.failures).toBe(1);
  });

  it('treats doors as walkable with extra cost and fences as blocked', () => {
    const w = world();
    w.add({ cx: 0, cz: 0, hx: 0.6, hz: 0.1, flags: CF.Solid | CF.Door });
    w.add({ cx: 0, cz: 5, hx: 3, hz: 0.1, yMax: 1, flags: CF.Move | CF.Vault });
    const nav = new NavGrid(-10, -10, 20, 20, 0.5);
    nav.bake(w, 0.35);
    expect(nav.isWalkable(0, 0)).toBe(true);
    expect(nav.isWalkable(0, 5)).toBe(false);
  });

  it('snaps blocked endpoints to the nearest walkable cell', () => {
    const { nav } = walledWorld();
    const p = nav.nearestWalkable(0, 0)!;
    expect(nav.isWalkable(p.x, p.z)).toBe(true);
    expect(Math.abs(p.x)).toBeLessThan(1.2);
  });
});
