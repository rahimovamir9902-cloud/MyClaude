import * as THREE from 'three';
import { CF } from '../Physics';
import type { PropDef } from '../LevelTypes';
import { PropBuilder, type BuildContext } from './PropBuilder';
import { signPlaneGeo } from '../../render/geometry';

const S = CF.Solid;
const LOW = CF.Move | CF.Bullet | CF.Vault | CF.Camera;

const PRODUCT_COLORS = [0xb84a3a, 0x3a6ab8, 0xd8b440, 0x4a8a4a, 0xe0dcd0, 0x8a4ab0, 0xd87a30];

/** Builds a static prop's geometry and colliders. */
export function buildProp(ctx: BuildContext, def: PropDef, layer: string): void {
  const b = new PropBuilder(ctx, def.x, def.z, def.rot ?? 0, def.scale ?? 1, layer, def.y ?? 0);
  const c = def.color;
  const rng = ctx.rng;
  switch (def.type) {
    case 'fuelPump': {
      b.block(0, 0, 0, 1.0, 0.15, 0.7, 'concrete', 0xb0aca4);
      b.block(0, 0.15, 0, 0.78, 1.55, 0.48, 'paint', c ?? 0xd9d4c6, { shade: 0.3 });
      b.block(0, 1.7, 0, 0.84, 0.2, 0.54, 'paint', 0xa8322a);
      b.box(0, 1.25, 0.25, 0.46, 0.3, 0.02, 'glass');
      b.box(0, 1.25, -0.25, 0.46, 0.3, 0.02, 'glass');
      b.box(0.3, 0.95, 0.27, 0.12, 0.25, 0.08, 'plain', 0x1a1a1a);
      b.box(-0.3, 0.95, -0.27, 0.12, 0.25, 0.08, 'plain', 0x1a1a1a);
      b.collider(0, 0, 0.45, 0.3, S, 0, 1.9);
      break;
    }
    case 'canopy': {
      const w = def.w ?? 14;
      const d = def.d ?? 12;
      const h = def.h ?? 4.4;
      b.block(0, h, 0, w, 0.5, d, 'paint', c ?? 0xd8d6d0, { shade: 0.2 });
      b.block(0, h - 0.12, 0, w + 0.1, 0.14, d + 0.1, 'paint', 0xa8322a);
      for (const px of [-w / 2 + 0.6, w / 2 - 0.6]) {
        for (const pz of [-d / 2 + 0.6, d / 2 - 0.6]) {
          b.block(px, 0, pz, 0.45, h, 0.45, 'paint', 0xbab6ae, { shade: 0.35 });
          b.collider(px, pz, 0.25, 0.25, S, 0, h);
        }
      }
      // Underside panel lights (dead).
      for (let i = -1; i <= 1; i++) b.box(i * w * 0.28, h - 0.27, 0, 1.6, 0.04, 0.5, 'paint', 0xe8e6de);
      b.collider(0, 0, w / 2, d / 2, CF.Camera | CF.Bullet, h - 0.25, h + 0.25);
      break;
    }
    case 'shelf': {
      const len = def.w ?? 3;
      const h = def.h ?? 1.8;
      b.block(0, 0, 0, len, 0.12, 0.62, 'paint', 0x5a5e62);
      b.block(0, 0, 0, len, h, 0.06, 'paint', 0x6a6e72);
      for (const sx of [-len / 2 + 0.03, len / 2 - 0.03]) b.block(sx, 0, 0, 0.06, h, 0.62, 'paint', 0x55585c);
      for (let level = 0; level < 4; level++) {
        const y = 0.12 + level * (h / 4.2);
        b.block(0, y, 0, len, 0.04, 0.6, 'paint', 0x7a7e82);
        // Sparse, picked-over products on both faces.
        const n = Math.floor(len * 2.2);
        for (let i = 0; i < n; i++) {
          if (rng.chance(0.45)) continue;
          const px = -len / 2 + 0.2 + (i / n) * (len - 0.3);
          const side = rng.chance(0.5) ? 0.17 : -0.17;
          const ph = rng.range(0.12, 0.3);
          if (rng.chance(0.25)) {
            b.cyl(px, y + 0.04 + ph / 2, side, 0.05, 0.05, ph, 6, 'paint', rng.pick(PRODUCT_COLORS));
          } else {
            b.block(px, y + 0.04, side, rng.range(0.1, 0.22), ph, 0.16, 'paint', rng.pick(PRODUCT_COLORS), rng.chance(0.15) ? { rotZ: Math.PI / 2 } : {});
          }
        }
      }
      b.collider(0, 0, len / 2, 0.32, S, 0, h);
      break;
    }
    case 'counter': {
      const len = def.w ?? 2.4;
      b.block(0, 0, 0, len, 0.95, 0.7, 'wood', c ?? 0x8a6a4a, { shade: 0.3 });
      b.block(0, 0.95, 0, len + 0.1, 0.06, 0.8, 'paint', 0x3a3632);
      b.block(-len / 2 + 0.4, 1.01, 0, 0.42, 0.22, 0.38, 'paint', 0x2e2e30);
      b.box(-len / 2 + 0.4, 1.28, -0.08, 0.3, 0.16, 0.04, 'glass', 0xffffff, { rotX: -0.4 });
      b.block(len / 2 - 0.5, 1.01, 0.05, 0.5, 0.5, 0.25, 'paint', 0xc8a040);
      b.collider(0, 0, len / 2, 0.38, S, 0, 1.05);
      break;
    }
    case 'fridge': {
      b.block(0, 0, 0, 1.2, 2.0, 0.8, 'paint', c ?? 0xe4e2dc, { shade: 0.25 });
      b.box(0, 1.05, 0.41, 1.05, 1.6, 0.02, 'glass');
      b.box(0, 1.95, 0.41, 1.1, 0.12, 0.02, 'emissive', 0x324a4a);
      for (let lv = 0; lv < 3; lv++) {
        for (let i = 0; i < 4; i++) {
          if (rng.chance(0.5)) continue;
          b.cyl(-0.4 + i * 0.27, 0.45 + lv * 0.5, 0.2, 0.06, 0.06, 0.24, 6, 'paint', rng.pick(PRODUCT_COLORS));
        }
      }
      b.collider(0, 0, 0.6, 0.4, S, 0, 2.0);
      break;
    }
    case 'dumpster': {
      b.block(0, 0.1, 0, 1.9, 1.15, 1.2, 'rust', c ?? 0x3a5444, { shade: 0.35 });
      b.box(0, 1.33, -0.05, 1.95, 0.08, 1.3, 'rust', 0x2e443a, { rotX: 0.12 });
      for (const wx of [-0.75, 0.75]) for (const wz of [-0.45, 0.45]) b.cyl(wx, 0.08, wz, 0.08, 0.08, 0.08, 6, 'plain', 0x1a1a1a, { rotZ: Math.PI / 2 });
      b.collider(0, 0, 0.98, 0.62, S, 0, 1.4);
      break;
    }
    case 'barrel': {
      b.cyl(0, 0.45, 0, 0.3, 0.3, 0.9, 10, 'rust', c ?? 0x2f5a8a, { shade: 0.3 });
      b.cyl(0, 0.3, 0, 0.31, 0.31, 0.05, 10, 'rust', 0x404040);
      b.cyl(0, 0.62, 0, 0.31, 0.31, 0.05, 10, 'rust', 0x404040);
      b.collider(0, 0, 0.3, 0.3, S, 0, 0.9);
      break;
    }
    case 'drums': {
      const tints = [0x2f5a8a, 0x8a2f2a, 0x5a6a3a];
      [[-0.35, -0.2], [0.35, -0.25], [0, 0.4]].forEach(([dx, dz], i) => {
        b.cyl(dx, 0.45, dz, 0.3, 0.3, 0.9, 10, 'rust', c ?? tints[i], { shade: 0.3 });
      });
      b.collider(0, 0.05, 0.7, 0.7, S, 0, 0.9);
      break;
    }
    case 'pallet': {
      for (let i = 0; i < 5; i++) b.block(-0.5 + i * 0.25, 0.1, 0, 0.18, 0.03, 1.0, 'wood', 0xa88a62);
      for (const z of [-0.42, 0, 0.42]) b.block(0, 0, z, 1.2, 0.1, 0.12, 'wood', 0x8a6e4a);
      break;
    }
    case 'crate': {
      const s = def.w ?? 0.9;
      b.block(0, 0, 0, s, s, s, 'wood', c ?? 0x9a7a52, { shade: 0.3 });
      b.box(0, s / 2, s / 2 + 0.005, s * 0.95, 0.08, 0.01, 'wood', 0x6a5236, { rotZ: 0.75 });
      b.collider(0, 0, s / 2, s / 2, S, 0, s);
      break;
    }
    case 'boxes': {
      const tone = 0xa4865c;
      b.block(0, 0, 0, 0.7, 0.5, 0.55, 'paint', tone, { shade: 0.2 });
      b.block(0.05, 0.5, -0.02, 0.6, 0.45, 0.5, 'paint', 0xb89a6c, { rotY: 0.2 });
      b.block(0.75, 0, 0.1, 0.55, 0.4, 0.5, 'paint', 0x9a7c54, { rotY: -0.15 });
      b.collider(0.3, 0, 0.75, 0.35, S, 0, 0.95);
      break;
    }
    case 'locker': {
      b.block(0, 0, 0, 0.55, 1.9, 0.5, 'paint', c ?? 0x52606a, { shade: 0.3 });
      for (let i = 0; i < 4; i++) b.box(0, 1.6 - i * 0.06, 0.252, 0.3, 0.02, 0.01, 'plain', 0x22282c);
      b.box(0.2, 1.0, 0.255, 0.04, 0.12, 0.02, 'plain', 0x9a9a9a);
      b.collider(0, 0, 0.28, 0.25, S, 0, 1.9);
      break;
    }
    case 'workbench': {
      const len = def.w ?? 2.2;
      b.block(0, 0.85, 0, len, 0.08, 0.75, 'wood', 0x7a5a3a);
      for (const lx of [-len / 2 + 0.08, len / 2 - 0.08]) for (const lz of [-0.3, 0.3]) b.block(lx, 0, lz, 0.07, 0.85, 0.07, 'rust', 0x50504c);
      b.block(0, 0.25, 0, len - 0.2, 0.04, 0.6, 'wood', 0x6a4e34);
      b.block(0, 0.93, -0.36, len, 1.0, 0.04, 'wood', 0xa08460);
      for (let i = 0; i < 6; i++) b.box(-len / 2 + 0.3 + i * (len - 0.6) / 5, 1.4, -0.33, 0.05, 0.3, 0.03, 'plain', rng.pick([0x9a2a22, 0x2a3a6a, 0x3a3a3a]));
      b.collider(0, 0, len / 2, 0.38, S, 0, 1.9);
      break;
    }
    case 'toolbox': {
      b.block(0, 0, 0, 0.62, 0.32, 0.3, 'paint', c ?? 0xb02a22, { shade: 0.2 });
      b.block(0, 0.32, 0, 0.3, 0.06, 0.04, 'plain', 0x222222);
      break;
    }
    case 'cot': {
      b.block(0, 0.3, 0, 0.8, 0.1, 1.9, 'fabric', 0x5a6248);
      for (const lx of [-0.38, 0.38]) for (const lz of [-0.9, 0.9]) b.block(lx, 0, lz, 0.04, 0.3, 0.04, 'plain', 0x333333);
      b.block(0, 0.4, -0.75, 0.5, 0.12, 0.3, 'fabric', 0xc8c4b4);
      b.block(0.05, 0.4, 0.2, 0.75, 0.06, 1.1, 'fabric', 0x6a4a3a, { rotY: 0.05 });
      b.collider(0, 0, 0.42, 0.97, S, 0, 0.45);
      break;
    }
    case 'desk': {
      b.block(0, 0.72, 0, 1.4, 0.05, 0.7, 'wood', c ?? 0x6e5236);
      b.block(-0.5, 0, 0, 0.4, 0.72, 0.66, 'wood', 0x5e4630, { shade: 0.25 });
      b.block(0.66, 0, 0, 0.05, 0.72, 0.66, 'wood', 0x5e4630);
      for (let i = 0; i < 3; i++) b.box(-0.5, 0.15 + i * 0.22, 0.335, 0.32, 0.16, 0.01, 'wood', 0x7a5c3e);
      b.block(0.3, 0.77, -0.1, 0.4, 0.02, 0.3, 'paint', 0xe8e4d8, { rotY: 0.3 });
      b.collider(0, 0, 0.72, 0.36, S, 0, 0.8);
      break;
    }
    case 'chair': {
      b.block(0, 0.42, 0, 0.45, 0.05, 0.45, 'plain', c ?? 0x2a2c30);
      b.block(0, 0.45, -0.2, 0.45, 0.45, 0.05, 'plain', c ?? 0x2a2c30);
      b.cyl(0, 0.21, 0, 0.03, 0.03, 0.42, 5, 'plain', 0x555555);
      break;
    }
    case 'tires': {
      for (let i = 0; i < 3; i++) b.cyl(i === 2 ? 0.05 : 0, 0.13 + i * 0.25, 0, 0.36, 0.36, 0.24, 10, 'plain', 0x1c1c1e, { shade: 0.2 });
      b.collider(0, 0, 0.36, 0.36, S, 0, 0.75);
      break;
    }
    case 'signPole': {
      const h = def.h ?? 7;
      b.cyl(0, h / 2, 0, 0.12, 0.15, h, 8, 'rust', 0x6a6a68);
      b.block(0, h, 0, 3.4, 1.6, 0.3, 'paint', 0xd8d4c8);
      b.collider(0, 0, 0.18, 0.18, S, 0, h);
      if (def.text) {
        const lines = def.text.split('|');
        const mat = ctx.materials.sign(`pole:${def.text}`, {
          width: 512, height: 256, background: '#d8d2c2', color: '#9e2b22', font: 'bold 62px "Arial Narrow", Arial, sans-serif',
          lines, border: '#9e2b22', grime: 1,
        });
        b.mesh(signPlaneGeo(3.2, 1.45), mat, 0, h + 0.8, 0.16);
        b.mesh(signPlaneGeo(3.2, 1.45), mat, 0, h + 0.8, -0.16, { rotY: Math.PI });
      }
      break;
    }
    case 'roadSign': {
      const w = def.w ?? 3;
      for (const px of [-w / 2 + 0.3, w / 2 - 0.3]) {
        b.cyl(px, 1.4, 0, 0.05, 0.05, 2.8, 6, 'rust', 0x8a8a88);
        b.collider(px, 0, 0.08, 0.08, S, 0, 2.8);
      }
      b.block(0, 2.2, -0.03, w, 1.2, 0.05, 'paint', 0x1e5a3a);
      if (def.text) {
        const mat = ctx.materials.sign(`road:${def.text}`, {
          width: 512, height: 200, background: '#1f5d3c', color: '#f0f0e8', font: 'bold 52px Arial, sans-serif',
          lines: def.text.split('|'), border: '#f0f0e8', grime: 0.6,
        });
        b.mesh(signPlaneGeo(w - 0.1, 1.1), mat, 0, 2.8, 0.0);
      }
      break;
    }
    case 'barrier': {
      b.block(0, 0, 0, 2.0, 0.25, 0.62, 'concrete', c ?? 0xc8c4b8);
      b.block(0, 0.25, 0, 2.0, 0.55, 0.32, 'concrete', c ?? 0xc8c4b8, { shade: 0.25 });
      b.collider(0, 0, 1.0, 0.31, LOW, 0, 0.8);
      break;
    }
    case 'utilityPole': {
      b.cyl(0, 4.5, 0, 0.13, 0.17, 9, 7, 'wood', 0x5a4632);
      b.block(0, 8.2, 0, 2.2, 0.12, 0.12, 'wood', 0x5a4632);
      b.collider(0, 0, 0.17, 0.17, S, 0, 9);
      break;
    }
    case 'camper': {
      b.block(0, 0.45, 0, 2.4, 2.3, 6.2, 'paint', c ?? 0xd8d0b8, { shade: 0.25 });
      b.block(0, 1.3, 0, 2.42, 0.25, 6.22, 'paint', 0x6a8a7a);
      b.box(1.21, 1.75, -1.5, 0.02, 0.6, 1.2, 'glass');
      b.box(1.21, 1.75, 1.6, 0.02, 0.6, 1.0, 'glass');
      b.box(1.215, 1.3, 0.2, 0.02, 1.9, 0.75, 'paint', 0xb8b098);
      for (const wz of [-0.4, 0.4]) {
        b.cyl(-1.2, 0.35, wz, 0.35, 0.35, 0.22, 10, 'plain', 0x1c1c1c, { rotZ: Math.PI / 2 });
        b.cyl(1.2, 0.35, wz, 0.35, 0.35, 0.22, 10, 'plain', 0x1c1c1c, { rotZ: Math.PI / 2 });
      }
      b.block(0, 0.25, -3.6, 0.15, 0.15, 1.2, 'rust', 0x404040);
      b.block(1.6, 2.6, 0, 1.2, 0.05, 3.2, 'fabric', 0x8a5a3a, { rotZ: -0.15 });
      b.collider(0, 0, 1.22, 3.1, S, 0, 2.8);
      break;
    }
    case 'hayBale': {
      b.cyl(0, 0.7, 0, 0.7, 0.7, 1.2, 12, 'dirt', 0xc8b070, { rotZ: Math.PI / 2, shade: 0.15 });
      b.collider(0, 0, 0.62, 0.7, S, 0, 1.4);
      break;
    }
    case 'tractor': {
      const col = c ?? 0x8a3a2a;
      b.block(0, 0.6, 0.4, 1.0, 0.9, 2.0, 'rust', col, { shade: 0.3 });
      b.block(0, 1.5, 0.1, 0.9, 0.12, 0.6, 'rust', col);
      b.block(0, 1.0, -0.6, 0.8, 0.5, 0.8, 'rust', 0x3a3a3a);
      b.cyl(0, 2.0, 0.9, 0.06, 0.06, 1.2, 6, 'rust', 0x2a2a2a);
      for (const sx of [-0.85, 0.85]) {
        b.cyl(sx, 0.75, -0.7, 0.75, 0.75, 0.42, 12, 'plain', 0x1e1e1e, { rotZ: Math.PI / 2 });
        b.cyl(sx * 0.85, 0.42, 1.2, 0.42, 0.42, 0.28, 10, 'plain', 0x1e1e1e, { rotZ: Math.PI / 2 });
      }
      b.collider(0, 0.2, 1.1, 1.6, S, 0, 2.0);
      break;
    }
    case 'suitcase': {
      b.block(0, 0, 0, 0.65, 0.22, 0.42, 'fabric', c ?? 0x3a4a6a, { rotY: rng.range(-0.5, 0.5) });
      break;
    }
    case 'backpack': {
      b.blob(0, 0.22, 0, 0.25, 'fabric', c ?? 0x4a5a3a, { sx: 1, sy: 1.1, sz: 0.7 });
      b.box(0, 0.12, 0.17, 0.3, 0.18, 0.08, 'fabric', 0x3a4a2e);
      break;
    }
    case 'register': {
      b.block(0, 0, 0, 0.42, 0.22, 0.38, 'paint', 0x2e2e30);
      break;
    }
    case 'radio': {
      b.block(0, 0, 0, 0.42, 0.24, 0.22, 'paint', 0x3a4232);
      b.cyl(0.15, 0.5, 0, 0.008, 0.008, 0.55, 4, 'plain', 0x111111);
      b.box(-0.12, 0.16, 0.112, 0.06, 0.04, 0.01, 'emissive', 0x40ff60);
      break;
    }
    case 'campfire': {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        b.blob(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55, 0.13, 'concrete', 0x7a7670);
      }
      b.cyl(0, 0.08, 0, 0.05, 0.05, 0.8, 5, 'wood', 0x2a2018, { rotZ: Math.PI / 2, rotY: 0.6 });
      b.cyl(0, 0.1, 0, 0.05, 0.05, 0.8, 5, 'wood', 0x2a2018, { rotZ: Math.PI / 2, rotY: -0.7 });
      b.flat(0, 0.02, 0, 0.6, 0.6, 'dirt', 0x2a2420);
      break;
    }
    case 'medCabinet': {
      b.block(0, 1.3, 0, 0.6, 0.7, 0.18, 'paint', 0xe8e6e0);
      b.box(0, 1.65, 0.095, 0.2, 0.06, 0.01, 'plain', 0xb02020);
      b.box(0, 1.65, 0.095, 0.06, 0.2, 0.01, 'plain', 0xb02020);
      break;
    }
    case 'fileCabinet': {
      b.block(0, 0, 0, 0.5, 1.32, 0.62, 'paint', c ?? 0x6a7070, { shade: 0.25 });
      for (let i = 0; i < 4; i++) b.box(0, 0.2 + i * 0.32, 0.315, 0.12, 0.03, 0.02, 'plain', 0xaaaaaa);
      b.collider(0, 0, 0.25, 0.31, S, 0, 1.32);
      break;
    }
    case 'carLift': {
      for (const sx of [-1.5, 1.5]) {
        b.block(sx, 0, 0, 0.35, 3.2, 0.35, 'paint', 0xc8a02a, { shade: 0.3 });
        b.block(sx * 0.7, 1.4, 0.5, 1.0, 0.1, 0.15, 'rust', 0x404040);
        b.block(sx * 0.7, 1.4, -0.5, 1.0, 0.1, 0.15, 'rust', 0x404040);
        b.collider(sx, 0, 0.2, 0.2, S, 0, 3.2);
      }
      break;
    }
    case 'generator': {
      b.block(0, 0.1, 0, 1.3, 0.85, 0.75, 'paint', c ?? 0xc8a032, { shade: 0.3 });
      b.block(0, 0, 0, 1.4, 0.1, 0.85, 'rust', 0x303030);
      b.cyl(0.5, 1.2, 0.2, 0.05, 0.05, 0.5, 6, 'rust', 0x2a2a2a);
      b.collider(0, 0, 0.7, 0.42, S, 0, 1.0);
      break;
    }
    case 'mailbox': {
      b.cyl(0, 0.5, 0, 0.04, 0.04, 1.0, 5, 'wood', 0x5a4632);
      b.block(0, 1.0, 0, 0.25, 0.25, 0.5, 'paint', c ?? 0x3a3e44);
      break;
    }
    case 'bench': {
      b.block(0, 0.42, 0, 1.6, 0.06, 0.45, 'wood', 0x7a5c3e);
      b.block(0, 0.6, -0.2, 1.6, 0.35, 0.05, 'wood', 0x7a5c3e);
      for (const lx of [-0.7, 0.7]) b.block(lx, 0, 0, 0.06, 0.42, 0.4, 'rust', 0x3a3a3a);
      b.collider(0, 0, 0.8, 0.25, S, 0, 0.6);
      break;
    }
    case 'pivot': {
      const len = def.w ?? 18;
      b.box(0, 3.2, 0, len, 0.18, 0.18, 'rust', 0x8a9090);
      for (let i = 0; i <= 6; i++) {
        const px = -len / 2 + (i / 6) * len;
        b.box(px, 2.6, 0, 0.06, 1.3, 0.06, 'rust', 0x7a8080, { rotZ: i % 2 ? 0.5 : -0.5 });
      }
      for (const px of [-len / 2, len / 2]) {
        b.box(px, 1.6, -0.6, 0.12, 3.3, 0.12, 'rust', 0x7a8080, { rotX: 0.35 });
        b.box(px, 1.6, 0.6, 0.12, 3.3, 0.12, 'rust', 0x7a8080, { rotX: -0.35 });
        b.cyl(px, 0.6, 0, 0.6, 0.6, 0.3, 10, 'plain', 0x1e1e1e, { rotZ: Math.PI / 2 });
        b.collider(px, 0, 0.35, 1.0, S, 0, 3.2);
      }
      break;
    }
    case 'footlocker': {
      b.block(0, 0, 0, 0.9, 0.45, 0.5, 'paint', c ?? 0x4a5a3a, { shade: 0.25 });
      b.box(0, 0.25, 0.255, 0.08, 0.1, 0.02, 'plain', 0x9a9a9a);
      break;
    }
    case 'magazineRack': {
      b.block(0, 0, 0, 1.0, 1.2, 0.35, 'paint', 0x4a4e52);
      for (let i = 0; i < 3; i++) b.box(0, 0.4 + i * 0.3, 0.18, 0.9, 0.22, 0.03, 'paint', rng.pick(PRODUCT_COLORS), { rotX: -0.2 });
      b.collider(0, 0, 0.5, 0.18, S, 0, 1.2);
      break;
    }
    case 'bodyBag': {
      b.blob(0, 0.12, 0, 0.5, 'fabric', 0x2a3640, { sx: 0.7, sy: 0.3, sz: 1.9 });
      b.blob(0.1, 0.12, -0.75, 0.22, 'fabric', 0x2a3640, { sy: 0.6 });
      break;
    }
    case 'tarp': {
      b.flat(0, 0.03, 0, def.w ?? 2.5, def.d ?? 2, 'fabric', c ?? 0x2a4a7a, { rotY: 0.2 });
      break;
    }
    case 'debris': {
      for (let i = 0; i < 7; i++) {
        const dx = rng.range(-1.2, 1.2);
        const dz = rng.range(-1.2, 1.2);
        if (rng.chance(0.5)) b.block(dx, 0, dz, rng.range(0.4, 1.2), 0.04, 0.12, 'wood', 0x6a5236, { rotY: rng.range(0, 3) });
        else b.block(dx, 0, dz, rng.range(0.15, 0.35), 0.01, rng.range(0.2, 0.3), 'paint', 0xd8d4c8, { rotY: rng.range(0, 3) });
      }
      break;
    }
    case 'lamp': {
      b.cyl(0, 3.5, 0, 0.07, 0.1, 7, 7, 'rust', 0x5a5a58);
      b.block(0, 7, -0.6, 0.18, 0.12, 1.4, 'rust', 0x5a5a58);
      b.block(0, 6.88, -1.2, 0.4, 0.1, 0.25, 'emissive', c ?? 0x1a1814);
      b.collider(0, 0, 0.12, 0.12, S, 0, 7);
      break;
    }
  }
}

/** A simple door leaf mesh pivoted at its hinge edge. */
export function doorLeafGeometry(width: number, height: number, thickness: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(width, height, thickness);
  g.translate(width / 2, height / 2, 0);
  return g;
}
