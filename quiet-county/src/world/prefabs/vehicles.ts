import * as THREE from 'three';
import { boxGeo, paintVertexColors, signPlaneGeo } from '../../render/geometry';
import { CF, type Collider } from '../Physics';
import type { VehicleDef } from '../LevelTypes';
import { PropBuilder, type BuildContext } from './PropBuilder';

export interface BuiltVehicle {
  collider: Collider;
  /** Blinking alarm LED or headlight meshes that the game animates. */
  alarmLight: THREE.Mesh | null;
  headlights: THREE.Mesh[];
  length: number;
  width: number;
}

const TIRE = 0x1a1a1b;

function wheels(b: PropBuilder, xs: number, zs: number[], r: number, flat = false): void {
  for (const z of zs) {
    for (const x of [-xs, xs]) {
      b.cyl(x, flat ? r * 0.8 : r, z, r, r, 0.24, 10, 'plain', TIRE, { rotZ: Math.PI / 2 });
      b.cyl(x * 1.04, flat ? r * 0.8 : r, z, r * 0.5, r * 0.5, 0.05, 8, 'paint', 0x8a8a88, { rotZ: Math.PI / 2 });
    }
  }
}

function rustPatches(b: PropBuilder, w: number, l: number, y: number, count: number): void {
  const rng = b.ctx.rng;
  for (let i = 0; i < count; i++) {
    const side = rng.chance(0.5) ? 1 : -1;
    b.box(side * (w / 2 + 0.006), y + rng.range(-0.15, 0.15), rng.range(-l / 2.5, l / 2.5), 0.01, rng.range(0.15, 0.35), rng.range(0.3, 0.9), 'rust', 0x8a5a3a);
  }
}

function emissiveBox(b: PropBuilder, lx: number, ly: number, lz: number, w: number, h: number, d: number, color: number): THREE.Mesh {
  const g = boxGeo(w, h, d);
  paintVertexColors(g, color);
  return b.mesh(g, b.ctx.materials.get('emissive'), lx, ly, lz);
}

