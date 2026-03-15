import { Redis } from "@upstash/redis";

export interface CacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  ttl(key: string): Promise<number>;
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
  };
}

export function createMemoryCache(): CacheService {
  const store = new Map<string, { value: string; expires: number }>();
  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry || Date.now() > entry.expires) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttl = 300) {
      store.set(key, { value, expires: Date.now() + ttl * 1000 });
    },
    async ttl(key) {
      const entry = store.get(key);
      if (!entry) return 0;
      const remaining = Math.ceil((entry.expires - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    },
  };
}
