import { Random } from '../core/Random';
import { clamp01 } from '../core/math';

export interface WeatherState {
  rain: number;
  fog: number;
}

/**
 * Deterministic weather from a seed: light ground fog, with rain showers that roll in and
 * out over the evening. Rain masks footsteps (good for stealth) but cuts visibility.
 */
export class Weather {
  rain = 0;
  fog: number;
  private target = 0;
  private timer: number;
  private readonly rng: Random;

  constructor(seed: number, initial: WeatherState = { rain: 0, fog: 0.15 }) {
    this.rng = new Random(seed);
    this.rain = initial.rain;
    this.target = initial.rain;
    this.fog = initial.fog;
    this.timer = this.rng.range(150, 260);
  }

  /** Multiplier applied to footstep noise radius. */
  get footstepMasking(): number {
    return 1 - 0.35 * this.rain;
  }

  update(dt: number, darkness: number): boolean {
    this.timer -= dt;
    let changed = false;
    if (this.timer <= 0) {
      this.timer = this.rng.range(120, 240);
      const next = this.target > 0.1 ? 0 : this.rng.range(0.45, 0.9);
      changed = next !== this.target;
      this.target = next;
    }
    this.rain += Math.sign(this.target - this.rain) * Math.min(Math.abs(this.target - this.rain), dt * 0.05);
    // Fog thickens a little at night and in rain.
    const fogTarget = clamp01(0.12 + darkness * 0.12 + this.rain * 0.2);
    this.fog += (fogTarget - this.fog) * Math.min(1, dt * 0.2);
    return changed;
  }

  serialize(): WeatherState {
    return { rain: this.rain, fog: this.fog };
  }
}
