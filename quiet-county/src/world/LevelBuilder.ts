import * as THREE from 'three';
import type { QualityPreset } from '../config/quality';
import { createLogger } from '../core/Logger';
import { Random } from '../core/Random';
import { boxGeo, groundPlaneGeo, paintVertexColors, signPlaneGeo } from '../render/geometry';
import type { MaterialLibrary } from '../render/Materials';
import { StaticBatcher } from '../render/StaticBatcher';
import { NavGrid } from './NavGrid';
import { CF, PhysicsWorld } from './Physics';
import type { ContainerSpec, LevelDef, LightDef, NpcDef, Rect, SpawnDef, Surface } from './LevelTypes';
import { Door, ExtractionPoint, LootContainer, NoteObject, Pickup, SavePoint } from './WorldObjects';
import { ZoneManager, inRect } from './Zones';
import { buildBuilding, type BuiltBuilding } from './prefabs/building';
import { buildFence } from './prefabs/fences';
import { buildProp } from './prefabs/props';
import { PropBuilder, type BuildContext } from './prefabs/PropBuilder';
import { buildVehicle } from './prefabs/vehicles';
import { Vegetation } from './prefabs/vegetation';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';

const log = createLogger('LevelBuilder');
const POINT_LIGHT_SCALE = 16;

export interface InteriorGroup {
  buildingId: string;
  zoneId: string;
  rect: Rect;
  interior: THREE.Object3D[];
  roof: THREE.Object3D[];
}

export interface LevelLight {
  light: THREE.PointLight;
  def: LightDef;
  base: number;
}

export interface AlarmVehicle {
  vehicleId: string;
  containerId: string;
  light: THREE.Mesh;
  x: number;
  z: number;
}

export interface BuiltLevel {
  def: LevelDef;
  root: THREE.Group;
  physics: PhysicsWorld;
  nav: NavGrid;
  zones: ZoneManager;
  doors: Map<string, Door>;
  containers: Map<string, LootContainer>;
  pickups: Map<string, Pickup>;
  notes: Map<string, NoteObject>;
  savePoints: SavePoint[];
  extraction: ExtractionPoint;
  interiors: InteriorGroup[];
  vegetation: Vegetation;
  lights: LevelLight[];
  alarmVehicles: AlarmVehicle[];
  headlights: THREE.Mesh[];
  spawns: SpawnDef[];
  npcs: NpcDef[];
  stats: { colliders: number; batchedMeshes: number; triangles: number; navCells: number; trees: number; grass: number };
  surfaceAt(x: number, z: number): Surface;
  dispose(): void;
}

/** Turns a {@link LevelDef} into scene graph, physics, navigation and interactables. */
export class LevelBuilder {
  constructor(
    private readonly materials: MaterialLibrary,
    private readonly quality: QualityPreset,
    private readonly bus: EventBus<GameEvents> | null,
  ) {}

