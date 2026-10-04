/** Deterministic, seedable PRNG (mulberry32). Used for loot, AI variation and events. */
export class Random {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0;
  }

  static fromString(text: string): Random {
    return new Random(hashString(text));
  }

  /** Float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Random.pick on empty array');
    return items[Math.floor(this.next() * items.length)];
  }

  weighted<T extends { weight: number }>(items: readonly T[]): T {
    const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
    if (total <= 0) throw new Error('Random.weighted requires positive total weight');
    let roll = this.next() * total;
    for (const item of items) {
      roll -= Math.max(0, item.weight);
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  }

  /** Derive an independent stream, e.g. one per container, from this generator's seed. */
  fork(salt: string | number): Random {
    const s = typeof salt === 'number' ? salt : hashString(salt);
    return new Random((this.state ^ Math.imul(s, 0x9e3779b1)) >>> 0);
  }

  getState(): number {
    return this.state;
  }
}

/** FNV-1a 32-bit hash. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
