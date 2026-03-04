import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnv } from "./config/env.js";
import { createRedisCache, createMemoryCache } from "./services/cache.js";
import { createSupabaseStore, createNoopStore } from "./services/store.js";
import { registerBrowseRoutes } from "./routes/browse.js";

async function main() {
  const env = await loadEnv();

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Tavily-Key", "X-OpenRouter-Key"],
  });

  const cache = env.REDIS_URL
    ? createRedisCache(env.REDIS_URL)
    : createMemoryCache();

  if (!env.REDIS_URL) {
    app.log.info("No REDIS_URL set, using in-memory cache");
  }

  const store =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
      : createNoopStore();

  registerBrowseRoutes(app, env, cache, store);

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
