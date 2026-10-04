import * as THREE from 'three';
import { boxGeo, groundPlaneGeo, paintVertexColors } from '../../render/geometry';
import type { MaterialId } from '../../render/Materials';
import { CF } from '../Physics';
import { Door } from '../WorldObjects';
import type { BuildingDef, DoorDef, Opening, ZoneDef } from '../LevelTypes';
import { doorLeafGeometry } from './props';
import type { BuildContext } from './PropBuilder';

export interface BuiltBuilding {
  def: BuildingDef;
  interiorLayer: string;
  roofLayer: string;
  zone: ZoneDef;
  doors: Door[];
}

const WALL_T = 0.25;
const INNER_T = 0.15;

interface RunSpec {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  thickness: number;
  height: number;
  openings: Opening[];
  /** Unit normal pointing into the building. */
  inX: number;
  inZ: number;
  outerMat: MaterialId;
  outerColor: number;
  innerMat: MaterialId;
  innerColor: number;
  exterior: boolean;
  shellLayer: string;
  interiorLayer: string;
}

/**
 * Builds a walled building with door, window, broken-window (vaultable) and gap openings,
 * interior partitions, a floor and a hideable roof. Exterior faces go in the always-visible
 * shell; interior paneling and props go in an interior layer that can be culled.
 */
export function buildBuilding(ctx: BuildContext, def: BuildingDef, doorDefs: Record<string, DoorDef>): BuiltBuilding {
  const { x0, z0, x1, z1 } = def.rect;
  const h = def.height;
  const t = WALL_T;
  const interiorLayer = `interior:${def.id}`;
  const roofLayer = `roof:${def.id}`;
  const doors: Door[] = [];
  const common = {
    thickness: t,
    height: h,
    outerMat: def.wallMaterial,
    outerColor: def.wallColor,
    innerMat: def.interiorMaterial,
    innerColor: def.interiorColor,
    exterior: true,
    shellLayer: 'world',
    interiorLayer,
  };
  // North (z0), south (z1) run along +X; west (x0), east (x1) run along +Z.
  wallRun(ctx, { ...common, ax: x0, az: z0 + t / 2, bx: x1, bz: z0 + t / 2, inX: 0, inZ: 1, openings: def.openings.n ?? [] }, def, doorDefs, doors);
  wallRun(ctx, { ...common, ax: x0, az: z1 - t / 2, bx: x1, bz: z1 - t / 2, inX: 0, inZ: -1, openings: def.openings.s ?? [] }, def, doorDefs, doors);
  wallRun(ctx, { ...common, ax: x0 + t / 2, az: z0 + t, bx: x0 + t / 2, bz: z1 - t, inX: 1, inZ: 0, openings: shift(def.openings.w ?? [], -t) }, def, doorDefs, doors);
  wallRun(ctx, { ...common, ax: x1 - t / 2, az: z0 + t, bx: x1 - t / 2, bz: z1 - t, inX: -1, inZ: 0, openings: shift(def.openings.e ?? [], -t) }, def, doorDefs, doors);

  for (const iw of def.interiorWalls ?? []) {
    const alongX = Math.abs(iw.z1 - iw.z0) < Math.abs(iw.x1 - iw.x0);
    wallRun(ctx, {
      ...common,
      thickness: INNER_T,
      height: h - 0.05,
      ax: iw.x0, az: iw.z0, bx: iw.x1, bz: iw.z1,
      inX: alongX ? 0 : 1, inZ: alongX ? 1 : 0,
      openings: iw.openings ?? [],
      outerMat: def.interiorMaterial,
      outerColor: def.interiorColor,
      exterior: false,
      shellLayer: interiorLayer,
    }, def, doorDefs, doors);
  }

  // Floor (visible through doorways, so it lives in the shell).
  const floor = groundPlaneGeo(x1 - x0 - t * 2, z1 - z0 - t * 2);
  ctx.batcher.add(floor, def.floorMaterial, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, 0.025, (z0 + z1) / 2), def.floorColor ?? 0xffffff, 'world');

  // Roof slab + trim, hidden while the player is inside.
  const roofW = x1 - x0 + 0.5;
  const roofD = z1 - z0 + 0.5;
  ctx.batcher.add(boxGeo(roofW, 0.25, roofD), def.roofMaterial, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, h + 0.125, (z0 + z1) / 2), def.roofColor ?? 0xffffff, roofLayer);
  const trim = def.trimColor ?? 0x4a4440;
  ctx.batcher.add(boxGeo(roofW + 0.04, 0.3, 0.12), 'paint', new THREE.Matrix4().makeTranslation((x0 + x1) / 2, h + 0.15, z0 - 0.25), trim, 'world');
  ctx.batcher.add(boxGeo(roofW + 0.04, 0.3, 0.12), 'paint', new THREE.Matrix4().makeTranslation((x0 + x1) / 2, h + 0.15, z1 + 0.25), trim, 'world');
  ctx.batcher.add(boxGeo(0.12, 0.3, roofD + 0.04), 'paint', new THREE.Matrix4().makeTranslation(x0 - 0.25, h + 0.15, (z0 + z1) / 2), trim, 'world');
  ctx.batcher.add(boxGeo(0.12, 0.3, roofD + 0.04), 'paint', new THREE.Matrix4().makeTranslation(x1 + 0.25, h + 0.15, (z0 + z1) / 2), trim, 'world');
  // Rooftop clutter: HVAC box.
  ctx.batcher.add(boxGeo(1.6, 0.9, 1.2), 'rust', new THREE.Matrix4().makeTranslation(x0 + (x1 - x0) * 0.7, h + 0.7, z0 + (z1 - z0) * 0.35), 0x9a9c98, roofLayer);

  const zone: ZoneDef = {
    id: `interior:${def.id}`,
    label: def.name,
    kind: 'interior',
    rect: { x0: x0 + t * 0.5, z0: z0 + t * 0.5, x1: x1 - t * 0.5, z1: z1 - t * 0.5 },
  };
  return { def, interiorLayer, roofLayer, zone, doors };
}

