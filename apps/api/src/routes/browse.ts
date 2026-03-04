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
): Promise<{ env: Env; isOwnKeys: boolean }> {
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
        return {
          env: {
            ...env,
            SERP_API_KEY: resolved.tavilyKey,
            OPENROUTER_API_KEY: resolved.openrouterKey,
          },
          isOwnKeys: true,
        };
      }
    }
  }

  // Priority 3: Default env
  return { env, isOwnKeys: false };
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

    const { env: reqEnv, isOwnKeys } = await getRequestEnv(request, env, apiKeyService, cache);
    const limitError = await checkDemoLimit(request, cache, isOwnKeys);
    if (limitError) return reply.status(429).send({ success: false, error: limitError });

    try {
      const result = await search(
        parsed.data.query,
        reqEnv.SERP_API_KEY,
        cache,
        parsed.data.limit
      );
      return { success: true, result };
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message });
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
      return reply.status(500).send({ success: false, error: e.message });
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
      return reply.status(500).send({ success: false, error: e.message });
    }
  });

  app.post("/browse/answer", async (request, reply) => {
    const parsed = AnswerRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: parsed.error.message });

    const { env: reqEnv, isOwnKeys } = await getRequestEnv(request, env, apiKeyService, cache);
    const limitError = await checkDemoLimit(request, cache, isOwnKeys);
    if (limitError) return reply.status(429).send({ success: false, error: limitError });

    try {
      const result = await answerQuery(parsed.data.query, reqEnv, cache);
      const shareId = await store.save(parsed.data.query, result);
      return { success: true, result: { ...result, shareId } };
    } catch (e: any) {
      const status = e.message.includes("Rate limit")
        ? 429
        : e.message.includes("credits")
          ? 402
          : 500;
      return reply.status(status).send({ success: false, error: e.message });
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
      return reply.status(500).send({ success: false, error: e.message });
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
      return reply.status(500).send({ success: false, error: e.message });
    }
  });

  // Stats: total queries answered
  app.get("/browse/stats", async () => {
    const count = await store.count();
    return { success: true, result: { totalQueries: count } };
  });
}
