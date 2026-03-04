import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnv } from "./config/env.js";
import { createRedisCache, createMemoryCache } from "./services/cache.js";
import { createSupabaseStore, createNoopStore } from "./services/store.js";
import { registerBrowseRoutes } from "./routes/browse.js";

export async function buildApp() {
  const env = await loadEnv();

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Tavily-Key", "X-OpenRouter-Key", "Authorization"],
  });

  const cache = env.REDIS_URL
    ? createRedisCache(env.REDIS_URL)
    : createMemoryCache();

  const store =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
      : createNoopStore();

  registerBrowseRoutes(app, env, cache, store);

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  return app;
}
