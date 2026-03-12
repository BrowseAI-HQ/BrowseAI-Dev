import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  SearchRequestSchema,
  OpenRequestSchema,
  ExtractRequestSchema,
  AnswerRequestSchema,
  FeedbackRequestSchema,
} from "@browse/shared";
import { search } from "../services/search.js";
import { openPage } from "../services/scrape.js";
import { extractFromPage } from "../services/extract.js";
import { answerQuery } from "../services/answer.js";
import { answerQueryStreaming } from "../services/stream.js";
import { compareAnswers } from "../services/compare.js";
import { getUserIdFromRequest } from "../lib/auth.js";
import { updateDomainScore, getDynamicStats } from "../lib/verify.js";
import { recordFeedback, applyFeedbackToType } from "../lib/learning.js";
import type { CacheService } from "../services/cache.js";
import type { ResultStore } from "../services/store.js";
import type { ApiKeyService } from "../services/apiKeys.js";
import type { SessionStore } from "../services/session.js";
import type { Env } from "../config/env.js";

import type { ZodError } from "zod";

const DEMO_LIMIT = 5;
const DEMO_WINDOW_SECONDS = 3600;

/** Convert Zod error to a human-readable string */
function zodMessage(err: ZodError): string {
  const issues = err.issues.map(i => i.message).join("; ");
  return issues || "Invalid request";
}

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

      let resolved: { userId: string; tavilyKey: string; openrouterKey: string } | null;
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

      // Key was provided but could not be resolved — don't silently fall back
      throw { statusCode: 401, message: "Invalid BrowseAI API key. Check your key or generate a new one in Settings." };
    }
  }

  // Priority 3: Auto-resolve stored keys for signed-in users
  // When a user has saved API keys (via dashboard), use them automatically
  // so they don't hit the demo limit on the website UI
  if (apiKeyService && userId) {
    try {
      const userCacheKey = `user_keys:${userId}`;
      const cached = await cache.get(userCacheKey);

      let resolved: { tavilyKey: string; openrouterKey: string } | null;
      if (cached) {
        resolved = JSON.parse(cached);
      } else {
        resolved = await apiKeyService.resolveByUserId(userId);
        if (resolved) {
          await cache.set(userCacheKey, JSON.stringify(resolved), 60);
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
          userId,
        };
      }
    } catch (e) {
      // Decryption or DB failure — fall through to server keys (no demo limit for authenticated users)
      console.warn("Auto-resolve stored keys failed for user", userId, e);
    }
  }

  // Priority 4: Default env
  // Authenticated users (valid JWT) bypass demo limits even when using server keys
  const isAuthenticated = !!userId;
  return { env, isOwnKeys: isAuthenticated, userId };
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

/** Detect client type from User-Agent and headers */
function detectClient(request: FastifyRequest): string {
  const ua = (request.headers["user-agent"] || "").toLowerCase();
  if (ua.includes("browseai-python")) return "python-sdk";
  if (ua.includes("browse-ai-mcp") || ua.includes("mcp")) return "mcp";
  if (request.headers["x-browse-client"]) return String(request.headers["x-browse-client"]);
  if (request.headers.origin || request.headers.referer) return "web";
  if (ua.includes("curl")) return "curl";
  if (ua.includes("python")) return "python";
  if (ua.includes("node") || ua.includes("axios")) return "node";
  return "api";
}

function isKeyError(e: any): boolean {
  return e.message?.includes("Invalid") && e.message?.includes("key");
}

function errorResponse(e: any, fallbackMsg: string): { status: number; error: string } {
  if (e.statusCode && e.message) return { status: e.statusCode, error: e.message };
  if (isKeyError(e)) return { status: 401, error: "Invalid API key. Check your key in Settings." };
  if (e.message?.includes("Rate limit") || e.message?.includes("429")) return { status: 429, error: "Rate limit exceeded. Please try again in a minute." };
  if (e.message?.includes("credits") || e.message?.includes("insufficient") || e.message?.includes("402")) return { status: 402, error: "Insufficient API credits. Top up your Tavily or OpenRouter account." };
  if (e.message?.includes("No search results")) return { status: 404, error: "No results found. Try rephrasing your question." };
  if (e.message?.includes("Tavily") || e.message?.includes("search failed")) return { status: 502, error: "Search service temporarily unavailable. Please try again." };
  if (e.message?.includes("LLM") || e.message?.includes("parse")) return { status: 502, error: "AI processing error. Please try again." };
  return { status: 500, error: fallbackMsg };
}

