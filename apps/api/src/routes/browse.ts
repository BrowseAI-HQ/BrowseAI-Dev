import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  SearchRequestSchema,
  OpenRequestSchema,
  ExtractRequestSchema,
  AnswerRequestSchema,
  FeedbackRequestSchema,
  CompareRequestSchema,
  DISCLAIMER,
} from "@browse/shared";
import { search } from "../services/search.js";
import { openPage } from "../services/scrape.js";
import { extractFromPage } from "../services/extract.js";
import { answerQuery } from "../services/answer.js";
import type { AnswerOptions } from "../services/answer.js";
import { answerQueryStreaming } from "../services/stream.js";
import { compareAnswers, getAvailableProviders } from "../services/compare.js";
import { getUserIdFromRequest } from "../lib/auth.js";
import { updateDomainScore, getDynamicStats } from "../lib/verify.js";
import { recordFeedback, applyFeedbackToType } from "../lib/learning.js";
import { setCalibrationData } from "../lib/gemini.js";
import { createSearchProvider } from "../lib/searchProvider.js";
import type { CacheService } from "../services/cache.js";
import type { ResultStore } from "../services/store.js";
import type { ApiKeyService } from "../services/apiKeys.js";
import type { SessionStore } from "../services/session.js";
import type { Env } from "../config/env.js";

import type { ZodError } from "zod";

const DEMO_LIMIT = 5;
const DEMO_WINDOW_SECONDS = 3600;

/** Free BAI key users get 100 premium queries/day before graceful fallback to BM25 */
const FREE_PREMIUM_DAILY_LIMIT = 100;
const PREMIUM_WINDOW_SECONDS = 86400; // 24 hours

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
 * 1. Explicit bai_ key in header → resolve to stored keys + premium features
 * 2. Signed-in user with stored keys → stored keys + premium features
 * 3. BYOK headers (X-Tavily-Key, X-OpenRouter-Key) → their keys, no premium
 * 4. Demo → server keys, 5/hr, no premium
 *
 * If a bai_ user's stored keys fail (exhausted limits etc.), fall to demo (5/hr, no premium).
 * We never subsidize bai_ users with server keys.
 */
/**
 * Check if a BAI key user has exceeded their daily premium quota.
 * Returns { exceeded, used, limit } — when exceeded, caller strips premium keys.
 */
async function checkPremiumQuota(
  userId: string,
  cache: CacheService
): Promise<{ exceeded: boolean; used: number; limit: number; resetsInSeconds: number }> {
  const key = `premium_quota:${userId}`;
  const current = await cache.get(key);
  const used = current ? parseInt(current, 10) : 0;
  const resetsInSeconds = current ? await cache.ttl(key) : 0;
  return { exceeded: used >= FREE_PREMIUM_DAILY_LIMIT, used, limit: FREE_PREMIUM_DAILY_LIMIT, resetsInSeconds };
}

/** Increment premium usage counter after a successful premium query (atomic) */
async function incrementPremiumUsage(userId: string, cache: CacheService, cost: number = 1): Promise<void> {
  const key = `premium_quota:${userId}`;
  for (let i = 0; i < cost; i++) {
    await cache.incr(key, PREMIUM_WINDOW_SECONDS);
  }
}

