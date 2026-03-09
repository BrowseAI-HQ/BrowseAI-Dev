import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  SearchRequestSchema,
  OpenRequestSchema,
  ExtractRequestSchema,
  AnswerRequestSchema,
} from "@browse/shared";
import { search } from "../services/search.js";
import { openPage } from "../services/scrape.js";
import { extractFromPage } from "../services/extract.js";
import { answerQuery } from "../services/answer.js";
import { compareAnswers } from "../services/compare.js";
import { getUserIdFromRequest } from "../lib/auth.js";
import type { CacheService } from "../services/cache.js";
import type { ResultStore } from "../services/store.js";
import type { ApiKeyService } from "../services/apiKeys.js";
import type { Env } from "../config/env.js";

const DEMO_LIMIT = 5;
const DEMO_WINDOW_SECONDS = 3600;

/** Extract a bai_xxx key from X-API-Key header or Authorization: Bearer bai_xxx */
function extractBrowseApiKey(request: FastifyRequest): string | null {
  const xApiKey = request.headers["x-api-key"] as string | undefined;
  if (xApiKey?.startsWith("bai_")) return xApiKey;

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer bai_")) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * Resolve request environment. Priority:
 * 1. BYOK headers (X-Tavily-Key, X-OpenRouter-Key)
 * 2. BrowseAI API key (bai_xxx) → resolve to stored keys
 * 3. Default env keys
 */
async function getRequestEnv(
  request: FastifyRequest,
  env: Env,
  apiKeyService: ApiKeyService | null,
  cache: CacheService
): Promise<{ env: Env; isOwnKeys: boolean; userId: string | null }> {
  // Try to get userId from JWT (for logged-in web users)
  let userId = getUserIdFromRequest(request);

  // Priority 1: BYOK headers
  const tavilyKey = request.headers["x-tavily-key"] as string | undefined;
  const openrouterKey = request.headers["x-openrouter-key"] as string | undefined;

  if (tavilyKey || openrouterKey) {
    return {
      env: {
        ...env,
        ...(tavilyKey && { SERP_API_KEY: tavilyKey }),
        ...(openrouterKey && { OPENROUTER_API_KEY: openrouterKey }),
      },
      isOwnKeys: true,
      userId,
    };
  }

  // Priority 2: BrowseAI API key
  if (apiKeyService) {
    const browseKey = extractBrowseApiKey(request);
    if (browseKey) {
      const cacheKey = `bai_resolve:${browseKey.slice(0, 12)}`;
      const cached = await cache.get(cacheKey);

      let resolved: { userId: string; tavilyKey: string; openrouterKey: string } | null = null;
      if (cached) {
        resolved = JSON.parse(cached);
      } else {
        resolved = await apiKeyService.resolve(browseKey);
        if (resolved) {
          await cache.set(cacheKey, JSON.stringify(resolved), 60);
        }
      }

      if (resolved) {
        userId = resolved.userId;
        return {
          env: {
            ...env,
            SERP_API_KEY: resolved.tavilyKey,
            OPENROUTER_API_KEY: resolved.openrouterKey,
          },
          isOwnKeys: true,
          userId,
        };
      }
    }
  }

  // Priority 3: Default env
  return { env, isOwnKeys: false, userId };
}

async function checkDemoLimit(
  request: FastifyRequest,
  cache: CacheService,
  isOwnKeys: boolean
): Promise<string | null> {
  if (isOwnKeys) return null;
  const ip = request.ip;
  const key = `demo:${ip}`;
  const current = await cache.get(key);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= DEMO_LIMIT) {
    return `Demo limit reached (${DEMO_LIMIT}/hour). Add your own free API keys in Settings for unlimited access.`;
  }
  await cache.set(key, String(count + 1), DEMO_WINDOW_SECONDS);
  return null;
}