  build(def: LevelDef): BuiltLevel {
    const t0 = performance.now();
    const b = def.bounds;
    const root = new THREE.Group();
    root.name = `level:${def.id}`;
    const dynamicRoot = new THREE.Group();
    dynamicRoot.name = 'dynamic';
    root.add(dynamicRoot);
    const physics = new PhysicsWorld(b.x0 - 4, b.z0 - 4, b.x1 + 4, b.z1 + 4, 8);
    const batcher = new StaticBatcher(this.materials, 48);
    const rng = new Random(def.seed);
    const interiorExtras = new Map<string, THREE.Group>();
    const ctx: BuildContext = { batcher, physics, materials: this.materials, dynamicRoot, rng, interiorExtras };
    const extrasFor = (buildingId?: string): THREE.Object3D => {
      if (!buildingId) return dynamicRoot;
      let g = interiorExtras.get(buildingId);
      if (!g) {
        g = new THREE.Group();
        g.name = `interior-extras:${buildingId}`;
        interiorExtras.set(buildingId, g);
        root.add(g);
      }
      return g;
    };

    // Ground: base plane well past the bounds so the horizon never shows an edge.
    const margin = 90;
    const base = groundPlaneGeo(b.x1 - b.x0 + margin * 2, b.z1 - b.z0 + margin * 2);
    batcher.add(base, def.baseGround.material, new THREE.Matrix4().makeTranslation((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2), def.baseGround.color ?? 0xffffff, 'ground');
    def.ground.forEach((g, i) => {
      const geo = groundPlaneGeo(g.rect.x1 - g.rect.x0, g.rect.z1 - g.rect.z0);
      batcher.add(geo, g.material, new THREE.Matrix4().makeTranslation((g.rect.x0 + g.rect.x1) / 2, 0.006 + i * 0.002, (g.rect.z0 + g.rect.z1) / 2), g.color ?? 0xffffff, 'ground');
    });
    for (const road of def.roads) this.buildRoad(ctx, road.rect, road.axis, road.lanes);

    // Invisible boundary walls.
    const bw = 1;
    for (const r of [
      { cx: (b.x0 + b.x1) / 2, cz: b.z0 - bw, hx: (b.x1 - b.x0) / 2 + bw * 2, hz: bw },
      { cx: (b.x0 + b.x1) / 2, cz: b.z1 + bw, hx: (b.x1 - b.x0) / 2 + bw * 2, hz: bw },
      { cx: b.x0 - bw, cz: (b.z0 + b.z1) / 2, hx: bw, hz: (b.z1 - b.z0) / 2 + bw * 2 },
      { cx: b.x1 + bw, cz: (b.z0 + b.z1) / 2, hx: bw, hz: (b.z1 - b.z0) / 2 + bw * 2 },
    ]) {
      physics.add({ ...r, yMin: 0, yMax: 20, flags: CF.Move | CF.Camera | CF.Boundary, tag: 'boundary' });
    }

    const zones = new ZoneManager(this.bus);
    def.zones.forEach((z) => zones.add(z));

    // Buildings.
    const doors = new Map<string, Door>();
    const doorRoot = new THREE.Group();
    doorRoot.name = 'doors';
    root.add(doorRoot);
    interiorExtras.set('__doors', doorRoot);
    const builtBuildings: BuiltBuilding[] = [];
    for (const bd of def.buildings) {
      const built = buildBuilding(ctx, bd, def.doors);
      builtBuildings.push(built);
      zones.add(built.zone);
      built.doors.forEach((d) => doors.set(d.id, d));
    }
    interiorExtras.delete('__doors');

    for (const f of def.fences) buildFence(ctx, f);

    // Vehicles (some carry loot or an alarm).
    const containers = new Map<string, LootContainer>();
    const alarmVehicles: AlarmVehicle[] = [];
    const registerContainer = (spec: ContainerSpec, x: number, z: number, rot: number, defaultOffset: { x: number; z: number }, y = 0.8) => {
      const off = spec.offset ?? defaultOffset;
      const cx = x + off.x * Math.cos(rot) + off.z * Math.sin(rot);
      const cz = z - off.x * Math.sin(rot) + off.z * Math.cos(rot);
      if (containers.has(spec.id)) log.warn(`Duplicate container id ${spec.id}`);
      containers.set(spec.id, new LootContainer(spec, cx, cz, y));
    };
    for (const v of def.vehicles) {
      const built = buildVehicle(ctx, v);
      if (v.container) {
        registerContainer(v.container, v.x, v.z, v.rot, { x: -(built.width / 2 + 0.55), z: -0.2 });
        if (v.container.alarm && built.alarmLight) {
          alarmVehicles.push({ vehicleId: v.id, containerId: v.container.id, light: built.alarmLight, x: v.x, z: v.z });
        }
      }
    }

    // Props.
    for (const p of def.props) {
      const layer = p.interior ? `interior:${p.interior}` : 'world';
      buildProp(ctx, p, layer);
      if (p.container) registerContainer(p.container, p.x, p.z, p.rot ?? 0, { x: 0, z: 0.75 }, (p.y ?? 0) + 0.8);
    }

    // Pickups, notes, save points.
    const pickups = new Map<string, Pickup>();
    for (const pd of def.pickups) {
      const mesh = this.pickupMesh(pd.itemId);
      mesh.position.set(pd.x, pd.y, pd.z);
      extrasFor(pd.interior).add(mesh);
      pickups.set(pd.id, new Pickup(pd, mesh));
    }
    const notes = new Map<string, NoteObject>();
    for (const nd of def.notes) {
      const g = boxGeo(0.22, 0.01, 0.3);
      paintVertexColors(g, 0xeae4d2);
      const mesh = new THREE.Mesh(g, this.materials.get('paint'));
      mesh.position.set(nd.x, nd.y, nd.z);
      mesh.rotation.y = rng.range(-0.6, 0.6);
      extrasFor(nd.interior).add(mesh);
      notes.set(nd.id, new NoteObject(nd));
    }
    const savePoints = def.savePoints.map((sp) => {
      const pb = new PropBuilder(ctx, sp.x, sp.z, sp.rot ?? 0, 1, sp.interior ? `interior:${sp.interior}` : 'world');
      pb.block(0, 0, 0, 0.42, 0.24, 0.22, 'paint', 0x3a4232);
      pb.cyl(0.15, 0.5, 0, 0.008, 0.008, 0.55, 4, 'plain', 0x111111);
      const led = boxGeo(0.06, 0.04, 0.01);
      paintVertexColors(led, 0x40ff70);
      pb.mesh(led, this.materials.get('emissive'), -0.12, 0.16, 0.112, {}, extrasFor(sp.interior));
      return new SavePoint(sp);
    });

    // Extraction vehicle and beacon.
    const ex = def.extraction;
    const exVehicle = buildVehicle(ctx, ex.vehicle);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffb24a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 40, 12, 1, true), beaconMat);
    beacon.position.set(ex.x, 20, ex.z);
    beacon.visible = false;
    beacon.name = 'extraction-beacon';
    dynamicRoot.add(beacon);
    const extraction = new ExtractionPoint(ex.x, ex.z, ex.radius, ex.label, beacon);
    if (exVehicle.headlights.length) this.addLightPool(dynamicRoot, ex.vehicle.x, ex.vehicle.z, ex.vehicle.rot, exVehicle.length);