export function registerBrowseRoutes(
  app: FastifyInstance,
  env: Env,
  cache: CacheService,
  store: ResultStore,
  apiKeyService: ApiKeyService | null = null,
  sessionStore?: SessionStore
) {
  app.post("/browse/search", async (request, reply) => {
    const parsed = SearchRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: zodMessage(parsed.error) });

    try {
      const { env: reqEnv, isOwnKeys, userId } = await getRequestEnv(request, env, apiKeyService, cache);
      const limitError = await checkDemoLimit(request, cache, isOwnKeys);
      if (limitError) return reply.status(429).send({ success: false, error: limitError });

      const result = await search(
        parsed.data.query,
        reqEnv.SERP_API_KEY,
        cache,
        parsed.data.limit
      );
      const client = detectClient(request);
      if (userId) store.save(parsed.data.query, { answer: "", claims: [], sources: [], confidence: 0, trace: [] }, userId, "search", { client });
      return { success: true, result };
    } catch (e: any) {
      request.log.error(e);
      const { status, error } = errorResponse(e, "Search failed");
      return reply.status(status).send({ success: false, error });
    }
  });

  app.post("/browse/open", async (request, reply) => {
    const parsed = OpenRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: "Please provide a valid URL (e.g. https://example.com)" });

    try {
      const { isOwnKeys } = await getRequestEnv(request, env, apiKeyService, cache);
      const limitError = await checkDemoLimit(request, cache, isOwnKeys);
      if (limitError) return reply.status(429).send({ success: false, error: limitError });

      const result = await openPage(parsed.data.url, cache);
      return { success: true, result: result.page };
    } catch (e: any) {
      request.log.error(e);
      const msg = e.message?.includes("not allowed") ? e.message : "Failed to open page";
      const { status, error } = e.statusCode ? { status: e.statusCode, error: e.message } : { status: 500, error: msg };
      return reply.status(status).send({ success: false, error });
    }
  });

  app.post("/browse/extract", async (request, reply) => {
    const parsed = ExtractRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: "Please provide a valid URL (e.g. https://example.com)" });

    try {
      const { env: reqEnv, isOwnKeys } = await getRequestEnv(request, env, apiKeyService, cache);
      const limitError = await checkDemoLimit(request, cache, isOwnKeys);
      if (limitError) return reply.status(429).send({ success: false, error: limitError });
      const result = await extractFromPage(
        parsed.data.url,
        parsed.data.query,
        reqEnv.OPENROUTER_API_KEY,
        cache
      );
      return { success: true, result };
    } catch (e: any) {
      request.log.error(e);
      const { status, error } = errorResponse(e, "Extraction failed");
      return reply.status(status).send({ success: false, error });
    }
  });

  app.post("/browse/answer", async (request, reply) => {
    const parsed = AnswerRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: zodMessage(parsed.error) });

    try {
      const { env: reqEnv, isOwnKeys, userId } = await getRequestEnv(request, env, apiKeyService, cache);
      const limitError = await checkDemoLimit(request, cache, isOwnKeys);
      if (limitError) return reply.status(429).send({ success: false, error: limitError });
      const result = await answerQuery(parsed.data.query, reqEnv, cache, parsed.data.depth);
      const client = detectClient(request);
      const cacheHit = result.trace?.[0]?.step === "Cache Hit";
      const shareId = await store.save(parsed.data.query, result, userId || undefined, "answer", { client, cacheHit });

      // Self-improving: feed verification signals back into domain authority (fire-and-forget)
      if (result.claims?.length && result.sources?.length) {
        try {
          // Aggregate per-domain verification signals
          const domainUpdates = new Map<string, { verified: number; total: number }>();
          const urlToDomain = new Map<string, string>();
          for (const s of result.sources) {
            urlToDomain.set(s.url, s.domain?.replace(/^www\./, "") || "");
          }
          for (const claim of result.claims) {
            const isVerified = (claim as any).verified === true;
            for (const url of claim.sources || []) {
              const domain = urlToDomain.get(url);
              if (!domain) continue;
              const entry = domainUpdates.get(domain) || { verified: 0, total: 0 };
              entry.total++;
              if (isVerified) entry.verified++;
              domainUpdates.set(domain, entry);
            }
          }

          // Update in-memory scores immediately
          for (const [domain, stats] of domainUpdates) {
            for (let i = 0; i < stats.total; i++) {
              updateDomainScore(domain, i < stats.verified);
            }
          }

          // Persist atomically to DB (no race conditions, no lost samples)
          const dbUpdates = [...domainUpdates.entries()].map(([domain, stats]) => ({
            domain,
            verified_count: stats.verified,
            total_count: stats.total,
          }));
          store.updateDomainScores(dbUpdates).catch(() => {});

          // Also persist accumulated dynamic scores to domain_authority table
          const authorityUpdates = [...domainUpdates.keys()]
            .map((domain) => {
              const accumulated = getDynamicStats(domain);
              if (!accumulated) return null;
              return {
                domain,
                dynamic_score: Math.round(accumulated.dynamicScore * 100) / 100,
                sample_count: accumulated.sampleCount,
              };
            })
            .filter((u): u is NonNullable<typeof u> => u !== null);
          store.saveDomainAuthority(authorityUpdates).catch(() => {});
        } catch {
          // Non-critical — don't fail the response
        }
      }

      return { success: true, result: { ...result, shareId } };
    } catch (e: any) {
      request.log.error(e);
      const { status, error } = errorResponse(e, "Answer generation failed");
      return reply.status(status).send({ success: false, error });
    }
  });

  // Streaming answer — SSE endpoint for real-time progress
  app.post("/browse/answer/stream", async (request, reply) => {
    const parsed = AnswerRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: zodMessage(parsed.error) });

    try {
      const { env: reqEnv, isOwnKeys, userId } = await getRequestEnv(request, env, apiKeyService, cache);
      const limitError = await checkDemoLimit(request, cache, isOwnKeys);
      if (limitError) return reply.status(429).send({ success: false, error: limitError });

      // Set up SSE response
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      const emit = (event: string, data: unknown) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const result = await answerQueryStreaming(parsed.data.query, reqEnv, cache, emit);

      // Save to store and include shareId in done event
      const client = detectClient(request);
      const cacheHit = result.trace?.[0]?.step === "Cache Hit";
      const shareId = await store.save(parsed.data.query, result, userId || undefined, "answer", { client, cacheHit });

      reply.raw.write(`event: done\ndata: ${JSON.stringify({ shareId })}\n\n`);
      reply.raw.end();
    } catch (e: any) {
      request.log.error(e);
      const { error } = errorResponse(e, "Answer generation failed");
      // If headers already sent, send error as SSE event
      if (reply.raw.headersSent) {
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ error })}\n\n`);
        reply.raw.end();
      } else {
        return reply.status(500).send({ success: false, error });
      }
    }
  });

  // Compare: raw LLM vs evidence-backed
  app.post("/browse/compare", async (request, reply) => {
    const parsed = AnswerRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: zodMessage(parsed.error) });

    try {
      const { env: reqEnv, isOwnKeys } = await getRequestEnv(request, env, apiKeyService, cache);
      const limitError = await checkDemoLimit(request, cache, isOwnKeys);
      if (limitError) return reply.status(429).send({ success: false, error: limitError });
      const result = await compareAnswers(parsed.data.query, reqEnv, cache);
      return { success: true, result };
    } catch (e: any) {
      request.log.error(e);
      const { status, error } = errorResponse(e, "Comparison failed");
      return reply.status(status).send({ success: false, error, detail: e.message });
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

  // Top sources (public — great for marketing)
  app.get("/browse/sources/top", async (request) => {
    const { limit } = request.query as { limit?: string };
    const topSources = await store.getTopSources(limit ? parseInt(limit) : 20);
    return { success: true, result: topSources };
  });

  // Analytics summary (auth required)
  app.get("/browse/analytics/summary", async (request, reply) => {
    const userId = getUserIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: "Not authenticated" });
    const summary = await store.getAnalyticsSummary();
    return { success: true, result: summary };
  });

  // User feedback on a result (rate-limited: 10/hour per IP)
  app.post("/browse/feedback", async (request, reply) => {
    const parsed = FeedbackRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send({ success: false, error: zodMessage(parsed.error) });

    // Rate limit feedback: 10/hour per IP to prevent learning poisoning
    const ip = request.ip || "unknown";
    const feedbackKey = `feedback:${ip}`;
    const feedbackCount = parseInt((await cache.get(feedbackKey)) || "0");
    if (feedbackCount >= 10) {
      return reply.status(429).send({ success: false, error: "Feedback rate limit exceeded (10/hour)" });
    }
    await cache.set(feedbackKey, String(feedbackCount + 1), 3600);

    const { resultId, rating, claimIndex } = parsed.data;

    // Validate resultId exists before recording feedback
    const stored = await store.get(resultId);
    if (!stored) {
      return reply.status(404).send({ success: false, error: "Result not found" });
    }

    // Record feedback in learning engine
    recordFeedback({ resultId, rating, claimIndex });

    // Link feedback to query type via Search Web trace step: "N results (...) [factual]"
    const searchTrace = stored.result.trace?.find(t => t.step.startsWith("Search Web"));
    const typeMatch = searchTrace?.detail?.match(/\[(\w[\w-]*)\]\s*$/);
    if (typeMatch) {
      applyFeedbackToType(typeMatch[1], rating);
    }

    return { success: true, result: { recorded: true } };
  });
}
