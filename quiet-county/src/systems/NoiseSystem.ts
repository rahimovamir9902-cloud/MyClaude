import type { EventBus } from '../core/EventBus';
import type { GameEvents, NoiseEvent } from '../core/GameEvents';
import { clamp01 } from '../core/math';

export interface NoiseListener {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly hearingMultiplier: number;
  readonly canHear: boolean;
  onNoise(event: NoiseEvent, perceived: number): void;
}

/** Answers whether solid geometry lies between two points (walls muffle sound). */
export interface OcclusionTester {
  isOccluded(ax: number, az: number, bx: number, bz: number): boolean;
}

/**
 * Sound as a gameplay mechanic: every noise has a radius; infected inside it hear it,
 * with walls reducing the effective radius.
 */
export class NoiseSystem {
  private readonly listeners = new Set<NoiseListener>();
  private playerLevel = 0;

  constructor(
    private readonly bus: EventBus<GameEvents> | null,
    private readonly occlusion: OcclusionTester | null = null,
    private readonly occlusionFactor = 0.55,
    /** Global multiplier, e.g. rain masks sound. */
    public masking = 1,
  ) {}

  register(listener: NoiseListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  unregister(listener: NoiseListener): void {
    this.listeners.delete(listener);
  }

  /** Emits a noise and returns how many listeners heard it. */
  emit(event: NoiseEvent): number {
    const radius = event.radius * (event.kind === 'footstep' ? this.masking : 1);
    if (event.fromPlayer) {
      // HUD noise meter: 40m+ (a gunshot) maxes it out.
      this.playerLevel = Math.max(this.playerLevel, clamp01(radius / 40));
    }
    let heard = 0;
    for (const l of this.listeners) {
      if (!l.canHear) continue;
      const dx = l.x - event.x;
      const dz = l.z - event.z;
      const distSq = dx * dx + dz * dz;
      let effective = radius * l.hearingMultiplier;
      if (distSq > effective * effective) continue;
      if (this.occlusion && this.occlusion.isOccluded(event.x, event.z, l.x, l.z)) {
        effective *= this.occlusionFactor;
        if (distSq > effective * effective) continue;
      }
      const perceived = 1 - Math.sqrt(distSq) / effective;
      l.onNoise(event, perceived);
      heard++;
    }
    this.bus?.emit('noise', { ...event, radius });
    return heard;
  }

  /** 0..1 level of the most recent player-made noise, decaying over time (HUD meter). */
  get playerNoiseLevel(): number {
    return this.playerLevel;
  }

  update(dt: number): void {
    this.playerLevel = Math.max(0, this.playerLevel - dt * 0.6);
  }

  clear(): void {
    this.listeners.clear();
    this.playerLevel = 0;
  }
}

/** Base priorities so a gunshot overrides a footstep in AI decision making. */
export const NOISE_PRIORITY: Readonly<Record<NoiseEvent['kind'], number>> = {
  footstep: 1,
  interaction: 2,
  door: 3,
  throwable: 4,
  breakable: 4,
  melee: 4,
  impact: 3,
  voice: 5,
  environment: 5,
  alarm: 7,
  gunshot: 8,
};
