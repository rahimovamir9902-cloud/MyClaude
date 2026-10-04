export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  id: QualityLevel;
  label: string;
  maxPixelRatio: number;
  minPixelRatio: number;
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  /** Procedural texture resolution. */
  textureSize: number;
  anisotropy: number;
  grassDensity: number;
  /** Trees beyond this distance swap to their low-detail variant. */
  treeLodDistance: number;
  /** Camera far plane / fog end. */
  viewDistance: number;
  rainParticles: number;
  /** Infected beyond this run their AI at a reduced rate. */
  aiNearDistance: number;
  aiFarDistance: number;
}

export const QUALITY_PRESETS: Readonly<Record<QualityLevel, QualityPreset>> = Object.freeze({
  low: {
    id: 'low', label: 'Low (battery saver)', maxPixelRatio: 1.0, minPixelRatio: 0.5, antialias: false,
    shadows: false, shadowMapSize: 512, textureSize: 128, anisotropy: 1, grassDensity: 0.4,
    treeLodDistance: 28, viewDistance: 75, rainParticles: 500, aiNearDistance: 18, aiFarDistance: 40,
  },
  medium: {
    id: 'medium', label: 'Medium', maxPixelRatio: 1.5, minPixelRatio: 0.6, antialias: false,
    shadows: false, shadowMapSize: 1024, textureSize: 256, anisotropy: 2, grassDensity: 0.7,
    treeLodDistance: 40, viewDistance: 95, rainParticles: 900, aiNearDistance: 22, aiFarDistance: 48,
  },
  high: {
    id: 'high', label: 'High', maxPixelRatio: 2.0, minPixelRatio: 0.75, antialias: true,
    shadows: true, shadowMapSize: 1024, textureSize: 512, anisotropy: 4, grassDensity: 1.0,
    treeLodDistance: 55, viewDistance: 120, rainParticles: 1500, aiNearDistance: 26, aiFarDistance: 60,
  },
});

/** Pick a sensible default from coarse device signals. */
export function detectQuality(env: { isTouch: boolean; cores: number; memoryGb?: number; screenPixels: number }): QualityLevel {
  if (!env.isTouch) return env.cores >= 8 ? 'high' : 'medium';
  if ((env.memoryGb ?? 4) <= 3 || env.cores <= 4) return 'low';
  if ((env.memoryGb ?? 4) >= 8 && env.cores >= 8) return 'high';
  return 'medium';
}
