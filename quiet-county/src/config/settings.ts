import type { QualityLevel } from './quality';
import type { TouchButtonLayout } from './controls';

export interface GameSettings {
  quality: QualityLevel;
  targetFps: 30 | 60;
  dynamicResolution: boolean;
  showFps: boolean;
  lookSensitivityX: number;
  lookSensitivityY: number;
  invertY: boolean;
  aimAssist: boolean;
  aimMode: 'hold' | 'toggle';
  sprintMode: 'hold' | 'toggle';
  buttonScale: number;
  buttonOpacity: number;
  leftHanded: boolean;
  haptics: boolean;
  masterVolume: number;
  sfxVolume: number;
  ambienceVolume: number;
  subtitles: boolean;
  touchLayout: TouchButtonLayout[] | null;
}

export const DEFAULT_SETTINGS: Readonly<GameSettings> = Object.freeze({
  quality: 'medium',
  targetFps: 60,
  dynamicResolution: true,
  showFps: false,
  lookSensitivityX: 1,
  lookSensitivityY: 1,
  invertY: false,
  aimAssist: true,
  aimMode: 'hold',
  sprintMode: 'toggle',
  buttonScale: 1,
  buttonOpacity: 0.85,
  leftHanded: false,
  haptics: true,
  masterVolume: 0.9,
  sfxVolume: 1,
  ambienceVolume: 0.8,
  subtitles: true,
  touchLayout: null,
});
