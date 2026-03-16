import { Redis } from "@upstash/redis";

export interface CacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  ttl(key: string): Promise<number>;
  /** Atomically increment a counter key by 1. Sets TTL on first creation. Returns the new value. */
  incr(key: string, ttlSeconds?: number): Promise<number>;
}

export function createUpstashCache(urlOrRedis: string | { url: string; token: string }): CacheService {
  const redis = typeof urlOrRedis === "string"
    ? Redis.fromEnv() // uses UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
    : new Redis({ url: urlOrRedis.url, token: urlOrRedis.token });

  return {
    async get(key) {
      const val = await redis.get(key);
      if (val === null || val === undefined) return null;
      // Upstash auto-deserializes JSON — if it returned an object, re-stringify it
      // so callers always get a string (matching the CacheService interface)
      return typeof val === "string" ? val : JSON.stringify(val);
    },
    async set(key, value, ttl = 300) {
      await redis.set(key, value, { ex: ttl });
    },
    async ttl(key) {
      const val = await redis.ttl(key);
      return val > 0 ? val : 0;
    },
    async incr(key, ttl = 86400) {
      const val = await redis.incr(key);
      if (val === 1) await redis.expire(key, ttl);
      return val;
    },
  };
}

const MAX_MEMORY_CACHE_ENTRIES = 10_000;
const CLEANUP_INTERVAL_MS = 60_000; // 1 minute

/**
 * LRU memory cache with TTL expiration.
 * Uses Map insertion order + delete/re-insert to maintain LRU ordering.
 * Least-recently-used entries are at the front of the Map iterator.
 */
export function createMemoryCache(): CacheService {
  const store = new Map<string, { value: string; expires: number }>();

  // Periodic cleanup of expired entries to prevent unbounded memory growth
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.expires) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow process to exit without waiting for cleanup timer
  if (cleanupTimer.unref) cleanupTimer.unref();

  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expires) {
        store.delete(key);
        return null;
      }
      // LRU promotion: delete and re-insert to move to end (most recently used)
      store.delete(key);
      store.set(key, entry);
      return entry.value;
    },
    async set(key, value, ttl = 300) {
      // Delete first so re-insert moves to end (most recently used)
      store.delete(key);
      // Evict least recently used (front of Map) if at capacity
      if (store.size >= MAX_MEMORY_CACHE_ENTRIES) {
        const lru = store.keys().next().value;
        if (lru !== undefined) store.delete(lru);
      }
      store.set(key, { value, expires: Date.now() + ttl * 1000 });
    },
    async ttl(key) {
      const entry = store.get(key);
      if (!entry) return 0;
      const remaining = Math.ceil((entry.expires - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    },
    async incr(key, ttl = 86400) {
      const entry = store.get(key);
      if (entry && Date.now() <= entry.expires) {
        const newVal = parseInt(entry.value, 10) + 1;
        // LRU: delete and re-insert to move to end
        store.delete(key);
        store.set(key, { value: String(newVal), expires: entry.expires });
        return newVal;
      }
      // New key or expired — evict if at capacity
      store.delete(key);
      if (store.size >= MAX_MEMORY_CACHE_ENTRIES) {
        const lru = store.keys().next().value;
        if (lru !== undefined) store.delete(lru);
      }
      store.set(key, { value: "1", expires: Date.now() + ttl * 1000 });
      return 1;
    },
  };
}
