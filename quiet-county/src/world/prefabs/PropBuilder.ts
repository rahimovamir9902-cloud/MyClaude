import * as THREE from 'three';
import type { Random } from '../../core/Random';
import { blobGeo, boxGeo, coneGeo, cylinderGeo, groundPlaneGeo } from '../../render/geometry';
import type { MaterialId, MaterialLibrary } from '../../render/Materials';
import type { StaticBatcher } from '../../render/StaticBatcher';
import type { Collider, PhysicsWorld } from '../Physics';

/** Shared services for prefab construction. */
export interface BuildContext {
  batcher: StaticBatcher;
  physics: PhysicsWorld;
  materials: MaterialLibrary;
  /** Parent for non-batched (dynamic or unique) meshes. */
  dynamicRoot: THREE.Group;
  rng: Random;
  /** Interior groups for non-batched meshes, by building id. */
  interiorExtras: Map<string, THREE.Group>;
}

export interface PartOptions {
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  /** Darken lower vertices (cheap ambient occlusion). */
  shade?: number;
}

const tmpPos = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpScale = new THREE.Vector3();

/**
 * Places primitive parts in a prop's local space (x right, y up, z forward/back) and
 * registers colliders, all transformed by the prop's world position, yaw and scale.
 */
export class PropBuilder {
  private readonly world = new THREE.Matrix4();
  private readonly local = new THREE.Matrix4();
  private readonly cos: number;
  private readonly sin: number;

  constructor(
    readonly ctx: BuildContext,
    readonly x: number,
    readonly z: number,
    readonly rot = 0,
    readonly scale = 1,
    readonly layer = 'world',
    readonly y = 0,
  ) {
    tmpEuler.set(0, rot, 0);
    tmpQuat.setFromEuler(tmpEuler);
    this.world.compose(tmpPos.set(x, y, z), tmpQuat, tmpScale.set(scale, scale, scale));
    this.cos = Math.cos(rot);
    this.sin = Math.sin(rot);
  }

  private matrix(lx: number, ly: number, lz: number, o: PartOptions = {}): THREE.Matrix4 {
    tmpEuler.set(o.rotX ?? 0, o.rotY ?? 0, o.rotZ ?? 0);
    tmpQuat.setFromEuler(tmpEuler);
    this.local.compose(tmpPos.set(lx, ly, lz), tmpQuat, tmpScale.set(1, 1, 1));
    return new THREE.Matrix4().multiplyMatrices(this.world, this.local);
  }

  /** Box centered at (lx, ly, lz). */
  box(lx: number, ly: number, lz: number, w: number, h: number, d: number, mat: MaterialId, color = 0xffffff, o: PartOptions = {}): void {
    this.ctx.batcher.add(boxGeo(w, h, d), mat, this.matrix(lx, ly, lz, o), color, this.layer, o.shade ?? 0);
  }

  /** Box resting on y = base. */
  block(lx: number, base: number, lz: number, w: number, h: number, d: number, mat: MaterialId, color = 0xffffff, o: PartOptions = {}): void {
    this.box(lx, base + h / 2, lz, w, h, d, mat, color, o);
  }

  cyl(lx: number, ly: number, lz: number, rTop: number, rBottom: number, h: number, segs: number, mat: MaterialId, color = 0xffffff, o: PartOptions = {}): void {
    this.ctx.batcher.add(cylinderGeo(rTop, rBottom, h, segs), mat, this.matrix(lx, ly, lz, o), color, this.layer, o.shade ?? 0);
  }

  cone(lx: number, ly: number, lz: number, r: number, h: number, segs: number, mat: MaterialId, color = 0xffffff, o: PartOptions = {}): void {
    this.ctx.batcher.add(coneGeo(r, h, segs), mat, this.matrix(lx, ly, lz, o), color, this.layer, o.shade ?? 0);
  }

  blob(lx: number, ly: number, lz: number, r: number, mat: MaterialId, color = 0xffffff, o: PartOptions & { sx?: number; sy?: number; sz?: number } = {}): void {
    const g = blobGeo(r, 0);
    g.scale(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    this.ctx.batcher.add(g, mat, this.matrix(lx, ly, lz, o), color, this.layer, o.shade ?? 0);
  }

  flat(lx: number, ly: number, lz: number, w: number, d: number, mat: MaterialId, color = 0xffffff, o: PartOptions = {}): void {
    this.ctx.batcher.add(groundPlaneGeo(w, d), mat, this.matrix(lx, ly, lz, o), color, this.layer);
  }

  /** Converts a local point to world XZ. */
  point(lx: number, lz: number): { x: number; z: number } {
    const s = this.scale;
    return {
      x: this.x + (lx * this.cos + lz * this.sin) * s,
      z: this.z + (-lx * this.sin + lz * this.cos) * s,
    };
  }

  /** Registers an oriented box collider in local space. */
  collider(lx: number, lz: number, hx: number, hz: number, flags: number, yMin = 0, yMax = 2, localRot = 0, tag = '', ref: unknown = null): Collider {
    const p = this.point(lx, lz);
    return this.ctx.physics.add({
      cx: p.x,
      cz: p.z,
      hx: hx * this.scale,
      hz: hz * this.scale,
      rot: this.rot + localRot,
      yMin: this.y + yMin * this.scale,
      yMax: this.y + yMax * this.scale,
      flags,
      tag,
      ref,
    });
  }

  /** A unique (non-batched) mesh placed in local space. */
  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, lx: number, ly: number, lz: number, o: PartOptions = {}, parent?: THREE.Object3D): THREE.Mesh {
    const m = new THREE.Mesh(geometry, material);
    m.applyMatrix4(this.matrix(lx, ly, lz, o));
    (parent ?? this.ctx.dynamicRoot).add(m);
    return m;
  }
}
