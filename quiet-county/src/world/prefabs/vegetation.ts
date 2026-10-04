import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { QualityPreset } from '../../config/quality';
import type { Random } from '../../core/Random';
import { blobGeo, coneGeo, cylinderGeo, ensureIndexed, paintVertexColors } from '../../render/geometry';
import type { MaterialLibrary } from '../../render/Materials';
import { CF, type PhysicsWorld } from '../Physics';
import type { ForestDef, GrassDef, Rect } from '../LevelTypes';
import { inRect } from '../Zones';

interface TreeInstance {
  x: number;
  z: number;
  scale: number;
  rot: number;
  pine: boolean;
  tint: number;
}

interface GrassInstance {
  x: number;
  z: number;
  scale: number;
  rot: number;
  tall: boolean;
}

interface TreeChunk {
  cx: number;
  cz: number;
  near: THREE.InstancedMesh[];
  far: THREE.InstancedMesh[];
  lodNear: boolean;
}

interface GrassChunk {
  cx: number;
  cz: number;
  mesh: THREE.InstancedMesh;
}

const TREE_CHUNK = 56;
const GRASS_CHUNK = 24;

function colored(g: THREE.BufferGeometry, color: number, y: number, x = 0, z = 0): THREE.BufferGeometry {
  const out = ensureIndexed(g);
  out.translate(x, y, z);
  paintVertexColors(out, color, 0.25);
  return out;
}

function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const p of parts) for (const name of Object.keys(p.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) p.deleteAttribute(name);
  const merged = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** Wind sway for instanced foliage: displacement grows with height above `pivot`. */
function addWind(material: THREE.Material, uniforms: { uTime: { value: number } }, amount: number, pivot: number): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float windH = max(position.y - ${pivot.toFixed(2)}, 0.0);
          vec4 windP = instanceMatrix[3];
          float windPh = windP.x * 0.23 + windP.z * 0.19;
          transformed.x += sin(uTime * 1.4 + windPh) * ${amount.toFixed(3)} * windH;
          transformed.z += cos(uTime * 1.1 + windPh * 1.3) * ${(amount * 0.7).toFixed(3)} * windH;
        #endif`,
      );
  };
}

/**
 * Instanced trees and grass. Trees are grouped in chunks that swap between a detailed and a
 * low-poly variant by distance (LOD); grass chunks are distance culled. Tall grass areas are
 * also stealth cover zones.
 */
export class Vegetation {
  readonly root = new THREE.Group();
  private readonly trees: TreeInstance[] = [];
  private readonly grass: GrassInstance[] = [];
  private readonly treeChunks: TreeChunk[] = [];
  private readonly grassChunks: GrassChunk[] = [];
  private readonly uniforms = { uTime: { value: 0 } };
  private lodTimer = 0;
  private treeMaterial: THREE.MeshLambertMaterial | null = null;
  private grassMaterial: THREE.MeshLambertMaterial | null = null;

  constructor(
    private readonly materials: MaterialLibrary,
    private readonly quality: QualityPreset,
    private readonly rng: Random,
  ) {
    this.root.name = 'vegetation';
  }

  get treeCount(): number {
    return this.trees.length;
  }

  get grassCount(): number {
    return this.grass.length;
  }

  addForest(def: ForestDef, blockers: Rect[]): void {
    const { x0, z0, x1, z1 } = def.rect;
    const minSpacing = 2.4;
    let placed = 0;
    for (let attempt = 0; attempt < def.count * 8 && placed < def.count; attempt++) {
      const x = this.rng.range(x0, x1);
      const z = this.rng.range(z0, z1);
      if (blockers.some((r) => inRect(r, x, z)) || (def.avoid ?? []).some((r) => inRect(r, x, z))) continue;
      if (this.trees.some((t) => Math.abs(t.x - x) < minSpacing && Math.abs(t.z - z) < minSpacing)) continue;
      this.addTree(x, z, this.rng.chance(def.pineRatio));
      placed++;
    }
  }

