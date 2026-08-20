/**
 * In-memory Redis stub for single-instance / local-dev deployments.
 *
 * Implements just enough of the ioredis surface used by token cache and
 * todo store: get / set / setex / del / ping / quit / on / status.
 * Data lives in a process-local Map with TTL handled by setTimeout.
 *
 * Selected by lib/redis.ts when REDIS_ENABLED !== "true".
 */

import logger from "@/lib/logger";

type Listener = (...args: unknown[]) => void;

interface Entry {
  value: string;
  expiresAt?: number;
  timer?: NodeJS.Timeout;
}

export class MemoryRedis {
  private store = new Map<string, Entry>();
  private listeners = new Map<string, Listener[]>();
  public status: "ready" = "ready";

  constructor() {
    logger.info("MemoryRedis initialized (Redis disabled)");
    queueMicrotask(() => this.emit("connect"));
    queueMicrotask(() => this.emit("ready"));
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.clearTimer(key);
    this.store.set(key, { value });
    return "OK";
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<"OK"> {
    this.clearTimer(key);
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const timer = setTimeout(() => this.store.delete(key), ttlSeconds * 1000);
    if (typeof timer.unref === "function") timer.unref();
    this.store.set(key, { value, expiresAt, timer });
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      this.clearTimer(key);
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async ping(): Promise<"PONG"> {
    return "PONG";
  }

  async quit(): Promise<"OK"> {
    for (const entry of this.store.values()) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    this.store.clear();
    this.emit("end");
    return "OK";
  }

  on(event: string, listener: Listener): this {
    const list = this.listeners.get(event) ?? [];
    list.push(listener);
    this.listeners.set(event, list);
    return this;
  }

  private emit(event: string, ...args: unknown[]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const fn of list) {
      try {
        fn(...args);
      } catch {
        // Listener errors must not crash the stub.
      }
    }
  }

  private clearTimer(key: string): void {
    const entry = this.store.get(key);
    if (entry?.timer) clearTimeout(entry.timer);
  }
}
