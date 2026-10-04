import * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { dampAngle, dirFromYaw, dist2D, yawFromDir } from '../core/math';
import type { NpcSaveState } from '../systems/SaveSystem';
import type { NpcDef } from '../world/LevelTypes';
import { CF } from '../world/Physics';
import type { Door, Interactable } from '../world/WorldObjects';
import { HumanoidRig } from './HumanoidRig';
import { Locomotion, type LocomotionHost } from './Locomotion';
import type { Player } from './Player';

export type NpcState = 'hiding' | 'idle' | 'following' | 'waiting' | 'boarded';
export type NpcCommand = 'follow' | 'stay' | 'treated' | 'hide' | 'board';

/**
 * A survivor with a name, role, relationship and simple behaviors. NPCs follow the player
 * with pathfinding, open doors, mirror the player's crouch and wait when told.
 */
export class Npc implements Interactable {
  readonly kind = 'npc' as const;
  readonly radius = 2.0;
  enabled = true;
  x: number;
  z: number;
  vx = 0;
  vz = 0;
  yaw: number;
  state: NpcState;
  relationship = 0;
  health = 100;
  treated = false;
  readonly rig: HumanoidRig;
  readonly loco = new Locomotion(0.32);
  private crouch = 0;
  private separatedTime = 0;

  constructor(
    readonly def: NpcDef,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.x = def.x;
    this.z = def.z;
    this.yaw = def.rot;
    this.state = def.initialState as NpcState;
    this.rig = new HumanoidRig({ skin: def.outfit.skin, shirt: def.outfit.shirt, pants: def.outfit.pants, hair: def.outfit.hair, height: 0.97 }, def.id.length * 31);
    this.syncTransform();
  }

  get id(): string {
    return this.def.id;
  }

  get y(): number {
    return 1.1;
  }

  get name(): string {
    return this.def.name;
  }

  command(cmd: NpcCommand): void {
    switch (cmd) {
      case 'follow':
        this.setState('following');
        break;
      case 'stay':
        this.setState('waiting');
        break;
      case 'treated':
        this.treated = true;
        if (this.state === 'hiding') this.setState('idle');
        break;
      case 'hide':
        this.setState('hiding');
        break;
      case 'board':
        this.setState('boarded');
        break;
    }
  }

  private setState(s: NpcState): void {
    if (this.state === s) return;
    this.state = s;
    this.loco.reset();
    this.rig.root.visible = s !== 'boarded';
    this.enabled = s !== 'boarded';
    this.bus.emit('npc:changed', { npcId: this.id, state: s });
  }

  update(dt: number, player: Player, host: LocomotionHost, doors: Map<string, Door>): void {
    if (this.state === 'boarded') return;
    const d = dist2D(this.x, this.z, player.x, player.z);
    let speed = 0;
    if (this.state === 'following' && player.alive) {
      if (d > 2.6) {
        const limpMax = this.def.limp && !this.treated ? 1.3 : 4.2;
        speed = Math.min(limpMax, d > 6 ? 4.4 : player.crouched ? 1.5 : 2.4);
        // Aim for a spot just behind the player.
        const back = dirFromYaw(player.yaw);
        this.loco.moveTo(this, player.x - back.x * 1.6, player.z - back.z * 1.6, speed, dt, host, 0.8, 0.9);
        this.openBlockingDoor(doors);
      } else {
        this.loco.halt(this, dt, host);
      }
      // Never lose the companion: if separated too long, catch up out of sight.
      this.separatedTime = d > 26 ? this.separatedTime + dt : 0;
      if (this.separatedTime > 4) {
        const back = dirFromYaw(player.yaw);
        const tx = player.x - back.x * 3;
        const tz = player.z - back.z * 3;
        if (!host.physics.circleBlocked(tx, tz, 0.35, CF.Move)) {
          this.x = tx;
          this.z = tz;
          this.loco.reset();
        }
        this.separatedTime = 0;
      }
    } else {
      this.loco.halt(this, dt, host);
    }

    const moving = Math.hypot(this.vx, this.vz);
    let targetYaw = this.yaw;
    if (moving > 0.2) targetYaw = yawFromDir(this.vx, this.vz);
    else if (d < 6 && this.state !== 'hiding') targetYaw = yawFromDir(player.x - this.x, player.z - this.z);
    this.yaw = dampAngle(this.yaw, targetYaw, 6, dt);

    const wantCrouch = this.state === 'hiding' || (this.state === 'following' && player.crouched);
    this.crouch += ((wantCrouch ? 1 : 0) - this.crouch) * Math.min(1, dt * 6);
    const pose = this.rig.pose;
    pose.speed = moving;
    pose.gait = moving > 3 ? 'run' : moving > 0.1 ? 'walk' : 'idle';
    pose.crouch = this.crouch;
    pose.limp = !!this.def.limp && !this.treated;
    this.syncTransform();
    this.rig.animate(dt);
  }

  private openBlockingDoor(doors: Map<string, Door>): void {
    const c = this.loco.blockedBy;
    if (!c || !(c.flags & CF.Door)) return;
    const door = c.ref as Door | null;
    if (!door || door.open) return;
    const canOpen = !door.locked || (door.def.lock === 'barred' && door.isInsideSide(this.x, this.z));
    if (canOpen && doors.has(door.id)) {
      door.locked = false;
      door.setOpen(true, this.x, this.z);
      this.bus.emit('door:changed', { id: door.id, open: true, byEnemy: false });
    }
  }

  syncTransform(): void {
    this.rig.root.position.set(this.x, 0, this.z);
    this.rig.root.rotation.y = this.yaw;
  }

  serialize(): NpcSaveState {
    return { state: this.state, x: this.x, z: this.z, relationship: this.relationship, health: this.health };
  }

  restore(s: NpcSaveState): void {
    this.x = s.x;
    this.z = s.z;
    this.relationship = s.relationship;
    this.health = s.health;
    this.treated = s.state === 'following' || s.state === 'waiting' || s.state === 'boarded' || this.treated;
    this.state = s.state as NpcState;
    this.rig.root.visible = this.state !== 'boarded';
    this.enabled = this.state !== 'boarded';
    this.loco.reset();
    this.syncTransform();
  }
}

export class NpcManager {
  readonly root = new THREE.Group();
  readonly npcs = new Map<string, Npc>();

  constructor(private readonly bus: EventBus<GameEvents>) {
    this.root.name = 'npcs';
  }

  add(def: NpcDef): Npc {
    const npc = new Npc(def, this.bus);
    this.npcs.set(def.id, npc);
    this.root.add(npc.rig.root);
    return npc;
  }

  get(id: string): Npc | undefined {
    return this.npcs.get(id);
  }

  state(id: string): string | null {
    return this.npcs.get(id)?.state ?? null;
  }

  update(dt: number, player: Player, host: LocomotionHost, doors: Map<string, Door>): void {
    for (const n of this.npcs.values()) n.update(dt, player, host, doors);
  }

  serialize(): Record<string, NpcSaveState> {
    return Object.fromEntries(Array.from(this.npcs, ([id, n]) => [id, n.serialize()]));
  }

  restore(data: Record<string, NpcSaveState>): void {
    for (const [id, s] of Object.entries(data)) this.npcs.get(id)?.restore(s);
  }
}
