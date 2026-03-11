import { Redis } from "@upstash/redis";

export interface CacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

export function createUpstashCache(urlOrRedis: string | { url: string; token: string }): CacheService {
  const redis = typeof urlOrRedis === "string"
    ? Redis.fromEnv() // uses UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
    : new Redis({ url: urlOrRedis.url, token: urlOrRedis.token });

  return {
    async get(key) {
      return redis.get<string>(key);
    },
    async set(key, value, ttl = 300) {
      await redis.set(key, value, { ex: ttl });
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
  };
}
