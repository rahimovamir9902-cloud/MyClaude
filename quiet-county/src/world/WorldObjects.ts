import * as THREE from 'three';
import { damp } from '../core/math';
import type { ItemStack } from '../systems/Inventory';
import type { Collider } from './Physics';
import type { ContainerSpec, DoorDef, NoteDef, PickupDef, SavePointDef } from './LevelTypes';

/** Every object the player can interact with exposes this minimal shape. */
export type InteractableKind = 'container' | 'door' | 'pickup' | 'note' | 'save' | 'npc' | 'extraction';

export interface Interactable {
  readonly id: string;
  readonly kind: InteractableKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
  enabled: boolean;
}

export class Door implements Interactable {
  readonly kind = 'door' as const;
  readonly radius = 2.0;
  enabled = true;
  open = false;
  locked: boolean;
  private angle = 0;
  private targetAngle = 0;
  private swingSign = 1;

  constructor(
    readonly id: string,
    readonly def: DoorDef,
    readonly x: number,
    readonly z: number,
    readonly y: number,
    /** Unit normal pointing to the "inside" side of the door. */
    readonly insideX: number,
    readonly insideZ: number,
    readonly leaves: THREE.Object3D[],
    readonly collider: Collider,
  ) {
    this.locked = def.lock !== 'none';
  }

  /** Barred doors only open from the inside. */
  isInsideSide(px: number, pz: number): boolean {
    return (px - this.x) * this.insideX + (pz - this.z) * this.insideZ > 0;
  }

  setOpen(open: boolean, fromX = this.x + this.insideX, fromZ = this.z + this.insideZ, instant = false): void {
    this.open = open;
    this.collider.enabled = !open;
    if (open) {
      // Swing away from whoever opens it. A positive angle moves the leaf toward
      // (-sin(base), -cos(base)); pick the sign that points away from the opener.
      const base = (this.leaves[0]?.userData.baseRot as number) ?? 0;
      const dot = -Math.sin(base) * (fromX - this.x) - Math.cos(base) * (fromZ - this.z);
      this.swingSign = dot > 0 ? -1 : 1;
      this.targetAngle = (Math.PI / 2) * 0.92 * this.swingSign;
    } else {
      this.targetAngle = 0;
    }
    if (instant) {
      this.angle = this.targetAngle;
      this.applyAngle();
    }
  }

  update(dt: number): void {
    if (Math.abs(this.angle - this.targetAngle) < 0.001) return;
    this.angle = damp(this.angle, this.targetAngle, 9, dt);
    this.applyAngle();
  }

  private applyAngle(): void {
    this.leaves.forEach((leaf, i) => {
      leaf.rotation.y = (leaf.userData.baseRot as number) + this.angle * (i === 0 ? 1 : -1);
    });
  }
}

export class LootContainer implements Interactable {
  readonly kind = 'container' as const;
  readonly radius = 1.6;
  enabled = true;
  searched = false;
  contents: ItemStack[] = [];

  constructor(
    readonly spec: ContainerSpec,
    readonly x: number,
    readonly z: number,
    readonly y: number,
  ) {}

  get id(): string {
    return this.spec.id;
  }

  get searchTime(): number {
    return this.spec.searchTime ?? 1.2;
  }
}

export class Pickup implements Interactable {
  readonly kind = 'pickup' as const;
  readonly radius = 1.5;
  enabled = true;

  constructor(
    readonly def: PickupDef,
    readonly mesh: THREE.Object3D,
  ) {}

  get id(): string {
    return this.def.id;
  }
  get x(): number {
    return this.def.x;
  }
  get y(): number {
    return this.def.y;
  }
  get z(): number {
    return this.def.z;
  }

  collect(): void {
    this.enabled = false;
    this.mesh.visible = false;
  }
}

export class NoteObject implements Interactable {
  readonly kind = 'note' as const;
  readonly radius = 1.5;
  enabled = true;
  constructor(readonly def: NoteDef) {}
  get id(): string {
    return this.def.id;
  }
  get x(): number {
    return this.def.x;
  }
  get y(): number {
    return this.def.y;
  }
  get z(): number {
    return this.def.z;
  }
}

export class SavePoint implements Interactable {
  readonly kind = 'save' as const;
  readonly radius = 1.8;
  enabled = true;
  constructor(readonly def: SavePointDef) {}
  get id(): string {
    return this.def.id;
  }
  get x(): number {
    return this.def.x;
  }
  get y(): number {
    return 0.6;
  }
  get z(): number {
    return this.def.z;
  }
}

export class ExtractionPoint implements Interactable {
  readonly kind = 'extraction' as const;
  readonly id = 'extraction';
  enabled = true;
  constructor(
    readonly x: number,
    readonly z: number,
    readonly radius: number,
    readonly label: string,
    readonly beacon: THREE.Object3D,
  ) {}
  get y(): number {
    return 1;
  }
}
