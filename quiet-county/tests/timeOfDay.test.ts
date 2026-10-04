import { describe, expect, it } from 'vitest';
import { TimeOfDay, darknessForHour, lerpColor, phaseForHour, sampleSky } from '../src/systems/TimeOfDay';

describe('TimeOfDay', () => {
  it('maps hours to phases and darkness', () => {
    expect(phaseForHour(12)).toBe('day');
    expect(phaseForHour(18)).toBe('dusk');
    expect(phaseForHour(23)).toBe('night');
    expect(phaseForHour(6)).toBe('dawn');
    expect(darknessForHour(12)).toBe(0);
    expect(darknessForHour(23)).toBe(1);
    expect(darknessForHour(19.5)).toBeGreaterThan(0.3);
    expect(darknessForHour(19.5)).toBeLessThan(0.8);
  });

  it('advances the clock, wraps days and reports phase changes', () => {
    const phases: string[] = [];
    const t = new TimeOfDay(17, 10, (p) => phases.push(p));
    for (let i = 0; i < 100; i++) t.update(1); // 10 hours
    expect(t.hour).toBeCloseTo(3);
    expect(t.day).toBe(2);
    expect(phases).toEqual(['dusk', 'night']);
    expect(t.clock).toBe('03:00');
  });

  it('samples a continuous sky', () => {
    const a = sampleSky(18.99);
    const b = sampleSky(19.01);
    expect(Math.abs(a.sunIntensity - b.sunIntensity)).toBeLessThan(0.02);
    expect(sampleSky(13).sunElevation).toBeGreaterThan(0.5);
    expect(sampleSky(2).sunElevation).toBeLessThan(0);
    expect(lerpColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });
});
