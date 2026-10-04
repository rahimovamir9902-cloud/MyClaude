import type { ArchetypeId } from '../config/enemies';
import type { MaterialId } from '../render/Materials';
import type { ItemStack } from '../systems/Inventory';

/** Axis-aligned rectangle on the ground plane (x0 < x1, z0 < z1). North is -Z. */
export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export type Surface = 'asphalt' | 'concrete' | 'grass' | 'dirt' | 'gravel' | 'floor' | 'metal' | 'wood';

export interface GroundPatch {
  rect: Rect;
  material: MaterialId;
  surface: Surface;
  color?: number;
}

export interface RoadDef {
  rect: Rect;
  /** Direction of travel. */
  axis: 'x' | 'z';
  lanes: number;
}

export type OpeningKind = 'door' | 'window' | 'brokenWindow' | 'gap';

export interface Opening {
  /** Offset from the wall start (x0 for north/south walls, z0 for west/east walls). */
  at: number;
  width: number;
  kind: OpeningKind;
  doorId?: string;
  /** Top of the opening (lintel). */
  top?: number;
  /** Window sill height. */
  sill?: number;
}

export interface InteriorWall {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  openings?: Opening[];
}

export interface BuildingDef {
  id: string;
  name: string;
  rect: Rect;
  height: number;
  wallMaterial: MaterialId;
  wallColor: number;
  trimColor?: number;
  interiorMaterial: MaterialId;
  interiorColor: number;
  floorMaterial: MaterialId;
  floorColor?: number;
  floorSurface: Surface;
  roofMaterial: MaterialId;
  roofColor?: number;
  openings: { n?: Opening[]; s?: Opening[]; w?: Opening[]; e?: Opening[] };
  interiorWalls?: InteriorWall[];
}

export type DoorLock = 'none' | 'pry' | 'barred' | 'scripted';

export interface DoorDef {
  label: string;
  lock: DoorLock;
  material: MaterialId;
  color: number;
  double?: boolean;
  startsOpen?: boolean;
  /** Flag that unlocks a scripted door. */
  unlockFlag?: string;
  /** Message shown when locked. */
  lockedText?: string;
  /** Interacting with the locked door starts this NPC's dialogue (talking through it). */
  talkNpc?: string;
}

export type VehicleType = 'sedan' | 'wagon' | 'pickup' | 'van' | 'semiTrailer' | 'semiCab' | 'overturned';

export interface ContainerSpec {
  id: string;
  tableId: string;
  label: string;
  guaranteed?: ItemStack[];
  searchTime?: number;
  /** Flag set when searched (mission hooks). */
  setsFlag?: string;
  /** Searching trips an alarm. */
  alarm?: boolean;
  /** Local offset of the interaction point from the object center. */
  offset?: { x: number; z: number };
}

export interface VehicleDef {
  id: string;
  type: VehicleType;
  x: number;
  z: number;
  rot: number;
  color: number;
  wrecked?: boolean;
  doorsOpen?: boolean;
  /** Painted livery text on the side (vans). */
  livery?: string;
  alarmLight?: boolean;
  headlights?: boolean;
  container?: ContainerSpec;
}

export type PropType =
  | 'fuelPump' | 'canopy' | 'shelf' | 'counter' | 'fridge' | 'dumpster' | 'barrel' | 'pallet'
  | 'crate' | 'locker' | 'workbench' | 'toolbox' | 'cot' | 'desk' | 'chair' | 'tires' | 'signPole'
  | 'barrier' | 'utilityPole' | 'camper' | 'hayBale' | 'tractor' | 'suitcase' | 'backpack'
  | 'register' | 'boxes' | 'radio' | 'campfire' | 'medCabinet' | 'fileCabinet' | 'carLift'
  | 'drums' | 'generator' | 'mailbox' | 'bench' | 'pivot' | 'footlocker' | 'magazineRack'
  | 'bodyBag' | 'debris' | 'tarp' | 'lamp' | 'roadSign';

export interface PropDef {
  type: PropType;
  x: number;
  z: number;
  rot?: number;
  scale?: number;
  color?: number;
  /** Building id whose interior layer the prop belongs to (culled with the interior). */
  interior?: string;
  container?: ContainerSpec;
  text?: string;
  /** Size overrides for sized props (canopy, shelf, sign). */
  w?: number;
  d?: number;
  h?: number;
  /** Height the prop sits at (e.g. a toolbox on a bench). */
  y?: number;
}

export interface FenceDef {
  kind: 'chainlink' | 'wood' | 'guardrail';
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  gaps?: { at: number; width: number }[];
}

export interface PickupDef {
  id: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  z: number;
  ammo?: number;
  interior?: string;
}

export interface NoteDef {
  id: string;
  title: string;
  body: string;
  x: number;
  y: number;
  z: number;
  interior?: string;
}

export interface SavePointDef {
  id: string;
  label: string;
  x: number;
  z: number;
  rot?: number;
  interior?: string;
}

export interface ZoneDef {
  id: string;
  label: string;
  rect: Rect;
  kind: 'trigger' | 'grass' | 'interior' | 'extraction' | 'region';
}

export interface SpawnDef {
  id: string;
  archetype: ArchetypeId;
  x: number;
  z: number;
  rot?: number;
  dormant?: boolean;
  wanderRadius?: number;
  patrol?: { x: number; z: number }[];
  /** Only spawned when this group is triggered by a script. */
  group?: string;
  /** Spawned when night falls. */
  night?: boolean;
}

export interface NpcDef {
  id: string;
  name: string;
  x: number;
  z: number;
  rot: number;
  dialogueId: string;
  role: string;
  outfit: { shirt: number; pants: number; skin: number; hair: number };
  initialState: string;
  limp?: boolean;
  interior?: string;
}

export interface ExtractionDef {
  x: number;
  z: number;
  radius: number;
  label: string;
  vehicle: VehicleDef;
  driverNpc?: NpcDef;
}

export interface LightDef {
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  distance: number;
  flicker?: boolean;
  interior?: string;
}

export interface DecalDef {
  kind: 'graffiti' | 'blood' | 'oil' | 'sign';
  x: number;
  y: number;
  z: number;
  rot: number;
  /** Lie flat on the ground instead of on a wall. */
  flat?: boolean;
  w: number;
  h: number;
  text?: string;
  color?: string;
  background?: string;
  interior?: string;
}

export interface ForestDef {
  rect: Rect;
  count: number;
  pineRatio: number;
  avoid?: Rect[];
}

export interface GrassDef {
  rect: Rect;
  density: number;
  tall: boolean;
  zoneId?: string;
}

export interface LevelDef {
  id: string;
  name: string;
  region: string;
  bounds: Rect;
  seed: number;
  playerStart: { x: number; z: number; yaw: number };
  baseGround: { material: MaterialId; surface: Surface; color?: number };
  ground: GroundPatch[];
  roads: RoadDef[];
  buildings: BuildingDef[];
  doors: Record<string, DoorDef>;
  fences: FenceDef[];
  vehicles: VehicleDef[];
  props: PropDef[];
  pickups: PickupDef[];
  notes: NoteDef[];
  savePoints: SavePointDef[];
  zones: ZoneDef[];
  spawns: SpawnDef[];
  npcs: NpcDef[];
  extraction: ExtractionDef;
  lights: LightDef[];
  decals: DecalDef[];
  forests: ForestDef[];
  grass: GrassDef[];
  /** Named alarm emitters used by mission scripts. */
  alarmSources?: Record<string, { x: number; z: number; kind: 'car' | 'siren' }>;
}
