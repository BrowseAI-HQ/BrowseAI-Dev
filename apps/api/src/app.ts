import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnv } from "./config/env.js";
import { createRedisCache, createMemoryCache } from "./services/cache.js";
import { createSupabaseStore, createNoopStore } from "./services/store.js";
import { createApiKeyService } from "./services/apiKeys.js";
import { registerBrowseRoutes } from "./routes/browse.js";
import { registerApiKeyRoutes } from "./routes/apiKeys.js";

export async function buildApp() {
  const env = await loadEnv();

  const app = Fastify({ logger: true });

  const allowedOrigins = [
    env.CORS_ORIGIN,
    ...(process.env.NODE_ENV !== "production"
      ? ["http://localhost:8080", "http://localhost:5173"]
      : []),
  ].filter(Boolean);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Tavily-Key", "X-OpenRouter-Key", "X-API-Key", "Authorization"],
  });

  const cache = env.REDIS_URL
    ? createRedisCache(env.REDIS_URL)
    : createMemoryCache();

  const store =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
      : createNoopStore();

  const apiKeyService =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.API_KEY_ENCRYPTION_KEY
      ? createApiKeyService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.API_KEY_ENCRYPTION_KEY)
      : null;

  registerBrowseRoutes(app, env, cache, store, apiKeyService);

  if (apiKeyService) {
    registerApiKeyRoutes(app, apiKeyService);
  }

  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  return app;
}
