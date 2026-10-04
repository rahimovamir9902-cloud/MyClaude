import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import type { ItemStack } from './Inventory';

export interface ContainerState {
  searched: boolean;
  contents: ItemStack[];
}

export interface DoorState {
  open: boolean;
  locked: boolean;
}

export interface WorldSaveState {
  flags: Record<string, number>;
  containers: Record<string, ContainerState>;
  doors: Record<string, DoorState>;
  collected: string[];
  deadEnemies: string[];
  readNotes: string[];
}

/** Persistent world facts: flags, looted containers, door states, collected pickups, kills. */
export class WorldState {
  private readonly flags = new Map<string, number>();
  readonly containers = new Map<string, ContainerState>();
  readonly doors = new Map<string, DoorState>();
  readonly collected = new Set<string>();
  readonly deadEnemies = new Set<string>();
  readonly readNotes = new Set<string>();

  constructor(private readonly bus: EventBus<GameEvents> | null = null) {}

  getFlag(flag: string): number {
    return this.flags.get(flag) ?? 0;
  }

  setFlag(flag: string, value = 1): void {
    if (this.flags.get(flag) === value) return;
    this.flags.set(flag, value);
    this.bus?.emit('flag:changed', { flag, value });
  }

  incrementFlag(flag: string, by = 1): number {
    const v = this.getFlag(flag) + by;
    this.setFlag(flag, v);
    return v;
  }

  serialize(): WorldSaveState {
    return {
      flags: Object.fromEntries(this.flags),
      containers: Object.fromEntries(
        Array.from(this.containers, ([k, v]) => [k, { searched: v.searched, contents: v.contents.map((s) => ({ ...s })) }]),
      ),
      doors: Object.fromEntries(Array.from(this.doors, ([k, v]) => [k, { ...v }])),
      collected: Array.from(this.collected),
      deadEnemies: Array.from(this.deadEnemies),
      readNotes: Array.from(this.readNotes),
    };
  }

  load(data: WorldSaveState): void {
    this.reset();
    for (const [k, v] of Object.entries(data.flags ?? {})) this.flags.set(k, Number(v) || 0);
    for (const [k, v] of Object.entries(data.containers ?? {})) {
      this.containers.set(k, { searched: !!v.searched, contents: (v.contents ?? []).map((s) => ({ ...s })) });
    }
    for (const [k, v] of Object.entries(data.doors ?? {})) this.doors.set(k, { open: !!v.open, locked: !!v.locked });
    (data.collected ?? []).forEach((id) => this.collected.add(id));
    (data.deadEnemies ?? []).forEach((id) => this.deadEnemies.add(id));
    (data.readNotes ?? []).forEach((id) => this.readNotes.add(id));
  }

  reset(): void {
    this.flags.clear();
    this.containers.clear();
    this.doors.clear();
    this.collected.clear();
    this.deadEnemies.clear();
    this.readNotes.clear();
  }
}