    // Decals.
    for (const d of def.decals) this.buildDecal(extrasFor(d.interior), d);

    // Point lights (fixed count, never added/removed at runtime to avoid shader recompiles).
    // Authored intensities are relative; convert to physical (candela-like) units.
    const lights: LevelLight[] = def.lights.slice(0, 4).map((ld) => {
      const light = new THREE.PointLight(ld.color, ld.intensity * POINT_LIGHT_SCALE, ld.distance, 1.6);
      light.position.set(ld.x, ld.y, ld.z);
      root.add(light);
      return { light, def: ld, base: ld.intensity * POINT_LIGHT_SCALE };
    });

    // Vegetation, avoiding buildings, roads and the extraction area.
    const vegetation = new Vegetation(this.materials, this.quality, rng.fork('veg'));
    const blockers: Rect[] = [
      ...def.buildings.map((bd) => grow(bd.rect, 2.5)),
      ...def.roads.map((r) => grow(r.rect, 1.5)),
      grow({ x0: ex.x - 4, z0: ex.z - 4, x1: ex.x + 4, z1: ex.z + 4 }, 2),
    ];
    for (const f of def.forests) vegetation.addForest(f, blockers);
    for (const g of def.grass) {
      vegetation.addGrass(g);
      if (g.zoneId) zones.add({ id: g.zoneId, label: 'Tall grass', kind: 'grass', rect: g.rect });
    }
    vegetation.build(physics, def.bounds, this.quality.shadows);
    root.add(vegetation.root);

