import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnv } from "./config/env.js";
import { createUpstashCache, createMemoryCache } from "./services/cache.js";
import { createSupabaseStore, createNoopStore } from "./services/store.js";
import { createApiKeyService } from "./services/apiKeys.js";
import { registerBrowseRoutes } from "./routes/browse.js";
import { registerApiKeyRoutes } from "./routes/apiKeys.js";
import { registerWaitlistRoutes } from "./routes/waitlist.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerSessionRoutes } from "./routes/session.js";
import { createSupabaseSessionStore, createNoopSessionStore } from "./services/session.js";
import { initDomainAuthority, loadDomainIntelState, setDomainIntelCache } from "./lib/verify.js";
import { loadLearningState, setLearningCache } from "./lib/learning.js";
import { setCalibrationData } from "./lib/gemini.js";

export async function buildApp() {
  const env = await loadEnv();

  const app = Fastify({ logger: true });

  await app.register(cors as any, {
    origin: true, // Allow all origins — API is public, protected by auth tokens + rate limiting
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Tavily-Key", "X-OpenRouter-Key", "X-API-Key", "Authorization"],
  });

  // Vercel KV sets KV_REST_API_URL + KV_REST_API_TOKEN
  // Upstash sets UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
  const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  const cache = kvUrl && kvToken
    ? createUpstashCache({ url: kvUrl, token: kvToken })
    : createMemoryCache();

  const store =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
      : createNoopStore();

  const apiKeyService =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.API_KEY_ENCRYPTION_KEY
      ? createApiKeyService(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.API_KEY_ENCRYPTION_KEY)
      : null;

  // Initialize all state in parallel (domain authority, learning, calibration)
  setLearningCache(cache);
  setDomainIntelCache(cache);

  const [domainCount, learningTypes, domainIntel, calibrationBuckets] = await Promise.all([
    initDomainAuthority(store),
    loadLearningState(cache),
    loadDomainIntelState(cache),
    store.getCalibrationData(),
  ]);

  if (domainCount > 0) console.log(`Loaded ${domainCount} domain authority entries from DB`);
  if (learningTypes > 0) console.log(`Restored learning state for ${learningTypes} query types`);
  if (domainIntel.coCitationCount > 0 || domainIntel.usefulnessCount > 0) {
    console.log(`Restored domain intelligence: ${domainIntel.coCitationCount} co-citation, ${domainIntel.usefulnessCount} usefulness scores`);
  }
  if (calibrationBuckets.length > 0) {
    setCalibrationData(calibrationBuckets);
    const totalFeedback = calibrationBuckets.reduce((sum, b) => sum + b.count, 0);
    console.log(`Loaded calibration data from ${totalFeedback} feedback samples`);
  }

  const sessionStore =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseSessionStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
      : createNoopSessionStore();

  registerBrowseRoutes(app, env, cache, store, apiKeyService, sessionStore);
  registerSessionRoutes(app, env, cache, store, sessionStore, apiKeyService);

  if (apiKeyService) {
    registerApiKeyRoutes(app, apiKeyService);
  }

  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    registerWaitlistRoutes(app, env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    registerAdminRoutes(app, env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, store);
  }

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
