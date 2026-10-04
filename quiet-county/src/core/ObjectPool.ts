/**
 * Generic object pool. Avoids per-frame allocations (and GC hitches on mobile) for
 * frequently spawned objects such as tracers, impact effects and enemies.
 */
export class ObjectPool<T> {
  private readonly free: T[] = [];
  private readonly active = new Set<T>();

  constructor(
    private readonly factory: () => T,
    private readonly onAcquire: (item: T) => void = () => {},
    private readonly onRelease: (item: T) => void = () => {},
    private readonly maxSize = Infinity,
  ) {}

  prewarm(count: number): void {
    for (let i = 0; i < count; i++) this.free.push(this.factory());
  }

  /** Returns a pooled item, or null when the pool is capped and exhausted. */
  acquire(): T | null {
    let item = this.free.pop();
    if (item === undefined) {
      if (this.active.size >= this.maxSize) return null;
      item = this.factory();
    }
    this.active.add(item);
    this.onAcquire(item);
    return item;
  }

  release(item: T): void {
    if (!this.active.delete(item)) return;
    this.onRelease(item);
    this.free.push(item);
  }

  releaseAll(): void {
    for (const item of Array.from(this.active)) this.release(item);
  }

  forEachActive(fn: (item: T) => void): void {
    for (const item of this.active) fn(item);
  }

  get activeCount(): number {
    return this.active.size;
  }

  get freeCount(): number {
    return this.free.length;
  }
}