export function registerBrowseRoutes(
  app: FastifyInstance,
  env: Env,
  cache: CacheService,
  store: ResultStore,
  apiKeyService: ApiKeyService | null = null
) {
  app.post("/browse/search", async (request, reply) => {
    const parsed = SearchRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: parsed.error.message });

    const { env: reqEnv, isOwnKeys, userId } = await getRequestEnv(request, env, apiKeyService, cache);
    const limitError = await checkDemoLimit(request, cache, isOwnKeys);
    if (limitError) return reply.status(429).send({ success: false, error: limitError });

    try {
      const result = await search(
        parsed.data.query,
        reqEnv.SERP_API_KEY,
        cache,
        parsed.data.limit
      );
      if (userId) store.save(parsed.data.query, { answer: "", claims: [], sources: [], confidence: 0, trace: [] }, userId, "search");
      return { success: true, result };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Search failed" });
    }
  });

  app.post("/browse/open", async (request, reply) => {
    const parsed = OpenRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: parsed.error.message });

    const { isOwnKeys } = await getRequestEnv(request, env, apiKeyService, cache);
    const limitError = await checkDemoLimit(request, cache, isOwnKeys);
    if (limitError) return reply.status(429).send({ success: false, error: limitError });

    try {
      const result = await openPage(parsed.data.url, cache);
      return { success: true, result: result.page };
    } catch (e: any) {
      request.log.error(e);
      const msg = e.message?.includes("not allowed") ? e.message : "Failed to open page";
      return reply.status(500).send({ success: false, error: msg });
    }
  });

  app.post("/browse/extract", async (request, reply) => {
    const parsed = ExtractRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: parsed.error.message });

    const { env: reqEnv, isOwnKeys } = await getRequestEnv(request, env, apiKeyService, cache);
    const limitError = await checkDemoLimit(request, cache, isOwnKeys);
    if (limitError) return reply.status(429).send({ success: false, error: limitError });

    try {
      const result = await extractFromPage(
        parsed.data.url,
        parsed.data.query,
        reqEnv.OPENROUTER_API_KEY,
        cache
      );
      return { success: true, result };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Extraction failed" });
    }
  });

  app.post("/browse/answer", async (request, reply) => {
    const parsed = AnswerRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: parsed.error.message });

    const { env: reqEnv, isOwnKeys, userId } = await getRequestEnv(request, env, apiKeyService, cache);
    const limitError = await checkDemoLimit(request, cache, isOwnKeys);
    if (limitError) return reply.status(429).send({ success: false, error: limitError });

    try {
      const result = await answerQuery(parsed.data.query, reqEnv, cache);
      const shareId = await store.save(parsed.data.query, result, userId || undefined, "answer");
      return { success: true, result: { ...result, shareId } };
    } catch (e: any) {
      request.log.error(e);
      const isRateLimit = e.message?.includes("Rate limit");
      const isCredits = e.message?.includes("credits");
      const status = isRateLimit ? 429 : isCredits ? 402 : 500;
      const msg = isRateLimit ? "Rate limit exceeded" : isCredits ? "Insufficient credits" : "Answer generation failed";
      return reply.status(status).send({ success: false, error: msg });
    }
  });

  // Compare: raw LLM vs evidence-backed
  app.post("/browse/compare", async (request, reply) => {
    const parsed = AnswerRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: parsed.error.message });

    const { env: reqEnv, isOwnKeys } = await getRequestEnv(request, env, apiKeyService, cache);
    const limitError = await checkDemoLimit(request, cache, isOwnKeys);
    if (limitError) return reply.status(429).send({ success: false, error: limitError });

    try {
      const result = await compareAnswers(parsed.data.query, reqEnv, cache);
      return { success: true, result };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Comparison failed" });
    }
  });

  // Share: get a stored result
  app.get("/browse/share/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const data = await store.get(id);
      if (!data) {
        return reply.status(404).send({ success: false, error: "Result not found" });
      }
      return { success: true, result: data };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to retrieve result" });
    }
  });

  // Stats: total queries answered
  app.get("/browse/stats", async () => {
    const count = await store.count();
    return { success: true, result: { totalQueries: count } };
  });

  // User stats (auth required)
  app.get("/user/stats", async (request, reply) => {
    const userId = getUserIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: "Not authenticated" });
    const stats = await store.getUserStats(userId);
    return { success: true, result: stats };
  });

  // User query history (auth required)
  app.get("/user/history", async (request, reply) => {
    const userId = getUserIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: "Not authenticated" });
    const history = await store.getUserHistory(userId);
    return { success: true, result: history };
  });
}