    // Merge all static geometry.
    const groups = batcher.build({ cast: this.quality.shadows, receive: this.quality.shadows });
    for (const [layer, group] of groups) {
      if (layer === 'ground') group.children.forEach((m) => ((m as THREE.Mesh).castShadow = false));
      root.add(group);
    }
    const interiors: InteriorGroup[] = builtBuildings.map((bb) => ({
      buildingId: bb.def.id,
      zoneId: bb.zone.id,
      rect: bb.def.rect,
      interior: [groups.get(bb.interiorLayer), interiorExtras.get(bb.def.id)].filter((o): o is THREE.Group => !!o),
      roof: [groups.get(bb.roofLayer)].filter((o): o is THREE.Group => !!o),
    }));

    // Navigation for infected and NPCs.
    const nav = new NavGrid(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0, 0.5);
    nav.bake(physics, 0.4);

    const surfaceAt = (x: number, z: number): Surface => {
      for (const bd of def.buildings) if (inRect(bd.rect, x, z)) return bd.floorSurface;
      for (const r of def.roads) if (inRect(r.rect, x, z)) return 'asphalt';
      for (let i = def.ground.length - 1; i >= 0; i--) if (inRect(def.ground[i].rect, x, z)) return def.ground[i].surface;
      return def.baseGround.surface;
    };

    const stats = {
      colliders: physics.count,
      batchedMeshes: batcher.stats.outputMeshes,
      triangles: Math.round(batcher.stats.triangles),
      navCells: nav.cellCount,
      trees: vegetation.treeCount,
      grass: vegetation.grassCount,
    };
    log.info(`Built level ${def.id} in ${Math.round(performance.now() - t0)}ms`, stats);

