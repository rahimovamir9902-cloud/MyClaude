import { Capacitor } from '@capacitor/core';
import { createLogger } from '../core/Logger';
import { LocalStorageBackend, type StorageBackend } from '../systems/SaveSystem';

const log = createLogger('Platform');

export const isNative = Capacitor.isNativePlatform();
export const platformName = Capacitor.getPlatform();

export const isTouchDevice =
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0);

/** Native builds persist saves with Capacitor Preferences (survives WebView cache clears). */
class PreferencesBackend implements StorageBackend {
  private mod: typeof import('@capacitor/preferences') | null = null;
  private async prefs() {
    if (!this.mod) this.mod = await import('@capacitor/preferences');
    return this.mod.Preferences;
  }
  async getItem(key: string): Promise<string | null> {
    return (await (await this.prefs()).get({ key })).value;
  }
  async setItem(key: string, value: string): Promise<void> {
    await (await this.prefs()).set({ key, value });
  }
  async removeItem(key: string): Promise<void> {
    await (await this.prefs()).remove({ key });
  }
}

export function createStorage(): StorageBackend {
  return isNative ? new PreferencesBackend() : new LocalStorageBackend();
}

export async function haptic(strength: 'light' | 'medium' | 'heavy'): Promise<void> {
  try {
    if (isNative) {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: strength === 'heavy' ? ImpactStyle.Heavy : strength === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
    } else if (isTouchDevice && 'vibrate' in navigator) {
      navigator.vibrate(strength === 'heavy' ? 45 : strength === 'medium' ? 22 : 10);
    }
  } catch {
    /* haptics are best effort */
  }
}

/** Landscape lock + fullscreen on mobile (best effort, never blocks the game). */
export async function enterGameDisplayMode(): Promise<void> {
  try {
    if (isNative) {
      const { ScreenOrientation } = await import('@capacitor/screen-orientation');
      await ScreenOrientation.lock({ orientation: 'landscape' });
      return;
    }
    if (!isTouchDevice) return;
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.('landscape');
  } catch (err) {
    log.debug('Display mode not available', err);
  }
}
