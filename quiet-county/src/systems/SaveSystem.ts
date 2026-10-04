import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { createLogger } from '../core/Logger';
import type { SerializedInventory } from './Inventory';
import type { MissionSaveState } from './MissionSystem';
import type { WorldSaveState } from './WorldState';

const log = createLogger('SaveSystem');

export const SAVE_VERSION = 1;
export type SaveSlot = 'auto' | 'manual';

export interface StorageBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class MemoryStorage implements StorageBackend {
  readonly data = new Map<string, string>();
  async getItem(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
  async removeItem(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export class LocalStorageBackend implements StorageBackend {
  async getItem(key: string): Promise<string | null> {
    try {
      return window.localStorage.getItem(key);
    } catch (err) {
      log.warn('localStorage read failed', err);
      return null;
    }
  }
  async setItem(key: string, value: string): Promise<void> {
    window.localStorage.setItem(key, value);
  }
  async removeItem(key: string): Promise<void> {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export interface PlayerSaveState {
  x: number;
  z: number;
  yaw: number;
  health: number;
  stamina: number;
  battery: number;
  flashlightOn: boolean;
  inventory: SerializedInventory;
  equippedSlot: number;
}

export interface NpcSaveState {
  state: string;
  x: number;
  z: number;
  relationship: number;
  health: number;
}

export interface ProfileState {
  completedMissions: string[];
  campResources: Record<string, number>;
  recruitedNpcs: string[];
  playTimeSeconds: number;
  /** Camp facility levels (Phase 3). */
  facilities?: Partial<Record<string, number>>;
}

export interface SaveData {
  levelId: string;
  profile: ProfileState;
  mission: MissionSaveState | null;
  player: PlayerSaveState;
  world: WorldSaveState;
  npcs: Record<string, NpcSaveState>;
  time: { hour: number; day: number };
  weather: { rain: number };
}

export interface SaveGame {
  version: number;
  savedAt: number;
  slot: SaveSlot;
  manual: boolean;
  label: string;
  data: SaveData;
}

export function emptyProfile(): ProfileState {
  return { completedMissions: [], campResources: {}, recruitedNpcs: [], playTimeSeconds: 0 };
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Upgrades older save formats step by step. Add an entry when SAVE_VERSION increases. */
const MIGRATIONS: Record<number, Migration> = {
  // 0 -> 1: pre-release saves had no weather block.
  0: (raw) => {
    const data = (raw.data ?? {}) as Record<string, unknown>;
    if (!data.weather) data.weather = { rain: 0 };
    return { ...raw, data, version: 1 };
  },
};

export class SaveValidationError extends Error {}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new SaveValidationError(message);
}

/** Structural validation so a corrupted save can never crash the game on load. */
export function validateSave(raw: unknown): SaveGame {
  assert(raw && typeof raw === 'object', 'save is not an object');
  const s = raw as SaveGame;
  assert(typeof s.version === 'number', 'missing version');
  assert(typeof s.savedAt === 'number', 'missing timestamp');
  assert(s.slot === 'auto' || s.slot === 'manual', 'bad slot');
  const d = s.data;
  assert(d && typeof d === 'object', 'missing data');
  assert(typeof d.levelId === 'string', 'missing levelId');
  assert(d.player && Number.isFinite(d.player.x) && Number.isFinite(d.player.z), 'bad player position');
  assert(Number.isFinite(d.player.health), 'bad player health');
  assert(d.player.inventory && Array.isArray(d.player.inventory.slots), 'bad inventory');
  assert(d.world && typeof d.world.flags === 'object', 'bad world state');
  assert(d.profile && Array.isArray(d.profile.completedMissions), 'bad profile');
  assert(d.time && Number.isFinite(d.time.hour), 'bad time');
  assert(d.mission === null || (typeof d.mission === 'object' && typeof d.mission.missionId === 'string'), 'bad mission');
  return s;
}

export function migrateSave(raw: Record<string, unknown>): Record<string, unknown> {
  let current = raw;
  let version = typeof current.version === 'number' ? current.version : 0;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new SaveValidationError(`No migration from save version ${version}`);
    current = step(current);
    version = current.version as number;
  }
  if (version > SAVE_VERSION) throw new SaveValidationError(`Save version ${version} is newer than this build`);
  return current;
}

const KEY_PREFIX = 'qc.save.';
const PROFILE_KEY = 'qc.profile';

/**
 * Versioned save slots with a backup copy per slot. Automatic saves happen at mission start
 * and checkpoints; manual saves only at safe locations (enforced by the game layer).
 */
export class SaveSystem {
  constructor(
    private readonly storage: StorageBackend,
    private readonly bus: EventBus<GameEvents> | null = null,
  ) {}

  async save(slot: SaveSlot, data: SaveData, label: string, manual = slot === 'manual'): Promise<boolean> {
    const game: SaveGame = { version: SAVE_VERSION, savedAt: Date.now(), slot, manual, label, data };
    const key = KEY_PREFIX + slot;
    try {
      const json = JSON.stringify(game);
      const previous = await this.storage.getItem(key);
      if (previous) await this.storage.setItem(key + '.bak', previous);
      await this.storage.setItem(key, json);
      log.info(`Saved slot "${slot}" (${json.length} bytes) - ${label}`);
      this.bus?.emit('save:completed', { slot, manual });
      return true;
    } catch (err) {
      log.error(`Save to "${slot}" failed`, err);
      this.bus?.emit('save:failed', { slot, error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  async load(slot: SaveSlot): Promise<SaveGame | null> {
    const key = KEY_PREFIX + slot;
    const primary = await this.tryParse(await this.storage.getItem(key), slot);
    if (primary) return primary;
    const backup = await this.tryParse(await this.storage.getItem(key + '.bak'), `${slot} backup`);
    if (backup) log.warn(`Recovered slot "${slot}" from backup`);
    return backup;
  }

  /** Most recent valid save across slots. */
  async latest(): Promise<SaveGame | null> {
    const saves = (await Promise.all([this.load('auto'), this.load('manual')])).filter(
      (s): s is SaveGame => s !== null,
    );
    saves.sort((a, b) => b.savedAt - a.savedAt);
    return saves[0] ?? null;
  }

  async delete(slot: SaveSlot): Promise<void> {
    await this.storage.removeItem(KEY_PREFIX + slot);
    await this.storage.removeItem(KEY_PREFIX + slot + '.bak');
  }

  async deleteAll(): Promise<void> {
    await this.delete('auto');
    await this.delete('manual');
  }

  async saveProfile(profile: ProfileState): Promise<void> {
    try {
      await this.storage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (err) {
      log.error('Profile save failed', err);
    }
  }

  async loadProfile(): Promise<ProfileState> {
    try {
      const raw = await this.storage.getItem(PROFILE_KEY);
      if (!raw) return emptyProfile();
      const p = JSON.parse(raw) as ProfileState;
      return { ...emptyProfile(), ...p };
    } catch (err) {
      log.warn('Profile unreadable, starting fresh', err);
      return emptyProfile();
    }
  }

  private async tryParse(json: string | null, label: string): Promise<SaveGame | null> {
    if (!json) return null;
    try {
      const raw = JSON.parse(json) as Record<string, unknown>;
      return validateSave(migrateSave(raw));
    } catch (err) {
      log.warn(`Ignoring unreadable save (${label})`, err);
      return null;
    }
  }
}
