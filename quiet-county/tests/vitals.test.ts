import { describe, expect, it } from 'vitest';
import { HealingQueue, Health, Stamina } from '../src/systems/Vitals';

describe('Health', () => {
  it('clamps damage and healing and detects death', () => {
    const h = new Health(100);
    expect(h.damage(30)).toBe(30);
    expect(h.heal(50)).toBe(30);
    expect(h.damage(250)).toBe(100);
    expect(h.dead).toBe(true);
    expect(h.heal(10)).toBe(0);
  });

  it('ignores damage while invulnerable', () => {
    const h = new Health(100);
    h.setInvulnerable(0.3);
    expect(h.damage(10)).toBe(0);
    h.update(0.31);
    expect(h.damage(10)).toBe(10);
  });
});

describe('Stamina', () => {
  it('drains, waits out the regen delay, then regenerates', () => {
    const s = new Stamina(100, 20, 1, 30);
    s.drain(50);
    s.update(0.5);
    expect(s.current).toBe(50);
    s.update(0.5); // delay over
    s.update(1);
    expect(s.current).toBeCloseTo(70);
  });

  it('exhausts at zero and only allows sprint after recovering past threshold', () => {
    const s = new Stamina(100, 20, 0, 30);
    s.drain(100);
    expect(s.exhausted).toBe(true);
    expect(s.canSprint()).toBe(false);
    s.update(1); // +20
    expect(s.canSprint()).toBe(false);
    s.update(0.6); // 32
    expect(s.canSprint()).toBe(true);
  });

  it('spend returns the fraction paid so tired swings are weaker', () => {
    const s = new Stamina(100, 20, 1, 30);
    s.drain(90);
    expect(s.spend(20)).toBeCloseTo(0.5);
    expect(s.current).toBe(0);
  });
});

describe('HealingQueue', () => {
  it('distributes healing over time', () => {
    const q = new HealingQueue();
    q.add(30, 3);
    let total = 0;
    for (let i = 0; i < 40; i++) total += q.update(0.1);
    expect(total).toBeCloseTo(30);
    expect(q.active).toBe(false);
  });
});
