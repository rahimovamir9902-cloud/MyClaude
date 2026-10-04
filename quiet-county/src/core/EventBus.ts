import { createLogger } from './Logger';

const log = createLogger('EventBus');

export type Handler<T> = (payload: T) => void;

/**
 * Minimal typed publish/subscribe bus. Systems talk to each other through events
 * instead of holding direct references, which keeps them decoupled and testable.
 */
export class EventBus<E extends object> {
  private readonly handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(type, handler);
  }

  once<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends keyof E>(type: K, handler: Handler<E[K]>): void {
    this.handlers.get(type)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers.get(type);
    if (!set || set.size === 0) return;
    // Snapshot so handlers may unsubscribe (or subscribe) while we dispatch.
    for (const handler of Array.from(set)) {
      try {
        (handler as Handler<E[K]>)(payload);
      } catch (err) {
        log.error(`Handler for "${String(type)}" threw`, err);
      }
    }
  }

  listenerCount<K extends keyof E>(type: K): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  clear(): void {
    this.handlers.clear();
  }
}
