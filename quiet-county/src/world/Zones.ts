import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import type { Rect, ZoneDef } from './LevelTypes';

export function inRect(r: Rect, x: number, z: number): boolean {
  return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
}

/** Tracks which trigger zones contain the player and emits enter/exit events. */
export class ZoneManager {
  private readonly zones: ZoneDef[] = [];
  private readonly inside = new Set<string>();

  constructor(private readonly bus: EventBus<GameEvents> | null) {}

  add(zone: ZoneDef): void {
    this.zones.push(zone);
  }

  all(): readonly ZoneDef[] {
    return this.zones;
  }

  get(id: string): ZoneDef | undefined {
    return this.zones.find((z) => z.id === id);
  }

  isInside(id: string): boolean {
    return this.inside.has(id);
  }

  /** Zones of a kind containing the point (no events). */
  zonesAt(x: number, z: number, kind?: ZoneDef['kind']): ZoneDef[] {
    return this.zones.filter((zn) => (!kind || zn.kind === kind) && inRect(zn.rect, x, z));
  }

  anyAt(x: number, z: number, kind: ZoneDef['kind']): boolean {
    for (const zn of this.zones) if (zn.kind === kind && inRect(zn.rect, x, z)) return true;
    return false;
  }

  update(x: number, z: number): void {
    for (const zn of this.zones) {
      const now = inRect(zn.rect, x, z);
      const was = this.inside.has(zn.id);
      if (now && !was) {
        this.inside.add(zn.id);
        this.bus?.emit('zone:entered', { zoneId: zn.id });
      } else if (!now && was) {
        this.inside.delete(zn.id);
        this.bus?.emit('zone:exited', { zoneId: zn.id });
      }
    }
  }

  reset(): void {
    this.inside.clear();
  }
}