async function getRequestEnv(
  request: FastifyRequest,
  env: Env,
  apiKeyService: ApiKeyService | null,
  cache: CacheService
): Promise<{ env: Env; isOwnKeys: boolean; userId: string | null; hasBaiKey: boolean; premiumActive: boolean; premiumQuota?: { used: number; limit: number } }> {
  // Try to get userId from JWT (for logged-in web users)
  let userId = await getUserIdFromRequest(request);

  // Priority 1: Explicit bai_ key in header (X-API-Key or Authorization: Bearer bai_xxx)
  if (apiKeyService) {
    const browseKey = extractBrowseApiKey(request);
    if (browseKey) {
      // Resolve on every request — don't cache decrypted secrets in Redis
      const resolved = await apiKeyService.resolve(browseKey);

      if (resolved) {
        userId = resolved.userId;
        // Check daily premium quota — graceful fallback when exceeded
        const quota = await checkPremiumQuota(userId, cache);
        const premiumActive = !quota.exceeded;
        return {
          env: {
            ...env,
            SERP_API_KEY: resolved.tavilyKey,
            OPENROUTER_API_KEY: resolved.openrouterKey,
            // Strip premium keys if quota exceeded — falls back to BM25
            ...(premiumActive ? {} : { HF_API_KEY: undefined, BRAVE_API_KEY: undefined, EXA_API_KEY: undefined }),
          },
          isOwnKeys: true,
          userId,
          hasBaiKey: true,
          premiumActive,
          premiumQuota: { used: quota.used, limit: quota.limit },
        };
      }

      // Key was provided but could not be resolved — don't silently fall back
      throw { statusCode: 401, message: "Invalid BrowseAI Dev API key. Check your key or generate a new one in Settings." };
    }
  }

  // Priority 2: Signed-in user with stored keys (bai_ key holder using the website UI)
  // Their stored Tavily/OpenRouter keys are used, with premium features enabled.
  // This takes precedence over BYOK headers — bai_ users always use their stored keys.
  if (apiKeyService && userId) {
    try {
      // Resolve on every request — don't cache decrypted secrets in Redis
      const resolved = await apiKeyService.resolveByUserId(userId);

      if (resolved) {
        // Check daily premium quota — graceful fallback when exceeded
        const quota = await checkPremiumQuota(userId, cache);
        const premiumActive = !quota.exceeded;
        return {
          env: {
            ...env,
            SERP_API_KEY: resolved.tavilyKey,
            OPENROUTER_API_KEY: resolved.openrouterKey,
            ...(premiumActive ? {} : { HF_API_KEY: undefined, BRAVE_API_KEY: undefined, EXA_API_KEY: undefined }),
          },
          isOwnKeys: true,
          userId,
          hasBaiKey: true,
          premiumActive,
          premiumQuota: { used: quota.used, limit: quota.limit },
        };
      }
    } catch (e) {
      // Decryption or DB failure — fall through, don't use server keys for bai_ users
      console.warn("Auto-resolve stored keys failed for user", userId, e);
    }
  }

  // Priority 3: BYOK headers (no bai_ key, no stored keys)
  const tavilyKey = request.headers["x-tavily-key"] as string | undefined;
  const openrouterKey = request.headers["x-openrouter-key"] as string | undefined;

  if (tavilyKey || openrouterKey) {
    // BYOK only bypasses demo rate limit if a Tavily key is provided.
    // OpenRouter-only BYOK still uses server Tavily key so it counts as demo.
    const hasTavilyKey = !!tavilyKey && tavilyKey.length >= 10;
    return {
      env: {
        ...env,
        ...(tavilyKey && { SERP_API_KEY: tavilyKey }),
        ...(openrouterKey && { OPENROUTER_API_KEY: openrouterKey }),
        // BYOK users don't get premium features — those are bai_ key perks
        HF_API_KEY: undefined,
        BRAVE_API_KEY: undefined,
        EXA_API_KEY: undefined,
      },
      isOwnKeys: hasTavilyKey,
      userId,
      hasBaiKey: false,
      premiumActive: false,
    };
  }

  // Priority 4: Demo (server keys, 5/hr rate limit, no premium features)
  return {
    env: {
      ...env,
      HF_API_KEY: undefined,
      BRAVE_API_KEY: undefined,
      EXA_API_KEY: undefined,
    },
    isOwnKeys: false,
    userId,
    hasBaiKey: false,
    premiumActive: false,
  };
}

async function checkDemoLimit(
  request: FastifyRequest,
  cache: CacheService,
  isOwnKeys: boolean
): Promise<string | null> {
  if (isOwnKeys) return null;
  const ip = request.ip;
  const key = `demo:${ip}`;
  const count = await cache.incr(key, DEMO_WINDOW_SECONDS);
  if (count > DEMO_LIMIT) {
    return `Demo limit reached (${DEMO_LIMIT}/hour). Sign in and generate a free API key at browseai.dev/dashboard for unlimited access with premium features.`;
  }
  return null;
}

