import { FACILITIES, type FacilityDef, type FacilityId } from '../config/camp';
import type { CampResource } from '../config/items';
import type { MissionSummary } from '../core/GameEvents';
import type { ProfileState } from './SaveSystem';

/**
 * Harrow Mill camp state: resources brought home, facility levels and the bonuses they
 * grant. Pure logic over the persistent profile (camp UI arrives in Phase 3).
 */
export class Camp {
  constructor(
    private readonly profile: ProfileState & { facilities?: Partial<Record<FacilityId, number>> },
    private readonly facilities: readonly FacilityDef[] = FACILITIES,
  ) {
    this.profile.facilities ??= {};
  }

  resource(r: CampResource): number {
    return this.profile.campResources[r] ?? 0;
  }

  level(id: FacilityId): number {
    return this.profile.facilities?.[id] ?? 0;
  }

  nextLevel(id: FacilityId) {
    const def = this.facilities.find((f) => f.id === id);
    return def?.levels[this.level(id)] ?? null;
  }

  canUpgrade(id: FacilityId): boolean {
    const next = this.nextLevel(id);
    if (!next) return false;
    return Object.entries(next.cost).every(([r, n]) => this.resource(r as CampResource) >= (n ?? 0));
  }

  upgrade(id: FacilityId): boolean {
    if (!this.canUpgrade(id)) return false;
    const next = this.nextLevel(id)!;
    for (const [r, n] of Object.entries(next.cost)) this.profile.campResources[r] = this.resource(r as CampResource) - (n ?? 0);
    this.profile.facilities![id] = this.level(id) + 1;
    return true;
  }

  /** Adds a completed mission's rewards to the camp stockpile. */
  applyRewards(summary: MissionSummary): void {
    for (const r of summary.rewards) {
      if (r.id === 'xp') continue;
      this.profile.campResources[r.id] = (this.profile.campResources[r.id] ?? 0) + r.amount;
    }
  }

  /** Items every mission starts with thanks to built facilities. */
  startingItems(): { itemId: string; quantity: number }[] {
    const out: { itemId: string; quantity: number }[] = [];
    for (const f of this.facilities) {
      const lvl = this.level(f.id);
      if (lvl > 0) out.push(...(f.levels[lvl - 1].startingItems ?? []));
    }
    return out;
  }

  stashSlots(): number {
    const lvl = this.level('storage');
    return 12 + (lvl > 0 ? (this.facilities.find((f) => f.id === 'storage')!.levels[lvl - 1].stash ?? 0) : 0);
  }
}
