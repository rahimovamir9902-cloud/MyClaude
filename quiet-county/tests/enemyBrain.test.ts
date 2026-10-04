import { describe, expect, it } from 'vitest';
import { EnemyBrain, type EnemySenses } from '../src/systems/ai/EnemyBrain';
import { getArchetype } from '../src/config/enemies';
import { Random } from '../src/core/Random';
import type { NoiseEvent } from '../src/core/GameEvents';

function senses(over: Partial<EnemySenses> = {}): EnemySenses {
  return {
    selfX: 0, selfZ: 0, playerX: 20, playerZ: 0, playerYaw: 0, playerAlive: true,
    playerVisibility: 0, playerSensedClose: false, reachedTarget: false, pathFailed: false, isNight: false,
    ...over,
  };
}

function brain(dormant = false) {
  const transitions: string[] = [];
  const b = new EnemyBrain(getArchetype('common'), { x: 0, z: 0 }, new Random(1), { dormant }, (f, t) => transitions.push(`${f}>${t}`));
  return { b, transitions };
}

function run(b: EnemyBrain, s: EnemySenses, seconds: number, dt = 0.1) {
  for (let t = 0; t < seconds; t += dt) b.think(s, dt);
}

const gunshot: NoiseEvent = { kind: 'gunshot', x: 15, z: 5, radius: 40, fromPlayer: true, priority: 8 };

describe('EnemyBrain', () => {
  it('idles then wanders around home', () => {
    const { b } = brain();
    expect(b.state).toBe('idle');
    run(b, senses(), 7);
    expect(b.state).toBe('wander');
    expect(b.intent.move).toBe(true);
    expect(Math.hypot(b.intent.targetX, b.intent.targetZ)).toBeLessThanOrEqual(7.01);
  });

  it('investigates a heard noise and moves toward its source', () => {
    const { b } = brain();
    b.hearNoise(gunshot, 0.6);
    b.think(senses(), 0.1);
    expect(b.state).toBe('investigate');
    expect(b.intent.targetX).toBe(15);
    expect(b.intent.targetZ).toBe(5);
    expect(b.intent.speed).toBeGreaterThan(getArchetype('common').walkSpeed);
  });

  it('builds awareness from sight and starts a chase', () => {
    const { b, transitions } = brain();
    run(b, senses({ playerVisibility: 0.8 }), 1.5);
    expect(b.state === 'chase' || b.state === 'attack').toBe(true);
    expect(transitions).toContain('investigate>chase');
  });

  it('partial glimpses only make it suspicious', () => {
    const { b } = brain();
    run(b, senses({ playerVisibility: 0.15 }), 0.4);
    expect(b.awareness).toBeGreaterThan(0);
    expect(b.awareness).toBeLessThan(1);
    expect(b.state === 'idle' || b.state === 'investigate').toBe(true);
  });

  it('attacks in range, strikes once after the wind-up, then resumes the chase', () => {
    const { b } = brain();
    b.applyHit(5, 1, 0, 0);
    expect(b.state).toBe('chase');
    const close = senses({ playerX: 1, playerZ: 0, playerVisibility: 1 });
    b.think(close, 0.05);
    expect(b.state).toBe('attack');
    let strikes = 0;
    for (let i = 0; i < 30; i++) {
      b.think(close, 0.05);
      if (b.intent.strike) strikes++;
    }
    expect(strikes).toBe(1);
  });

  it('loses the target, searches, then returns to patrol', () => {
    const { b, transitions } = brain();
    b.applyHit(5, 10, 0, 0);
    run(b, senses({ playerX: 30, playerZ: 30 }), 4.5);
    expect(['loseTarget', 'search']).toContain(b.state);
    run(b, senses({ playerX: 30, playerZ: 30, reachedTarget: true }), 14);
    expect(transitions).toContain('search>returnToPatrol');
  });

  it('staggers on heavy hits and becomes hostile', () => {
    const { b } = brain();
    b.applyHit(45, 2, 0, 0.5);
    b.think(senses(), 0.05);
    expect(b.state).toBe('stagger');
    expect(b.isHostile).toBe(true);
    run(b, senses(), 1);
    expect(b.state).toBe('chase');
  });

  it('dormant infected wake on loud noises but sleep through faint ones', () => {
    const { b } = brain(true);
    expect(b.state).toBe('dormant');
    b.hearNoise({ kind: 'footstep', x: 3, z: 0, radius: 2, fromPlayer: true, priority: 1 }, 0.05);
    b.think(senses(), 0.1);
    expect(b.state).toBe('dormant');
    b.hearNoise(gunshot, 0.5);
    b.think(senses(), 0.1);
    expect(b.state).toBe('investigate');
  });

  it('group alerts pull others toward the player', () => {
    const { b } = brain();
    b.alertTo(8, 2);
    b.think(senses(), 0.1);
    expect(b.state).toBe('investigate');
    expect(b.intent.targetX).toBe(8);
  });

  it('only calm infected can be taken down and dead ones do nothing', () => {
    const { b } = brain();
    expect(b.canBeTakenDown).toBe(true);
    b.applyHit(5, 1, 0, 0);
    expect(b.canBeTakenDown).toBe(false);
    b.kill();
    expect(b.think(senses(), 0.1).anim).toBe('dead');
    expect(b.think(senses(), 0.1).move).toBe(false);
  });

  it('gives up the chase when the player dies', () => {
    const { b } = brain();
    b.applyHit(5, 3, 0, 0);
    b.think(senses({ playerAlive: false, selfX: 10 }), 0.1);
    expect(b.state).toBe('returnToPatrol');
    expect(b.intent.targetX).toBe(0);
  });
});

describe('EnemyBrain lunge', () => {
  it('speeds up when closing in on a visible player', () => {
    const b = new EnemyBrain(getArchetype('common'), { x: 0, z: 0 }, new Random(4));
    b.applyHit(1, 10, 0, 0);
    b.think(senses({ playerX: 10, playerZ: 0, playerVisibility: 1 }), 0.05);
    const far = b.intent.speed;
    b.think(senses({ playerX: 3, playerZ: 0, playerVisibility: 1 }), 0.05);
    expect(b.intent.speed).toBeGreaterThan(far * 1.2);
  });
});

describe('EnemyBrain stagger immunity', () => {
  it('cannot be stun-locked by repeated heavy hits', () => {
    const b = new EnemyBrain(getArchetype('common'), { x: 0, z: 0 }, new Random(5));
    b.applyHit(60, 1, 0, 0);
    b.think(senses({ playerX: 1, playerZ: 0, playerVisibility: 1 }), 0.05);
    expect(b.state).toBe('stagger');
    for (let i = 0; i < 20; i++) b.think(senses({ playerX: 1, playerZ: 0, playerVisibility: 1 }), 0.05);
    expect(b.state).not.toBe('stagger');
    b.applyHit(60, 1, 0, 0);
    b.think(senses({ playerX: 1, playerZ: 0, playerVisibility: 1 }), 0.05);
    expect(b.state).not.toBe('stagger');
  });

  it('ordinary crowbar hits do not stagger a common infected', () => {
    const b = new EnemyBrain(getArchetype('common'), { x: 0, z: 0 }, new Random(6));
    b.applyHit(34, 1, 0, 0.7);
    b.think(senses({ playerX: 1, playerZ: 0, playerVisibility: 1 }), 0.05);
    expect(b.state).not.toBe('stagger');
  });
});
