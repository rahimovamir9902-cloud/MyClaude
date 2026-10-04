import * as THREE from 'three';
import type { WeaponDef } from '../config/weapons';

/**
 * Original procedural weapon meshes, held in the right hand. Models extend along the hand's
 * local -Y axis (the direction the forearm points) and expose a muzzle point for firearms.
 */
export interface WeaponModel {
  root: THREE.Group;
  muzzle: THREE.Object3D;
}

const mats = new Map<number, THREE.MeshLambertMaterial>();
function mat(color: number): THREE.MeshLambertMaterial {
  let m = mats.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    mats.set(color, m);
  }
  return m;
}

function part(group: THREE.Group, w: number, h: number, d: number, color: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  group.add(m);
  return m;
}

export function buildWeaponModel(def: WeaponDef): WeaponModel {
  const root = new THREE.Group();
  const muzzle = new THREE.Object3D();
  root.add(muzzle);
  switch (def.model) {
    case 'crowbar': {
      // Hex bar with a curled claw at the far end and a flat chisel at the grip end.
      part(root, 0.025, 0.72, 0.025, 0x3a3e44, 0, -0.26, 0);
      part(root, 0.025, 0.1, 0.025, 0x3a3e44, 0, -0.64, -0.04, 0.9);
      part(root, 0.025, 0.07, 0.025, 0x3a3e44, 0, -0.66, -0.1, 2.0);
      part(root, 0.04, 0.12, 0.012, 0x8a2a22, 0, 0.08, 0, 0, 0, 0);
      break;
    }
    case 'machete':
      part(root, 0.03, 0.14, 0.035, 0x2a2420, 0, 0, 0);
      part(root, 0.006, 0.5, 0.06, 0xa8aaa8, 0, -0.32, -0.01);
      break;
    case 'bat':
      part(root, 0.04, 0.3, 0.04, 0x2a2a2a, 0, -0.05, 0);
      part(root, 0.065, 0.5, 0.065, 0xb8925a, 0, -0.45, 0);
      break;
    case 'pipe':
      part(root, 0.05, 0.85, 0.05, 0x6a6e6a, 0, -0.32, 0);
      part(root, 0.07, 0.2, 0.07, 0x5a4a3a, 0, -0.6, 0);
      break;
    case 'knife':
      part(root, 0.025, 0.1, 0.03, 0x2a2a2a, 0, 0, 0);
      part(root, 0.005, 0.16, 0.035, 0xb8b8b8, 0, -0.13, 0);
      break;
    case 'pistol':
    case 'revolver': {
      // Grip in the hand, slide pointing forward along -Y.
      part(root, 0.035, 0.1, 0.06, 0x1e2022, 0, 0.0, 0.01, -0.25);
      part(root, 0.032, 0.2, 0.045, def.model === 'revolver' ? 0x6a6a6a : 0x2a2c2e, 0, -0.08, -0.04);
      if (def.model === 'revolver') part(root, 0.05, 0.05, 0.05, 0x5a5a5a, 0, -0.03, -0.04);
      muzzle.position.set(0, -0.19, -0.04);
      break;
    }
    case 'shotgun':
    case 'rifle':
    case 'crossbow': {
      part(root, 0.04, 0.9, 0.05, 0x2a2826, 0, -0.3, -0.03);
      part(root, 0.05, 0.3, 0.09, 0x6a4a2a, 0, 0.18, 0.0);
      if (def.model === 'crossbow') part(root, 0.6, 0.03, 0.03, 0x4a4a48, 0, -0.65, -0.03);
      muzzle.position.set(0, -0.76, -0.03);
      break;
    }
  }
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });
  return { root, muzzle };
}
