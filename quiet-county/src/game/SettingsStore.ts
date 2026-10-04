import { detectQuality } from '../config/quality';
import { DEFAULT_SETTINGS, type GameSettings } from '../config/settings';
import { createLogger } from '../core/Logger';
import { isTouchDevice } from '../platform/Platform';

const log = createLogger('Settings');
const KEY = 'qc.settings';

/** Player preferences, persisted locally and merged over defaults (forward compatible). */
export class SettingsStore {
  private value: GameSettings;

  constructor() {
    this.value = this.load();
  }

  get(): GameSettings {
    return this.value;
  }

  set(next: GameSettings): void {
    this.value = { ...next };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.value));
    } catch (err) {
      log.warn('Could not persist settings', err);
    }
  }

  reset(): GameSettings {
    const fresh = this.defaults();
    this.set(fresh);
    return fresh;
  }

  private defaults(): GameSettings {
    const nav = navigator as Navigator & { deviceMemory?: number };
    return {
      ...DEFAULT_SETTINGS,
      quality: detectQuality({
        isTouch: isTouchDevice,
        cores: navigator.hardwareConcurrency || 4,
        memoryGb: nav.deviceMemory,
        screenPixels: window.screen.width * window.screen.height,
      }),
    };
  }

  private load(): GameSettings {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return { ...this.defaults(), ...(JSON.parse(raw) as Partial<GameSettings>) };
    } catch (err) {
      log.warn('Settings unreadable, using defaults', err);
    }
    return this.defaults();
  }
}