function shift(openings: Opening[], by: number): Opening[] {
  return openings.map((o) => ({ ...o, at: o.at + by }));
}

function wallRun(ctx: BuildContext, r: RunSpec, def: BuildingDef, doorDefs: Record<string, DoorDef>, doors: Door[]): void {
  const dx = r.bx - r.ax;
  const dz = r.bz - r.az;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return;
  const ux = dx / len;
  const uz = dz / len;
  const rot = Math.atan2(-uz, ux);
  const openings = r.openings.slice().sort((a, b) => a.at - b.at);

  const piece = (s0: number, s1: number, y0: number, y1: number, flags: number, mat?: MaterialId, color?: number) => {
    const w = s1 - s0;
    const hh = y1 - y0;
    if (w < 0.01 || hh < 0.01) return;
    const mid = (s0 + s1) / 2;
    const cx = r.ax + ux * mid;
    const cz = r.az + uz * mid;
    const m = new THREE.Matrix4().makeRotationY(rot).setPosition(cx, y0 + hh / 2, cz);
    ctx.batcher.add(boxGeo(w, hh, r.thickness), mat ?? r.outerMat, m, color ?? r.outerColor, r.shellLayer, r.exterior ? 0.25 : 0.1);
    if (r.exterior) {
      // Interior paneling just inside the exterior wall.
      const off = r.thickness / 2 + 0.012;
      const pm = new THREE.Matrix4().makeRotationY(rot).setPosition(cx + r.inX * off, y0 + hh / 2, cz + r.inZ * off);
      ctx.batcher.add(boxGeo(w, Math.max(0.01, hh - 0.02), 0.02), r.innerMat, pm, r.innerColor, r.interiorLayer);
    }
    if (flags) {
      ctx.physics.add({ cx, cz, hx: w / 2, hz: r.thickness / 2 + 0.02, rot, yMin: y0, yMax: y1, flags, tag: `wall:${def.id}` });
    }
  };

  let cursor = 0;
  for (const o of openings) {
    const s0 = Math.max(0, o.at);
    const s1 = Math.min(len, o.at + o.width);
    piece(cursor, s0, 0, r.height, CF.Solid | CF.Sound);
    cursor = s1;
    const top = o.top ?? (o.kind === 'gap' ? 2.6 : o.kind === 'door' ? 2.2 : 2.2);
    // Lintel above every opening.
    piece(s0, s1, top, r.height, CF.Solid | CF.Sound);
    if (o.kind === 'window' || o.kind === 'brokenWindow') {
      const sill = o.sill ?? 0.9;
      const sillFlags = o.kind === 'brokenWindow' ? CF.Move | CF.Bullet | CF.Vault : CF.Move | CF.Bullet | CF.Camera | CF.Sound;
      piece(s0, s1, 0, sill, sillFlags);
      const mid = (s0 + s1) / 2;
      const cx = r.ax + ux * mid;
      const cz = r.az + uz * mid;
      if (o.kind === 'window') {
        // Intact glass: blocks movement and bullets but not sight (stealth matters).
        const gm = new THREE.Matrix4().makeRotationY(rot).setPosition(cx, (sill + top) / 2, cz);
        ctx.batcher.add(boxGeo(s1 - s0, top - sill, 0.04), 'glass', gm, 0xffffff, 'world');
        ctx.physics.add({ cx, cz, hx: (s1 - s0) / 2, hz: 0.08, rot, yMin: sill, yMax: top, flags: CF.Move | CF.Bullet | CF.Camera | CF.Sound, tag: 'window' });
      } else {
        // Jagged shards left in the frame.
        for (let i = 0; i < 4; i++) {
          const sx = s0 + 0.1 + ctx.rng.next() * (s1 - s0 - 0.2);
          const sm = new THREE.Matrix4()
            .makeRotationY(rot)
            .multiply(new THREE.Matrix4().makeRotationZ(ctx.rng.range(-0.6, 0.6)))
            .setPosition(r.ax + ux * sx, i % 2 ? top - 0.12 : sill + 0.1, r.az + uz * sx);
          ctx.batcher.add(boxGeo(0.08, 0.25, 0.02), 'glass', sm, 0xd0d8e0, 'world');
        }
      }
    } else if (o.kind === 'door' && o.doorId) {
      doors.push(createDoor(ctx, o, s0, s1, r, ux, uz, rot, doorDefs));
    }
  }
  piece(cursor, len, 0, r.height, CF.Solid | CF.Sound);
}

