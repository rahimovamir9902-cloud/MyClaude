import * as THREE from 'three';
import type { QualityPreset } from '../config/quality';
import { paintGraffiti, paintSplatter, paintText, paintTexture, type TextTextureOptions, type TextureId } from './ProceduralTextures';

export type MaterialId =
  | 'asphalt'
  | 'concrete'
  | 'siding'
  | 'brick'
  | 'wood'
  | 'rust'
  | 'corrugated'
  | 'tile'
  | 'grass'
  | 'dirt'
  | 'gravel'
  | 'paint'
  | 'shingle'
  | 'foliage'
  | 'glass'
  | 'fabric'
  | 'plain'
  | 'emissive'
  | 'roadLine'
  | 'chainlink'
  | 'grassBlade';

interface MaterialSpec {
  texture?: TextureId;
  /** World meters covered by one texture tile (geometry UVs are in meters). */
  tile?: number;
  kind?: 'lambert' | 'basic';
  alphaTest?: number;
  doubleSide?: boolean;
  emissive?: number;
}

const SPECS: Record<MaterialId, MaterialSpec> = {
  asphalt: { texture: 'asphalt', tile: 6 },
  concrete: { texture: 'concrete', tile: 3 },
  siding: { texture: 'siding', tile: 2.4 },
  brick: { texture: 'brick', tile: 2 },
  wood: { texture: 'wood', tile: 2 },
  rust: { texture: 'rust', tile: 2.5 },
  corrugated: { texture: 'corrugated', tile: 2.5 },
  tile: { texture: 'tile', tile: 2 },
  grass: { texture: 'grass', tile: 5 },
  dirt: { texture: 'dirt', tile: 4 },
  gravel: { texture: 'gravel', tile: 3 },
  paint: { texture: 'paint', tile: 2 },
  shingle: { texture: 'shingle', tile: 2.5 },
  foliage: { texture: 'foliage', tile: 2 },
  glass: { texture: 'glass', tile: 2, emissive: 0x06090c },
  fabric: { texture: 'fabric', tile: 1 },
  plain: {},
  emissive: { kind: 'basic' },
  roadLine: { texture: 'roadLine', tile: 3, alphaTest: 0.5 },
  chainlink: { texture: 'chainlink', tile: 1.2, alphaTest: 0.5, doubleSide: true },
  grassBlade: { texture: 'grassBlade', tile: 1, alphaTest: 0.45, doubleSide: true },
};

/**
 * Creates and caches every material. All world materials use vertex colors so batched
 * geometry can be tinted per object without extra materials (and extra draw calls).
 */
export class MaterialLibrary {
  private readonly materials = new Map<MaterialId, THREE.Material>();
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly decals = new Map<string, THREE.Material>();

  constructor(
    private readonly quality: QualityPreset,
    private readonly maxAnisotropy = 1,
  ) {}

  get(id: MaterialId): THREE.Material {
    let m = this.materials.get(id);
    if (!m) {
      m = this.create(id);
      this.materials.set(id, m);
    }
    return m;
  }

  tileSize(id: MaterialId): number {
    return SPECS[id].tile ?? 1;
  }

  texture(id: TextureId, tile = 1): THREE.Texture {
    const key = `${id}@${tile}`;
    let t = this.textures.get(key);
    if (!t) {
      const canvas = paintTexture(id, this.quality.textureSize);
      t = new THREE.CanvasTexture(canvas);
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(1 / tile, 1 / tile);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(this.quality.anisotropy, this.maxAnisotropy);
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      this.textures.set(key, t);
    }
    return t;
  }

  /** Material for a painted sign or poster (cached by key). */
  sign(key: string, opts: TextTextureOptions, emissive = false): THREE.Material {
    const cacheKey = `sign:${key}`;
    let m = this.decals.get(cacheKey);
    if (!m) {
      const tex = new THREE.CanvasTexture(paintText(opts));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(this.quality.anisotropy, this.maxAnisotropy);
      m = emissive
        ? new THREE.MeshBasicMaterial({ map: tex })
        : new THREE.MeshLambertMaterial({ map: tex });
      this.decals.set(cacheKey, m);
    }
    return m;
  }

  graffiti(text: string, color: string): THREE.Material {
    const key = `graffiti:${text}:${color}`;
    let m = this.decals.get(key);
    if (!m) {
      const tex = new THREE.CanvasTexture(paintGraffiti(text, color, text.length));
      tex.colorSpace = THREE.SRGBColorSpace;
      m = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      this.decals.set(key, m);
    }
    return m;
  }

  splatter(variant: number, oil = false): THREE.Material {
    const key = `splat:${variant}:${oil}`;
    let m = this.decals.get(key);
    if (!m) {
      const tex = new THREE.CanvasTexture(paintSplatter(variant + 11, oil ? [14, 14, 16] : [62, 10, 8]));
      tex.colorSpace = THREE.SRGBColorSpace;
      m = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      this.decals.set(key, m);
    }
    return m;
  }

  dispose(): void {
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.decals.forEach((m) => {
      (m as THREE.MeshLambertMaterial).map?.dispose();
      m.dispose();
    });
    this.materials.clear();
    this.textures.clear();
    this.decals.clear();
  }

  private create(id: MaterialId): THREE.Material {
    const spec = SPECS[id];
    const map = spec.texture ? this.texture(spec.texture, spec.tile ?? 1) : null;
    if (spec.kind === 'basic') {
      return new THREE.MeshBasicMaterial({ vertexColors: true });
    }
    const m = new THREE.MeshLambertMaterial({
      map,
      vertexColors: true,
      side: spec.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      alphaTest: spec.alphaTest ?? 0,
    });
    if (spec.emissive) m.emissive.setHex(spec.emissive);
    m.name = id;
    return m;
  }
}