/** Original low-poly vehicle models. Front faces local -Z. */
export function buildVehicle(ctx: BuildContext, def: VehicleDef, layer = 'world'): BuiltVehicle {
  const b = new PropBuilder(ctx, def.x, def.z, def.rot, 1, layer);
  const col = def.color;
  const wreck = !!def.wrecked;
  const glassTint = wreck ? 0xa8b0b8 : 0x8898a8;
  let length = 4.5;
  let width = 1.8;
  let height = 1.5;
  let alarmLight: THREE.Mesh | null = null;
  const headlights: THREE.Mesh[] = [];

  switch (def.type) {
    case 'sedan':
    case 'wagon': {
      const wagon = def.type === 'wagon';
      length = wagon ? 4.7 : 4.5;
      b.block(0, 0.25, 0, 1.8, 0.62, length, 'paint', col, { shade: 0.35 });
      b.block(0, 0.87, -length / 2 + 0.75, 1.72, 0.06, 1.3, 'paint', col);
      b.block(0, 0.87, wagon ? 0.45 : 0.3, 1.62, 0.55, wagon ? 3.0 : 2.2, 'glass', glassTint);
      b.block(0, 1.42, wagon ? 0.45 : 0.3, 1.58, 0.07, wagon ? 2.9 : 2.0, 'paint', col);
      b.block(0, 0.2, -length / 2 - 0.02, 1.84, 0.22, 0.12, 'plain', 0x2a2a2a);
      b.block(0, 0.2, length / 2 + 0.02, 1.84, 0.22, 0.12, 'plain', 0x2a2a2a);
      for (const sx of [-0.6, 0.6]) {
        if (def.headlights) headlights.push(emissiveBox(b, sx, 0.65, -length / 2 - 0.01, 0.34, 0.14, 0.04, 0xfff2cc));
        else b.box(sx, 0.65, -length / 2 - 0.01, 0.34, 0.14, 0.04, 'glass', 0xd0d8e0);
        b.box(sx * 1.08, 0.7, length / 2 + 0.01, 0.3, 0.12, 0.04, 'emissive', 0x401010);
      }
      wheels(b, 0.86, [-length / 2 + 1.05, length / 2 - 1.05], 0.33, wreck);
      if (def.doorsOpen) {
        b.block(-1.3, 0.35, -0.55, 0.06, 0.75, 1.05, 'paint', col, { rotY: -0.95 });
        b.block(-1.32, 0.95, -0.55, 0.04, 0.45, 0.95, 'glass', glassTint, { rotY: -0.95 });
      }
      if (wreck) rustPatches(b, 1.8, length, 0.55, 5);
      break;
    }
    case 'pickup': {
      length = 5.3;
      width = 1.95;
      height = 1.95;
      b.block(0, 0.3, 0, 1.95, 0.72, length, 'paint', col, { shade: 0.35 });
      b.block(0, 1.02, -0.75, 1.85, 0.72, 1.8, 'glass', glassTint);
      b.block(0, 1.74, -0.75, 1.8, 0.07, 1.7, 'paint', col);
      b.block(0, 1.02, -1.95, 1.85, 0.05, 0.75, 'paint', col);
      for (const sx of [-0.93, 0.93]) b.block(sx, 1.02, 1.25, 0.08, 0.48, 2.6, 'paint', col);
      b.block(0, 1.02, length / 2 - 0.05, 1.95, 0.48, 0.08, 'paint', col);
      b.block(0, 1.0, 1.25, 1.78, 0.04, 2.55, 'rust', 0x3a3a38);
      b.block(0, 0.22, -length / 2 - 0.02, 2.0, 0.26, 0.14, 'rust', 0x8a8a88);
      for (const sx of [-0.65, 0.65]) {
        if (def.headlights) headlights.push(emissiveBox(b, sx, 0.78, -length / 2 - 0.01, 0.36, 0.18, 0.04, 0xfff2cc));
        else b.box(sx, 0.78, -length / 2 - 0.01, 0.36, 0.18, 0.04, 'glass', 0xd0d8e0);
        b.box(sx * 1.2, 0.85, length / 2 + 0.01, 0.2, 0.25, 0.04, 'emissive', def.headlights ? 0xc02020 : 0x401010);
      }
      wheels(b, 0.92, [-length / 2 + 1.1, length / 2 - 1.2], 0.38, wreck);
      if (wreck) rustPatches(b, 1.95, length, 0.65, 7);
      break;
    }
    case 'van': {
      length = 5.3;
      width = 2.0;
      height = 2.3;
      b.block(0, 0.3, 0.2, 2.0, 1.95, length - 0.4, 'paint', col, { shade: 0.3 });
      b.block(0, 0.3, -length / 2 + 0.3, 1.95, 0.9, 0.6, 'paint', col);
      b.box(0, 1.55, -length / 2 + 0.55, 1.85, 0.75, 0.05, 'glass', glassTint, { rotX: -0.35 });
      for (const sx of [-1.0, 1.0]) b.box(sx * 1.003, 1.5, -length / 2 + 1.25, 0.02, 0.5, 0.8, 'glass', glassTint);
      b.block(0, 0.22, -length / 2 - 0.02, 2.04, 0.24, 0.12, 'plain', 0x2a2a2a);
      for (const sx of [-0.7, 0.7]) b.box(sx, 0.75, -length / 2 - 0.01, 0.3, 0.16, 0.04, 'glass', 0xd0d8e0);
      wheels(b, 0.95, [-length / 2 + 1.0, length / 2 - 1.0], 0.36, wreck);
      if (def.doorsOpen) {
        b.block(-0.55, 0.35, length / 2 + 0.45, 0.9, 1.75, 0.05, 'paint', col, { rotY: 1.2 });
        b.block(0.55, 0.35, length / 2 + 0.45, 0.9, 1.75, 0.05, 'paint', col, { rotY: -1.2 });
      }
      if (def.livery) {
        const mat = ctx.materials.sign(`livery:${def.livery}`, {
          width: 512, height: 160, background: '#e4e2dc', color: '#2a6a8a', font: 'bold 44px Arial, sans-serif',
          lines: def.livery.split('|'), grime: 1.2,
        });
        b.mesh(signPlaneGeo(3.0, 0.9), mat, 1.006, 1.45, 0.5, { rotY: Math.PI / 2 });
        b.mesh(signPlaneGeo(3.0, 0.9), mat, -1.006, 1.45, 0.5, { rotY: -Math.PI / 2 });
      }
      if (wreck) rustPatches(b, 2.0, length, 0.9, 6);
      break;
    }
    case 'semiTrailer': {
      length = 12.5;
      width = 2.6;
      height = 3.9;
      b.block(0, 1.2, 0, 2.6, 2.7, length, 'corrugated', col, { shade: 0.2 });
      b.block(0, 0.9, 0, 2.2, 0.3, length - 0.4, 'rust', 0x3a3a3a);
      b.block(0, 1.6, -length / 2 - 0.4, 2.0, 1.4, 0.8, 'paint', 0xd8d8d0);
      for (const z of [length / 2 - 1.2, length / 2 - 2.5]) wheels(b, 1.0, [z], 0.5);
      for (const sx of [-0.9, 0.9]) b.block(sx, 0, -length / 2 + 2.5, 0.12, 0.95, 0.12, 'rust', 0x404040);
      if (def.livery) {
        const mat = ctx.materials.sign(`trailer:${def.livery}`, {
          width: 1024, height: 200, background: '#cfd0c8', color: '#3a5a7a', font: 'bold 96px Arial, sans-serif',
          lines: def.livery.split('|'), grime: 2,
        });
        b.mesh(signPlaneGeo(9, 1.6), mat, 1.31, 2.6, 0, { rotY: Math.PI / 2 });
        b.mesh(signPlaneGeo(9, 1.6), mat, -1.31, 2.6, 0, { rotY: -Math.PI / 2 });
      }
      break;
    }
    case 'semiCab': {
      length = 5.6;
      width = 2.5;
      height = 3.4;
      b.block(0, 0.55, 0.9, 2.5, 2.55, 2.4, 'paint', col, { shade: 0.3 });
      b.block(0, 0.55, -1.2, 2.3, 1.4, 1.9, 'paint', col, { shade: 0.3 });
      b.box(0, 2.35, -0.32, 2.3, 0.9, 0.05, 'glass', glassTint, { rotX: -0.15 });
      b.block(0, 0.3, -2.2, 2.4, 0.9, 0.2, 'paint', 0x9a9a98);
      for (const sx of [-1.15, 1.15]) b.cyl(sx, 2.6, 1.9, 0.09, 0.09, 2.2, 8, 'paint', 0xb8b8b8);
      wheels(b, 1.05, [-1.4, 1.6], 0.52, wreck);
      if (wreck) rustPatches(b, 2.5, length, 1.4, 4);
      break;
    }
    case 'overturned': {
      length = 4.5;
      b.block(0, 0, 0.3, 1.5, 0.45, 2.1, 'glass', 0x9aa4ac);
      b.block(0, 0.45, 0, 1.8, 0.62, length, 'paint', col, { shade: 0.2 });
      b.block(0, 1.07, 0, 1.6, 0.06, length - 0.4, 'rust', 0x2a2826);
      for (const z of [-1.45, 1.45]) {
        for (const x of [-0.85, 0.85]) b.cyl(x, 1.35, z, 0.33, 0.33, 0.24, 10, 'plain', TIRE, { rotZ: Math.PI / 2 });
      }
      rustPatches(b, 1.8, length, 0.7, 6);
      height = 1.6;
      break;
    }
  }

  if (def.alarmLight) {
    alarmLight = emissiveBox(b, -0.35, 1.0, -0.8, 0.05, 0.03, 0.05, 0xff2020);
  }

  const flags = CF.Solid;
  const collider = b.collider(0, 0, width / 2, length / 2, flags, 0, height, 0, `vehicle:${def.id}`);
  return { collider, alarmLight, headlights, length, width };
}
