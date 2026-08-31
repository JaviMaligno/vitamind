import type { PropValue } from "./analytics-ingest";

/**
 * In-memory event buffer.
 *
 * Events are batched rather than sent one by one: on Vercel every request is a
 * function invocation, and a visit that fires eight events would otherwise cost
 * eight of them. Batching turns a session into one or two.
 *
 * Pure and injectable — `send` and `now` are parameters — so the batching rules
 * are testable without a DOM, a network or a clock.
 */

export interface QueuedEvent {
  name: string;
  props?: Record<string, PropValue>;
  /** When it happened in the browser, not when the batch left. */
  ts: number;
  /** The page it happened on. Captured here rather than at flush time: a batch
   *  routinely leaves after a navigation, and the envelope's path would then
   *  mislabel every event in it. */
  path?: string;
}

export interface QueueOptions {
  maxBatch: number;
  send: (batch: QueuedEvent[]) => void;
  now: () => number;
}

export interface Queue {
  push: (name: string, props?: Record<string, PropValue>, path?: string) => void;
  flush: () => void;
  size: () => number;
}

export function createQueue({ maxBatch, send, now }: QueueOptions): Queue {
  let buffer: QueuedEvent[] = [];

  function flush(): void {
    if (buffer.length === 0) return;
    // Detach BEFORE sending. If send throws, the batch is already gone: retrying
    // would mean holding events across a page hide, which is precisely when they
    // are lost anyway, and a wedged buffer would cost every later event too.
    const batch = buffer;
    buffer = [];
    try {
      send(batch);
    } catch { /* losing analytics is acceptable; breaking the page is not */ }
  }

  return {
    push(name, props, path) {
      buffer.push({ name, props, ts: now(), path });
      if (buffer.length >= maxBatch) flush();
    },
    flush,
    size: () => buffer.length,
  };
}