function createDoor(
  ctx: BuildContext, o: Opening, s0: number, s1: number, r: RunSpec,
  ux: number, uz: number, rot: number, doorDefs: Record<string, DoorDef>,
): Door {
  const id = o.doorId!;
  const dd: DoorDef = doorDefs[id] ?? { label: 'Door', lock: 'none', material: 'wood', color: 0x7a6044 };
  const width = s1 - s0;
  const leafH = Math.min(2.15, (o.top ?? 2.2) - 0.03);
  const parent = ctx.interiorExtras.get('__doors') ?? ctx.dynamicRoot;
  const leaves: THREE.Object3D[] = [];
  const mat = ctx.materials.get(dd.material);
  const makeLeaf = (s: number, w: number, baseRot: number) => {
    const g = doorLeafGeometry(w - 0.04, leafH, 0.06);
    paintVertexColors(g, dd.color);
    const pivot = new THREE.Object3D();
    pivot.position.set(r.ax + ux * s, 0.02, r.az + uz * s);
    pivot.rotation.y = baseRot;
    pivot.userData.baseRot = baseRot;
    const mesh = new THREE.Mesh(g, mat);
    mesh.castShadow = false;
    pivot.add(mesh);
    // Push bar / handle.
    const hg = boxGeo(0.05, 0.05, 0.16);
    paintVertexColors(hg, 0x9a9a98);
    const handle = new THREE.Mesh(hg, ctx.materials.get('paint'));
    handle.position.set(w - 0.16, 1.0, 0);
    pivot.add(handle);
    parent.add(pivot);
    leaves.push(pivot);
  };
  if (dd.double) {
    makeLeaf(s0, width / 2, rot);
    makeLeaf(s1, width / 2, rot + Math.PI);
  } else {
    makeLeaf(s0, width, rot);
  }
  const mid = (s0 + s1) / 2;
  const cx = r.ax + ux * mid;
  const cz = r.az + uz * mid;
  const collider = ctx.physics.add({
    cx, cz, hx: width / 2, hz: 0.1, rot, yMin: 0, yMax: leafH, flags: CF.Solid | CF.Door | CF.Sound, tag: `door:${id}`,
  });
  const door = new Door(id, dd, cx, cz, 1.1, r.inX, r.inZ, leaves, collider);
  collider.ref = door;
  if (dd.startsOpen) door.setOpen(true, cx + r.inX, cz + r.inZ, true);
  return door;
}