/** Detect client type from User-Agent and headers */
function detectClient(request: FastifyRequest): string {
  const ua = (request.headers["user-agent"] || "").toLowerCase();
  if (ua.includes("browseaidev-python") || ua.includes("browseai-python")) return "python-sdk";
  if (ua.includes("browseai-dev-mcp") || ua.includes("browse-ai-mcp") || ua.includes("mcp")) return "mcp";
  if (request.headers["x-browse-client"]) return String(request.headers["x-browse-client"]).slice(0, 50).replace(/[^a-zA-Z0-9_.-]/g, "");
  if (request.headers.origin || request.headers.referer) return "web";
  if (ua.includes("curl")) return "curl";
  if (ua.includes("python")) return "python";
  if (ua.includes("node") || ua.includes("axios")) return "node";
  return "api";
}

function isKeyError(e: unknown): boolean {
  const err = e as { message?: string };
  return !!err.message?.includes("Invalid") && !!err.message?.includes("key");
}

function errorResponse(e: unknown, fallbackMsg: string): { status: number; error: string } {
  const err = e as { statusCode?: number; message?: string };
  if (err.statusCode && err.message) return { status: err.statusCode, error: err.message };
  const msg = err.message || "";
  // Specific key error categories (expired vs invalid vs forbidden)
  if (msg.includes("expired") || msg.includes("trial ended")) return { status: 402, error: msg };
  if (msg.includes("credits exhausted") || msg.includes("Top up")) return { status: 402, error: msg };
  if (msg.includes("forbidden") || msg.includes("revoked")) return { status: 403, error: msg };
  if (isKeyError(e)) return { status: 401, error: msg || "Invalid API key. Check your key in Settings." };
  if (msg.includes("Rate limit") || msg.includes("rate limit") || msg.includes("429")) return { status: 429, error: "Rate limit exceeded. Please try again in a minute." };
  if (msg.includes("credits") || msg.includes("insufficient") || msg.includes("402")) return { status: 402, error: msg };
  if (msg.includes("No search results")) return { status: 404, error: "No results found. Try rephrasing your question." };
  if (msg.includes("Tavily") || msg.includes("search failed")) return { status: 502, error: "Search service temporarily unavailable. Please try again." };
  if (msg.includes("LLM") || msg.includes("parse")) return { status: 502, error: "AI processing error. Please try again." };
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
      // Save actual search results so history items aren't blank
      if (userId) {
        const browseResult = {
          answer: "",
          claims: [],
          sources: result.results.map((r: { url: string; title: string; content?: string }) => ({
            url: r.url,
            title: r.title,
            domain: new URL(r.url).hostname.replace(/^www\./, ""),
            quote: r.content?.slice(0, 300) || "",
          })),
          confidence: 0,
          trace: [],
        };
        store.save(parsed.data.query, browseResult, userId, "search", { client });
      }
      return { success: true, result };
    } catch (e: unknown) {
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
    } catch (e: unknown) {
      request.log.error(e);
      const err = e as { statusCode?: number; message?: string };
      const msg = err.message?.includes("not allowed") ? err.message : "Failed to open page";
      const { status, error } = err.statusCode ? { status: err.statusCode, error: err.message || msg } : { status: 500, error: msg };
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
    } catch (e: unknown) {
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
      const { env: reqEnv, isOwnKeys, userId, premiumActive, premiumQuota } = await getRequestEnv(request, env, apiKeyService, cache);
      const limitError = await checkDemoLimit(request, cache, isOwnKeys);
      if (limitError) return reply.status(429).send({ success: false, error: limitError });
      // Build answer options with optional search provider
      const answerOpts: AnswerOptions = {};
      if (parsed.data.searchProvider) {
        const providerConfig = parsed.data.searchProvider as import("@browse/shared").SearchProviderConfig;
        answerOpts.searchProvider = createSearchProvider({
          ...providerConfig,
          // API keys for enterprise providers come from the provider config, not env
          apiKey: providerConfig.authHeader,
        });
        answerOpts.dataRetention = providerConfig.dataRetention || "normal";
      }

      // Deep mode requires premium (uses our HF key for multiple re-rank + NLI passes).
      // Gracefully fall back to thorough if premium isn't active.
      let effectiveDepth = parsed.data.depth as "fast" | "thorough" | "deep";
      if (effectiveDepth === "deep" && !premiumActive) {
        effectiveDepth = "thorough";
      }

      const result = await answerQuery(parsed.data.query as string, reqEnv, cache, effectiveDepth, undefined, answerOpts);
      const client = detectClient(request);
      const noRetention = answerOpts.dataRetention === "none";
      const cacheHit = result.trace?.[0]?.step === "Cache Hit";
      const shareId = noRetention ? undefined : await store.save(parsed.data.query, result, userId || undefined, "answer", { client, cacheHit });

      // Self-improving: feed verification signals back into domain authority (fire-and-forget)
      // Skip in zero data retention mode
      if (result.claims?.length && result.sources?.length && !noRetention) {
        try {
          // Aggregate per-domain verification signals
          const domainUpdates = new Map<string, { verified: number; total: number }>();
          const urlToDomain = new Map<string, string>();
          for (const s of result.sources) {
            urlToDomain.set(s.url, s.domain?.replace(/^www\./, "") || "");
          }
          for (const claim of result.claims) {
            const isVerified = claim.verified === true;
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
          store.updateDomainScores(dbUpdates).catch((err) => console.warn("Failed to persist domain scores:", err));

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
          store.saveDomainAuthority(authorityUpdates).catch((err) => console.warn("Failed to persist domain authority:", err));
        } catch (e) {
          console.warn("Failed to update domain authority:", e instanceof Error ? e.message : e);
        }
      }

      // Increment premium quota counter (fire-and-forget) if premium was used
      // Deep mode counts as 3x since it uses multiple HF re-rank + NLI passes
      if (premiumActive && userId) {
        const quotaCost = effectiveDepth === "deep" ? 3 : 1;
        incrementPremiumUsage(userId, cache, quotaCost).catch((err) => console.warn("Failed to increment premium quota:", err));
      }

      return {
        success: true,
        result: { ...result, shareId, effectiveDepth },
        ...(premiumQuota && { quota: { ...premiumQuota, premiumActive } }),
        disclaimer: DISCLAIMER,
      };
    } catch (e: unknown) {
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
      const { env: reqEnv, isOwnKeys, userId, premiumActive, premiumQuota } = await getRequestEnv(request, env, apiKeyService, cache);
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

      // Deep mode requires premium — fall back to thorough for streaming too
      const reqDepth = parsed.data.depth as "fast" | "thorough" | "deep";
      const streamDepth: "fast" | "thorough" | "deep" = reqDepth === "deep" && !premiumActive ? "thorough" : reqDepth;

      const result = await answerQueryStreaming(parsed.data.query as string, reqEnv, cache, emit, streamDepth);

      // Respect dataRetention from searchProvider config
      const noRetention = parsed.data.searchProvider?.dataRetention === "none";

      // Save to store and include shareId in done event
      const client = detectClient(request);
      const cacheHit = result.trace?.[0]?.step === "Cache Hit";
      const shareId = noRetention ? undefined : await store.save(parsed.data.query, result, userId || undefined, "answer", { client, cacheHit });

      // Increment premium quota counter (fire-and-forget) if premium was used
      // Deep mode counts as 3x
      if (premiumActive && userId) {
        const quotaCost = streamDepth === "deep" ? 3 : 1;
        incrementPremiumUsage(userId, cache, quotaCost).catch((err) => console.warn("Failed to increment premium quota:", err));
      }

      reply.raw.write(`event: done\ndata: ${JSON.stringify({ shareId, effectiveDepth: streamDepth, ...(premiumQuota && { quota: { ...premiumQuota, premiumActive } }), disclaimer: DISCLAIMER })}\n\n`);
      reply.raw.end();
    } catch (e: unknown) {
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

  // Compare: competitor vs evidence-backed
  app.post("/browse/compare", async (request, reply) => {
    const parsed = CompareRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply
        .status(400)
        .send({ success: false, error: zodMessage(parsed.error) });

    try {
      const { env: reqEnv, isOwnKeys } = await getRequestEnv(request, env, apiKeyService, cache);
      const limitError = await checkDemoLimit(request, cache, isOwnKeys);
      if (limitError) return reply.status(429).send({ success: false, error: limitError });
      const result = await compareAnswers(parsed.data.query, parsed.data.provider, reqEnv, cache);
      return { success: true, result, disclaimer: DISCLAIMER };
    } catch (e: unknown) {
      request.log.error(e);
      const { status, error } = errorResponse(e, "Comparison failed");
      return reply.status(status).send({ success: false, error });
    }
  });

  // Available compare providers (based on configured API keys)
  app.get("/browse/compare/providers", async (_request, reply) => {
    const providers = getAvailableProviders(env);
    return { success: true, result: providers };
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
    } catch (e: unknown) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to retrieve result" });
    }
  });

  // Stats: total queries answered
  app.get("/browse/stats", async (_request, reply) => {
    try {
      const count = await store.count();
      return { success: true, result: { totalQueries: count } };
    } catch (e: unknown) {
      const err = e as { message?: string };
      return reply.status(500).send({ success: false, error: err.message || "Failed to fetch stats" });
    }
  });

  // User stats (auth required)
  app.get("/user/stats", async (request, reply) => {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: "Not authenticated" });
    const stats = await store.getUserStats(userId);
    return { success: true, result: stats };
  });

  // User query history (auth required)
  app.get("/user/history", async (request, reply) => {
    const userId = await getUserIdFromRequest(request);
    if (!userId) return reply.status(401).send({ success: false, error: "Not authenticated" });
    const history = await store.getUserHistory(userId);
    return { success: true, result: history };
  });

  // Top sources (public — great for marketing)
  app.get("/browse/sources/top", async (request, reply) => {
    try {
      const { limit } = request.query as { limit?: string };
      const topSources = await store.getTopSources(limit ? parseInt(limit, 10) : 20);
      return { success: true, result: topSources };
    } catch (e: unknown) {
      const err = e as { message?: string };
      return reply.status(500).send({ success: false, error: err.message || "Failed to fetch top sources" });
    }
  });

  // Analytics summary (auth required)
  app.get("/browse/analytics/summary", async (request, reply) => {
    try {
      const userId = await getUserIdFromRequest(request);
      if (!userId) return reply.status(401).send({ success: false, error: "Not authenticated" });
      const summary = await store.getAnalyticsSummary();
      return { success: true, result: summary };
    } catch (e: unknown) {
      const err = e as { message?: string };
      return reply.status(500).send({ success: false, error: err.message || "Failed to fetch analytics summary" });
    }
  });

  // User feedback on a result (rate-limited: 10/hour per IP)
  app.post("/browse/feedback", async (request, reply) => {
    const parsed = FeedbackRequestSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send({ success: false, error: zodMessage(parsed.error) });

    // Rate limit feedback: 10/hour per IP to prevent learning poisoning
    const ip = request.ip || "unknown";
    const feedbackKey = `feedback:${ip}`;
    const feedbackCount = await cache.incr(feedbackKey, 3600);
    if (feedbackCount > 10) {
      return reply.status(429).send({ success: false, error: "Feedback rate limit exceeded (10/hour)" });
    }

    const resultId = parsed.data.resultId as string;
    const rating = parsed.data.rating as "good" | "bad" | "wrong";
    const claimIndex = parsed.data.claimIndex as number | undefined;

    // Validate resultId exists before recording feedback
    const stored = await store.get(resultId);
    if (!stored) {
      return reply.status(404).send({ success: false, error: "Result not found" });
    }

    // Record feedback in learning engine + persist to Supabase for calibration
    recordFeedback({ resultId, rating, claimIndex });
    await store.saveFeedback(resultId, rating, claimIndex);

    // Link feedback to query type via Search Web trace step: "N results (...) [factual]"
    const searchTrace = stored.result.trace?.find(t => t.step.startsWith("Search Web"));
    const typeMatch = searchTrace?.detail?.match(/\[(\w[\w-]*)\]\s*$/);
    if (typeMatch) {
      applyFeedbackToType(typeMatch[1], rating);
    }

    // Refresh confidence calibration every 10 feedbacks (non-blocking)
    store.getCalibrationData().then(buckets => {
      if (buckets.length > 0) setCalibrationData(buckets);
    }).catch((err) => console.warn("Failed to refresh calibration data:", err));

    return { success: true, result: { recorded: true } };
  });
}
