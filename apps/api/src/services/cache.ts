import Redis from "ioredis";

export interface CacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

export function createRedisCache(url: string): CacheService {
  const redis = new (Redis as any)(url);
  return {
    async get(key) {
      return redis.get(key);
    },
    async set(key, value, ttl = 300) {
      await redis.setex(key, ttl, value);
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
