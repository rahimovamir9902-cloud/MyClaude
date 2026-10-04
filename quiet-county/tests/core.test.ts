import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { Random, hashString } from '../src/core/Random';
import { ObjectPool } from '../src/core/ObjectPool';
import { StateMachine } from '../src/core/StateMachine';
import { angleTo, clamp, dampAngle, wrapAngle, yawFromDir, dirFromYaw } from '../src/core/math';

interface TestEvents {
  ping: { n: number };
  other: string;
}

describe('EventBus', () => {
  it('delivers payloads and supports unsubscribe', () => {
    const bus = new EventBus<TestEvents>();
    const seen: number[] = [];
    const off = bus.on('ping', (p) => seen.push(p.n));
    bus.emit('ping', { n: 1 });
    off();
    bus.emit('ping', { n: 2 });
    expect(seen).toEqual([1]);
  });

  it('once fires a single time', () => {
    const bus = new EventBus<TestEvents>();
    const fn = vi.fn();
    bus.once('other', fn);
    bus.emit('other', 'a');
    bus.emit('other', 'b');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('isolates handler errors and allows unsubscribing during dispatch', () => {
    const bus = new EventBus<TestEvents>();
    const after = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let off: () => void = () => {};
    off = bus.on('ping', () => {
      off();
      throw new Error('boom');
    });
    bus.on('ping', after);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(after).toHaveBeenCalledTimes(2);
    expect(bus.listenerCount('ping')).toBe(1);
    spy.mockRestore();
  });
});

describe('Random', () => {
  it('is deterministic per seed', () => {
    const a = new Random(42);
    const b = new Random(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
    seqA.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    seqA.forEach((v) => expect(v).toBeLessThan(1));
  });

  it('int is inclusive and weighted respects weights', () => {
    const r = new Random(7);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) {
      const v = r.int(1, 3);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
      const w = r.weighted([{ id: 'a', weight: 9 }, { id: 'b', weight: 1 }]);
      counts[w.id as 'a' | 'b']++;
    }
    expect(counts.a).toBeGreaterThan(counts.b * 5);
  });

  it('fork produces independent but reproducible streams', () => {
    const f1 = new Random(1).fork('crate_a').next();
    const f2 = new Random(1).fork('crate_a').next();
    const f3 = new Random(1).fork('crate_b').next();
    expect(f1).toBe(f2);
    expect(f1).not.toBe(f3);
    expect(hashString('abc')).toBe(hashString('abc'));
  });
});

describe('ObjectPool', () => {
  it('reuses released objects and honours max size', () => {
    let created = 0;
    const pool = new ObjectPool(() => ({ id: ++created }), undefined, undefined, 2);
    const a = pool.acquire()!;
    const b = pool.acquire()!;
    expect(pool.acquire()).toBeNull();
    pool.release(a);
    const c = pool.acquire();
    expect(c).toBe(a);
    expect(created).toBe(2);
    expect(pool.activeCount).toBe(2);
    pool.releaseAll();
    expect(pool.activeCount).toBe(0);
    void b;
  });
});

describe('StateMachine', () => {
  it('transitions via update return values and tracks time in state', () => {
    const log: string[] = [];
    const ctx = { go: false };
    const fsm = new StateMachine(ctx, [
      { id: 'a', enter: () => log.push('enter a'), exit: () => log.push('exit a'), update: (c) => (c.go ? 'b' : undefined) },
      { id: 'b', enter: (_c, prev) => log.push(`enter b from ${prev}`) },
    ], 'a');
    fsm.update(0.5);
    expect(fsm.current).toBe('a');
    expect(fsm.timeInState).toBeCloseTo(0.5);
    ctx.go = true;
    fsm.update(0.1);
    expect(fsm.current).toBe('b');
    expect(fsm.timeInState).toBe(0);
    expect(log).toEqual(['enter a', 'exit a', 'enter b from a']);
  });
});

describe('math helpers', () => {
  it('wraps and damps angles along the short way', () => {
    expect(Math.abs(wrapAngle(Math.PI * 3))).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
    const v = dampAngle(Math.PI - 0.1, -Math.PI + 0.1, 100, 1);
    expect(Math.abs(wrapAngle(v - (-Math.PI + 0.1)))).toBeLessThan(1e-3);
  });

  it('yaw 0 faces -Z and round-trips through direction', () => {
    expect(yawFromDir(0, -1)).toBeCloseTo(0);
    const d = dirFromYaw(Math.PI / 2);
    expect(d.x).toBeCloseTo(-1);
    expect(d.z).toBeCloseTo(0);
    expect(yawFromDir(d.x, d.z)).toBeCloseTo(Math.PI / 2);
    expect(angleTo(0, 0, 0, 0, -5)).toBeCloseTo(0);
    expect(angleTo(0, 0, 0, 0, 5)).toBeCloseTo(Math.PI);
    expect(clamp(5, 0, 2)).toBe(2);
  });
});

describe('InputState', () => {
  it('consumeEdges keeps held buttons but drops one-shot presses (no double taps across substeps)', async () => {
    const { InputState } = await import('../src/input/InputState');
    const input = new InputState();
    input.press('crouch', 'touch');
    expect(input.wasPressed('crouch')).toBe(true);
    input.consumeEdges();
    expect(input.wasPressed('crouch')).toBe(false);
    expect(input.isHeld('crouch')).toBe(true);
    input.press('crouch', 'touch');
    expect(input.wasPressed('crouch')).toBe(false);
    input.release('crouch');
    expect(input.wasReleased('crouch')).toBe(true);
  });

  it('combines and clamps movement from several devices', async () => {
    const { InputState } = await import('../src/input/InputState');
    const input = new InputState();
    input.setMove('touch', 1, 0);
    input.setMove('keyboard', 0, 1);
    expect(input.moveMagnitude).toBeCloseTo(1);
    input.setMove('touch', 0, 0);
    expect(input.moveX).toBe(0);
    expect(input.moveY).toBe(1);
  });
});