    return {
      def, root, physics, nav, zones, doors, containers, pickups, notes, savePoints, extraction, interiors,
      vegetation, lights, alarmVehicles, headlights: exVehicle.headlights, spawns: def.spawns, npcs: def.npcs, stats, surfaceAt,
      dispose: () => {
        root.traverse((o) => {
          if (o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh)) o.geometry.dispose();
        });
        vegetation.dispose();
        beaconMat.dispose();
      },
    };
  }

  private buildRoad(ctx: BuildContext, rect: Rect, axis: 'x' | 'z', lanes: number): void {
    const w = rect.x1 - rect.x0;
    const d = rect.z1 - rect.z0;
    ctx.batcher.add(groundPlaneGeo(w, d), 'asphalt', new THREE.Matrix4().makeTranslation((rect.x0 + rect.x1) / 2, 0.012, (rect.z0 + rect.z1) / 2), 0xffffff, 'ground');
    const along = axis === 'z' ? d : w;
    const across = axis === 'z' ? w : d;
    const cx = (rect.x0 + rect.x1) / 2;
    const cz = (rect.z0 + rect.z1) / 2;
    const line = (offsetAcross: number, start: number, length: number, color: number, width = 0.14) => {
      const geo = axis === 'z' ? groundPlaneGeo(width, length) : groundPlaneGeo(length, width);
      const x = axis === 'z' ? cx + offsetAcross : rect.x0 + start + length / 2;
      const z = axis === 'z' ? rect.z0 + start + length / 2 : cz + offsetAcross;
      ctx.batcher.add(geo, 'roadLine', new THREE.Matrix4().makeTranslation(x, 0.02, z), color, 'ground');
    };
    // Edge lines and a dashed, faded center line.
    line(-across / 2 + 0.4, 0, along, 0xe8e6dc);
    line(across / 2 - 0.4, 0, along, 0xe8e6dc);
    if (lanes >= 2) for (let s = 1; s < along - 3; s += 9) line(0, s, 3.2, 0xd8b440, 0.16);
  }

  private pickupMesh(itemId: string): THREE.Object3D {
    const group = new THREE.Group();
    const add = (w: number, h: number, d: number, color: number, y: number, x = 0, z = 0, mat: 'paint' | 'rust' | 'fabric' = 'paint') => {
      const g = boxGeo(w, h, d);
      paintVertexColors(g, color);
      const m = new THREE.Mesh(g, this.materials.get(mat));
      m.position.set(x, y, z);
      group.add(m);
      return m;
    };
    if (itemId === 'q_clinic_case') {
      add(0.62, 0.22, 0.42, 0xe0701c, 0.11);
      add(0.2, 0.04, 0.04, 0x222222, 0.25);
      add(0.12, 0.12, 0.005, 0xf0f0f0, 0.12, 0, 0.212);
      add(0.04, 0.12, 0.006, 0xc02020, 0.12, 0, 0.214);
      add(0.12, 0.04, 0.006, 0xc02020, 0.12, 0, 0.214);
    } else if (itemId === 'q_fuel_can') {
      add(0.38, 0.48, 0.18, 0xa82a1e, 0.24, 0, 0, 'rust');
      add(0.08, 0.1, 0.06, 0x202020, 0.53, 0.12);
      add(0.18, 0.04, 0.04, 0x8a1e16, 0.52, -0.05);
    } else if (itemId.startsWith('w_')) {
      add(0.7, 0.05, 0.12, 0x3a3a3a, 0.03);
    } else if (itemId.startsWith('ammo')) {
      add(0.16, 0.1, 0.1, 0x6a5a2a, 0.05);
    } else if (itemId === 'medkit' || itemId === 'bandage') {
      add(0.3, 0.12, 0.2, 0xe8e8e4, 0.06);
      add(0.1, 0.005, 0.03, 0xc02020, 0.122);
      add(0.03, 0.005, 0.1, 0xc02020, 0.122);
    } else {
      add(0.25, 0.15, 0.2, 0x8a7a5a, 0.075);
    }
    group.name = `pickup:${itemId}`;
    return group;
  }

  private addLightPool(parent: THREE.Object3D, x: number, z: number, rot: number, length: number): void {
    // Fake headlight pool: an additive gradient on the road instead of a real light.
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const c2 = canvas.getContext('2d')!;
    const grad = c2.createRadialGradient(32, 120, 4, 32, 70, 70);
    grad.addColorStop(0, 'rgba(255,236,190,0.9)');
    grad.addColorStop(1, 'rgba(255,236,190,0)');
    c2.fillStyle = grad;
    c2.fillRect(0, 0, 64, 128);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 });
    const mesh = new THREE.Mesh(groundPlaneGeo(4, 9), mat);
    const fx = -Math.sin(rot);
    const fz = -Math.cos(rot);
    mesh.position.set(x + fx * (length / 2 + 4.3), 0.04, z + fz * (length / 2 + 4.3));
    mesh.rotation.y = rot;
    parent.add(mesh);
  }

  private buildDecal(parent: THREE.Object3D, d: LevelDef['decals'][number]): void {
    let mat: THREE.Material;
    if (d.kind === 'graffiti') mat = this.materials.graffiti(d.text ?? '', d.color ?? '#b8261c');
    else if (d.kind === 'blood') mat = this.materials.splatter(Math.round(d.x * 7 + d.z * 3) % 5);
    else if (d.kind === 'oil') mat = this.materials.splatter(Math.round(d.x + d.z) % 3, true);
    else
      mat = this.materials.sign(`decal:${d.text}`, {
        width: 512, height: 256, background: d.background ?? '#d8d2c2', color: d.color ?? '#2a2a2a',
        font: 'bold 54px Arial, sans-serif', lines: (d.text ?? '').split('|'), grime: 1.2,
      });
    const mesh = new THREE.Mesh(signPlaneGeo(d.w, d.h), mat);
    mesh.position.set(d.x, d.y, d.z);
    if (d.flat) {
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = d.rot;
    } else {
      mesh.rotation.y = d.rot;
    }
    mesh.renderOrder = 1;
    parent.add(mesh);
  }
}

function grow(r: Rect, by: number): Rect {
  return { x0: r.x0 - by, z0: r.z0 - by, x1: r.x1 + by, z1: r.z1 + by };
}
