import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createLogger } from '../core/Logger';
import { ensureIndexed, paintVertexColors } from './geometry';
import type { MaterialId, MaterialLibrary } from './Materials';

const log = createLogger('StaticBatcher');

interface Entry {
  geometry: THREE.BufferGeometry;
  material: MaterialId;
  chunk: string;
}

export interface BatchStats {
  inputMeshes: number;
  outputMeshes: number;
  triangles: number;
}

/**
 * Collects static geometry and merges it into one mesh per (layer, chunk, material).
 * Turns thousands of small props into a few dozen draw calls while chunking keeps
 * frustum culling effective. Layers let interiors and roofs be toggled as a group.
 */
export class StaticBatcher {
  private readonly layers = new Map<string, Entry[]>();
  readonly stats: BatchStats = { inputMeshes: 0, outputMeshes: 0, triangles: 0 };
  private readonly tmpBox = new THREE.Box3();
  private readonly tmpCenter = new THREE.Vector3();

  constructor(
    private readonly materials: MaterialLibrary,
    private readonly chunkSize = 48,
  ) {}

  /**
   * Adds a geometry (consumed: do not reuse it) transformed by `matrix`.
   * `bottomShade` darkens lower vertices slightly for cheap ambient occlusion.
   */
  add(geometry: THREE.BufferGeometry, material: MaterialId, matrix: THREE.Matrix4, color = 0xffffff, layer = 'world', bottomShade = 0): void {
    const g = geometry.index ? geometry : ensureIndexed(geometry);
    g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    paintVertexColors(g, color, bottomShade);
    g.computeBoundingBox();
    this.tmpBox.copy(g.boundingBox!).getCenter(this.tmpCenter);
    const cx = Math.floor(this.tmpCenter.x / this.chunkSize);
    const cz = Math.floor(this.tmpCenter.z / this.chunkSize);
    let list = this.layers.get(layer);
    if (!list) {
      list = [];
      this.layers.set(layer, list);
    }
    list.push({ geometry: g, material, chunk: `${cx},${cz}` });
    this.stats.inputMeshes++;
  }

  /** Builds merged meshes. Returns one group per layer. */
  build(shadows: { cast: boolean; receive: boolean }): Map<string, THREE.Group> {
    const out = new Map<string, THREE.Group>();
    for (const [layer, entries] of this.layers) {
      const group = new THREE.Group();
      group.name = `batch:${layer}`;
      const buckets = new Map<string, Entry[]>();
      for (const e of entries) {
        const key = `${e.chunk}|${e.material}`;
        let b = buckets.get(key);
        if (!b) {
          b = [];
          buckets.set(key, b);
        }
        b.push(e);
      }
      for (const [key, bucket] of buckets) {
        const merged = mergeGeometries(bucket.map((e) => e.geometry), false);
        if (!merged) {
          log.error(`Failed to merge bucket ${layer}/${key}`);
          continue;
        }
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, this.materials.get(bucket[0].material));
        mesh.name = `${layer}|${key}`;
        mesh.matrixAutoUpdate = false;
        mesh.castShadow = shadows.cast && layer.indexOf('roof:') !== 0;
        mesh.receiveShadow = shadows.receive;
        group.add(mesh);
        this.stats.outputMeshes++;
        this.stats.triangles += (merged.index ? merged.index.count : merged.getAttribute('position').count) / 3;
        bucket.forEach((e) => e.geometry.dispose());
      }
      out.set(layer, group);
    }
    this.layers.clear();
    log.info(`Batched ${this.stats.inputMeshes} pieces into ${this.stats.outputMeshes} meshes (${Math.round(this.stats.triangles)} tris)`);
    return out;
  }
}
