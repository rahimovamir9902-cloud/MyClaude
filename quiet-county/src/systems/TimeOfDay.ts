import type { TimePhase } from '../core/GameEvents';
import { clamp01, lerp, smoothstep } from '../core/math';

export interface SkySample {
  skyTop: number;
  horizon: number;
  fog: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  /** 0 = full daylight, 1 = deep night. */
  darkness: number;
  /** Radians above the horizon (negative = below). */
  sunElevation: number;
}

interface Key {
  hour: number;
  skyTop: number;
  horizon: number;
  fog: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
}

// Muted, desaturated palette: overcast days, amber dusk, blue-grey moonlit nights.
const KEYS: Key[] = [
  { hour: 0, skyTop: 0x05070c, horizon: 0x141c28, fog: 0x101620, sunColor: 0x8fa2c8, sunIntensity: 0.5, hemiSky: 0x3a4a6c, hemiGround: 0x101216, hemiIntensity: 0.7 },
  { hour: 5, skyTop: 0x0a0e18, horizon: 0x1c2330, fog: 0x161c25, sunColor: 0x8fa2c8, sunIntensity: 0.5, hemiSky: 0x3a4a6c, hemiGround: 0x101216, hemiIntensity: 0.7 },
  { hour: 6.5, skyTop: 0x3c4a63, horizon: 0xc58d6a, fog: 0x7a7470, sunColor: 0xffb27a, sunIntensity: 0.9, hemiSky: 0x8a8fa0, hemiGround: 0x3a3228, hemiIntensity: 0.7 },
  { hour: 9, skyTop: 0x6d8399, horizon: 0xb7bcbc, fog: 0x9da3a3, sunColor: 0xfff1dc, sunIntensity: 1.5, hemiSky: 0xb6c2cc, hemiGround: 0x4a4436, hemiIntensity: 0.85 },
  { hour: 15, skyTop: 0x687d93, horizon: 0xb4b6b2, fog: 0x9a9e9c, sunColor: 0xffeccf, sunIntensity: 1.45, hemiSky: 0xb2bcc4, hemiGround: 0x4a4436, hemiIntensity: 0.85 },
  { hour: 18, skyTop: 0x4a5266, horizon: 0xd49660, fog: 0x8c7a68, sunColor: 0xffa860, sunIntensity: 1.1, hemiSky: 0x8c8790, hemiGround: 0x3c3026, hemiIntensity: 0.75 },
  { hour: 19.5, skyTop: 0x232a3b, horizon: 0x7a4e3a, fog: 0x3e3836, sunColor: 0xd9784a, sunIntensity: 0.55, hemiSky: 0x4c5068, hemiGround: 0x1c1814, hemiIntensity: 0.6 },
  { hour: 21, skyTop: 0x080b12, horizon: 0x18202c, fog: 0x131a24, sunColor: 0x8fa2c8, sunIntensity: 0.5, hemiSky: 0x3a4a6c, hemiGround: 0x101216, hemiIntensity: 0.7 },
  { hour: 24, skyTop: 0x05070c, horizon: 0x141c28, fog: 0x101620, sunColor: 0x8fa2c8, sunIntensity: 0.5, hemiSky: 0x3a4a6c, hemiGround: 0x101216, hemiIntensity: 0.7 },
];

export function lerpColor(a: number, b: number, t: number): number {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}

export function phaseForHour(hour: number): TimePhase {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17.5) return 'day';
  if (h >= 17.5 && h < 20.25) return 'dusk';
  return 'night';
}

/** Darkness curve: 0 in daylight, 1 at night, smooth through dusk and dawn. */
export function darknessForHour(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h < 12) return 1 - smoothstep(5, 7.5, h);
  return smoothstep(18.25, 20.75, h);
}

export function sampleSky(hour: number): SkySample {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].hour <= h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = clamp01((h - a.hour) / (b.hour - a.hour));
  // Sun: rises ~6:00, sets ~19:45.
  const dayT = (h - 6) / (19.75 - 6);
  const sunElevation = Math.sin(clamp01(dayT) * Math.PI) * 1.1 - (dayT < 0 || dayT > 1 ? 0.3 : 0);
  return {
    skyTop: lerpColor(a.skyTop, b.skyTop, t),
    horizon: lerpColor(a.horizon, b.horizon, t),
    fog: lerpColor(a.fog, b.fog, t),
    sunColor: lerpColor(a.sunColor, b.sunColor, t),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    hemiSky: lerpColor(a.hemiSky, b.hemiSky, t),
    hemiGround: lerpColor(a.hemiGround, b.hemiGround, t),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, t),
    darkness: darknessForHour(h),
    sunElevation,
  };
}

/** Game clock. One in-game hour lasts `secondsPerHour` real seconds. */
export class TimeOfDay {
  private hourValue: number;
  private dayValue: number;
  private phaseValue: TimePhase;

  constructor(
    startHour: number,
    public secondsPerHour = 150,
    private readonly onPhase?: (phase: TimePhase, hour: number) => void,
    startDay = 1,
  ) {
    this.hourValue = ((startHour % 24) + 24) % 24;
    this.dayValue = startDay;
    this.phaseValue = phaseForHour(this.hourValue);
  }

  get hour(): number {
    return this.hourValue;
  }

  get day(): number {
    return this.dayValue;
  }

  get phase(): TimePhase {
    return this.phaseValue;
  }

  get darkness(): number {
    return darknessForHour(this.hourValue);
  }

  get isNight(): boolean {
    return this.phaseValue === 'night';
  }

  /** "19:45" style clock string. */
  get clock(): string {
    const h = Math.floor(this.hourValue);
    const m = Math.floor((this.hourValue - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  set(hour: number, day = this.dayValue): void {
    this.hourValue = ((hour % 24) + 24) % 24;
    this.dayValue = day;
    this.phaseValue = phaseForHour(this.hourValue);
  }

  update(dt: number): void {
    if (this.secondsPerHour <= 0) return;
    this.hourValue += dt / this.secondsPerHour;
    if (this.hourValue >= 24) {
      this.hourValue -= 24;
      this.dayValue++;
    }
    const p = phaseForHour(this.hourValue);
    if (p !== this.phaseValue) {
      this.phaseValue = p;
      this.onPhase?.(p, this.hourValue);
    }
  }
}