  addTree(x: number, z: number, pine: boolean, scale = this.rng.range(0.8, 1.3)): void {
    this.trees.push({ x, z, scale, rot: this.rng.next() * Math.PI * 2, pine, tint: this.rng.range(0.78, 1.08) });
  }

  addGrass(def: GrassDef): void {
    const { x0, z0, x1, z1 } = def.rect;
    const area = (x1 - x0) * (z1 - z0);
    const count = Math.round(area * def.density * this.quality.grassDensity);
    for (let i = 0; i < count; i++) {
      this.grass.push({
        x: this.rng.range(x0, x1),
        z: this.rng.range(z0, z1),
        scale: this.rng.range(0.75, 1.25),
        rot: this.rng.next() * Math.PI,
        tall: def.tall,
      });
    }
  }

  /** Creates instanced meshes and trunk colliders for trees inside the playable area. */
  build(physics: PhysicsWorld, playable: Rect, shadows: boolean): void {
    this.treeMaterial = new THREE.MeshLambertMaterial({ map: this.materials.texture('mottle', 2), vertexColors: true });
    addWind(this.treeMaterial, this.uniforms, 0.025, 2.0);
    this.grassMaterial = new THREE.MeshLambertMaterial({
      map: this.materials.texture('grassBlade', 1),
      vertexColors: true,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
    });
    addWind(this.grassMaterial, this.uniforms, 0.18, 0.05);

    const geos = {
      pineNear: mergeParts([
        colored(cylinderGeo(0.12, 0.2, 2.2, 6), 0x5c4a38, 1.1),
        colored(coneGeo(1.7, 2.6, 7), 0x46663e, 3.4),
        colored(coneGeo(1.35, 2.2, 7), 0x4e7044, 4.6),
        colored(coneGeo(0.95, 1.9, 7), 0x587a48, 5.7),
      ]),
      pineFar: mergeParts([colored(cylinderGeo(0.15, 0.2, 2, 4), 0x5c4a38, 1), colored(coneGeo(1.6, 5.0, 5), 0x4a6a40, 4.4)]),
      leafNear: mergeParts([
        colored(cylinderGeo(0.14, 0.22, 2.8, 6), 0x66503a, 1.4),
        colored(blobGeo(1.6, 1), 0x62843e, 3.9),
        colored(blobGeo(1.1, 0), 0x6e8c46, 4.6, 0.8, 0.3),
        colored(blobGeo(1.0, 0), 0x5a7a3c, 4.3, -0.7, -0.4),
      ]),
      leafFar: mergeParts([colored(cylinderGeo(0.16, 0.22, 2.6, 4), 0x66503a, 1.3), colored(blobGeo(1.9, 0), 0x62843e, 4.0)]),
    };

    const byChunk = new Map<string, TreeInstance[]>();
    for (const t of this.trees) {
      const key = `${Math.floor(t.x / TREE_CHUNK)},${Math.floor(t.z / TREE_CHUNK)}`;
      let list = byChunk.get(key);
      if (!list) byChunk.set(key, (list = []));
      list.push(t);
      if (inRect(playable, t.x, t.z)) {
        const r = 0.22 * t.scale;
        physics.add({ cx: t.x, cz: t.z, hx: r, hz: r, yMin: 0, yMax: 6, flags: CF.Solid, tag: 'tree' });
      }
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const color = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [key, list] of byChunk) {
      const [cx, cz] = key.split(',').map(Number);
      const chunk: TreeChunk = { cx: (cx + 0.5) * TREE_CHUNK, cz: (cz + 0.5) * TREE_CHUNK, near: [], far: [], lodNear: true };
      for (const pine of [true, false]) {
        const subset = list.filter((t) => t.pine === pine);
        if (subset.length === 0) continue;
        for (const lod of ['near', 'far'] as const) {
          const geo = pine ? (lod === 'near' ? geos.pineNear : geos.pineFar) : lod === 'near' ? geos.leafNear : geos.leafFar;
          const mesh = new THREE.InstancedMesh(geo, this.treeMaterial, subset.length);
          subset.forEach((t, i) => {
            q.setFromAxisAngle(up, t.rot);
            m.compose(p.set(t.x, 0, t.z), q, s.set(t.scale, t.scale * this.rng.range(0.9, 1.1), t.scale));
            mesh.setMatrixAt(i, m);
            mesh.setColorAt(i, color.setScalar(t.tint));
          });
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          mesh.computeBoundingSphere();
          mesh.castShadow = shadows && lod === 'near';
          mesh.receiveShadow = false;
          mesh.visible = lod === 'near';
          mesh.name = `trees:${key}:${pine ? 'pine' : 'leaf'}:${lod}`;
          this.root.add(mesh);
          chunk[lod].push(mesh);
        }
      }
      this.treeChunks.push(chunk);
    }

    // Grass: two crossed quads, darker at the roots.
    const grassGeo = (w: number, h: number) => {
      const a = new THREE.PlaneGeometry(w, h);
      a.translate(0, h / 2, 0);
      const bq = a.clone();
      bq.rotateY(Math.PI / 2);
      const merged = mergeGeometries([a, bq], false)!;
      const pos = merged.getAttribute('position') as THREE.BufferAttribute;
      const cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const k = 0.5 + 0.5 * (pos.getY(i) / h);
        cols[i * 3] = k;
        cols[i * 3 + 1] = k;
        cols[i * 3 + 2] = k;
      }
      merged.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      return merged;
    };
    const tallGeo = grassGeo(1.1, 1.05);
    const shortGeo = grassGeo(0.7, 0.45);
    const grassByChunk = new Map<string, GrassInstance[]>();
    for (const g of this.grass) {
      const key = `${Math.floor(g.x / GRASS_CHUNK)},${Math.floor(g.z / GRASS_CHUNK)},${g.tall ? 1 : 0}`;
      let list = grassByChunk.get(key);
      if (!list) grassByChunk.set(key, (list = []));
      list.push(g);
    }
    for (const [key, list] of grassByChunk) {
      const [cx, cz, tall] = key.split(',').map(Number);
      const mesh = new THREE.InstancedMesh(tall ? tallGeo : shortGeo, this.grassMaterial, list.length);
      list.forEach((g, i) => {
        q.setFromAxisAngle(up, g.rot);
        m.compose(p.set(g.x, 0, g.z), q, s.set(g.scale, g.scale, g.scale));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, color.setRGB(this.rng.range(0.85, 1.05), this.rng.range(0.85, 1.05), this.rng.range(0.8, 1)));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.name = `grass:${key}`;
      this.root.add(mesh);
      this.grassChunks.push({ cx: (cx + 0.5) * GRASS_CHUNK, cz: (cz + 0.5) * GRASS_CHUNK, mesh });
    }
  }

  /** Wind animation every frame; LOD and culling a few times per second. */
  update(camX: number, camZ: number, dt: number): void {
    this.uniforms.uTime.value += dt;
    this.lodTimer -= dt;
    if (this.lodTimer > 0) return;
    this.lodTimer = 0.25;
    const lodDist = this.quality.treeLodDistance + TREE_CHUNK * 0.5;
    for (const c of this.treeChunks) {
      const near = Math.hypot(c.cx - camX, c.cz - camZ) < lodDist;
      if (near === c.lodNear) continue;
      c.lodNear = near;
      c.near.forEach((m) => (m.visible = near));
      c.far.forEach((m) => (m.visible = !near));
    }
    const grassDist = 34 + GRASS_CHUNK * 0.7;
    for (const g of this.grassChunks) g.mesh.visible = Math.hypot(g.cx - camX, g.cz - camZ) < grassDist;
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.geometry.dispose();
    });
    this.treeMaterial?.dispose();
    this.grassMaterial?.dispose();
  }
}
