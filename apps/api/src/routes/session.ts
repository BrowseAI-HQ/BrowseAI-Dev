import type { FastifyInstance, FastifyRequest } from "fastify";
import { CreateSessionSchema, SessionAskSchema, RecallSchema, AnswerRequestSchema } from "@browse/shared";
import { answerQuery } from "../services/answer.js";
import { getUserIdFromRequest } from "../lib/auth.js";
import type { CacheService } from "../services/cache.js";
import type { ResultStore } from "../services/store.js";
import type { SessionStore } from "../services/session.js";
import type { ApiKeyService } from "../services/apiKeys.js";
import type { Env } from "../config/env.js";
import type { ZodError } from "zod";

function zodMessage(err: ZodError): string {
  return err.issues.map((i) => i.message).join("; ") || "Invalid request";
}

/** Free BAI key users get 50 premium queries/day before graceful fallback */
const FREE_PREMIUM_DAILY_LIMIT = 50;
const PREMIUM_WINDOW_SECONDS = 86400;

async function checkPremiumQuota(userId: string, cache: CacheService): Promise<{ exceeded: boolean; used: number; limit: number }> {
  const key = `premium_quota:${userId}`;
  const current = await cache.get(key);
  const used = current ? parseInt(current, 10) : 0;
  return { exceeded: used >= FREE_PREMIUM_DAILY_LIMIT, used, limit: FREE_PREMIUM_DAILY_LIMIT };
}

async function incrementPremiumUsage(userId: string, cache: CacheService): Promise<void> {
  const key = `premium_quota:${userId}`;
  const current = await cache.get(key);
  const count = current ? parseInt(current, 10) : 0;
  await cache.set(key, String(count + 1), PREMIUM_WINDOW_SECONDS);
}

/** Resolve request env — mirrors browse.ts getRequestEnv with tier gating + quota */
async function getRequestEnv(
  request: FastifyRequest,
  env: Env,
  apiKeyService: ApiKeyService | null,
  cache: CacheService
): Promise<{ env: Env; userId: string | null; premiumActive: boolean }> {
  let userId = await getUserIdFromRequest(request);

  // Priority 1: BrowseAI Dev API key resolution
  if (apiKeyService) {
    const xApiKey = request.headers["x-api-key"] as string | undefined;
    const browseKey = xApiKey?.startsWith("bai_") ? xApiKey : null;
    if (browseKey) {
      const resolved = await apiKeyService.resolve(browseKey);
      if (resolved) {
        userId = resolved.userId;
        const quota = await checkPremiumQuota(resolved.userId, cache);
        const premiumActive = !quota.exceeded;
        return {
          env: {
            ...env,
            SERP_API_KEY: resolved.tavilyKey,
            OPENROUTER_API_KEY: resolved.openrouterKey,
            ...(premiumActive ? {} : { HF_API_KEY: undefined, BRAVE_API_KEY: undefined }),
          },
          userId,
          premiumActive,
        };
      }
      throw { statusCode: 401, message: "Invalid BrowseAI Dev API key." };
    }
  }

  // Priority 2: Auto-resolve stored keys for signed-in users
  if (apiKeyService && userId) {
    try {
      const resolved = await apiKeyService.resolveByUserId(userId);

      if (resolved) {
        const quota = await checkPremiumQuota(userId, cache);
        const premiumActive = !quota.exceeded;
        return {
          env: {
            ...env,
            SERP_API_KEY: resolved.tavilyKey,
            OPENROUTER_API_KEY: resolved.openrouterKey,
            ...(premiumActive ? {} : { HF_API_KEY: undefined, BRAVE_API_KEY: undefined }),
          },
          userId,
          premiumActive,
        };
      }
    } catch (e) {
      console.warn("Auto-resolve stored keys failed for user", userId, e);
    }
  }

  // Priority 3: BYOK headers — no premium features
  const tavilyKey = request.headers["x-tavily-key"] as string | undefined;
  const openrouterKey = request.headers["x-openrouter-key"] as string | undefined;
  if (tavilyKey || openrouterKey) {
    return {
      env: {
        ...env,
        ...(tavilyKey && { SERP_API_KEY: tavilyKey }),
        ...(openrouterKey && { OPENROUTER_API_KEY: openrouterKey }),
        HF_API_KEY: undefined,
        BRAVE_API_KEY: undefined,
      },
      userId,
      premiumActive: false,
    };
  }

  // Priority 4: Demo — no premium features
  return {
    env: { ...env, HF_API_KEY: undefined, BRAVE_API_KEY: undefined },
    userId,
    premiumActive: false,
  };
}

export function registerSessionRoutes(
  app: FastifyInstance,
  env: Env,
  cache: CacheService,
  store: ResultStore,
  sessionStore: SessionStore,
  apiKeyService: ApiKeyService | null = null
) {
  // Create a new session
  app.post("/session", async (request, reply) => {
    const parsed = CreateSessionSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send({ success: false, error: zodMessage(parsed.error) });

    try {
      const { userId } = await getRequestEnv(request, env, apiKeyService, cache);
      const session = await sessionStore.createSession(parsed.data.name, userId || undefined);
      return { success: true, result: session };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(e.statusCode || 500).send({ success: false, error: e.message || "Failed to create session" });
    }
  });

  // Get session details (owner only — use /session/share/:shareId for public access)
  app.get("/session/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const { userId } = await getRequestEnv(request, env, apiKeyService, cache);
      const session = await sessionStore.getSession(id);
      if (!session) return reply.status(404).send({ success: false, error: "Session not found" });
      if (session.userId && session.userId !== userId) {
        return reply.status(403).send({ success: false, error: "Not authorized to access this session" });
      }
      return { success: true, result: session };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to get session" });
    }
  });

  // List user's sessions
  app.get("/sessions", async (request, reply) => {
    try {
      const { userId } = await getRequestEnv(request, env, apiKeyService, cache);
      if (!userId) return reply.status(401).send({ success: false, error: "Authentication required" });
      const sessions = await sessionStore.listSessions(userId);
      return { success: true, result: sessions };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to list sessions" });
    }
  });

  // Delete session (owner only)
  app.delete("/session/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const { userId } = await getRequestEnv(request, env, apiKeyService, cache);
      if (!userId) return reply.status(401).send({ success: false, error: "Authentication required" });
      const session = await sessionStore.getSession(id);
      if (!session) return reply.status(404).send({ success: false, error: "Session not found" });
      if (session.userId && session.userId !== userId) {
        return reply.status(403).send({ success: false, error: "Not authorized to delete this session" });
      }
      await sessionStore.deleteSession(id);
      return { success: true };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to delete session" });
    }
  });

  // Ask with session context — the core Research Memory endpoint (owner only)
  app.post("/session/:id/ask", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = SessionAskSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send({ success: false, error: zodMessage(parsed.error) });

    try {
      const { env: reqEnv, userId, premiumActive } = await getRequestEnv(request, env, apiKeyService, cache);

      const session = await sessionStore.getSession(id);
      if (!session) return reply.status(404).send({ success: false, error: "Session not found" });
      if (session.userId && session.userId !== userId) {
        return reply.status(403).send({ success: false, error: "Not authorized to access this session" });
      }

      // Phase 1: Recall existing knowledge relevant to this query
      const recallStart = Date.now();
      const recalled = await sessionStore.recallKnowledge(id, parsed.data.query, 15);
      const recallMs = Date.now() - recallStart;

      // Phase 1.5: Build session context from recalled knowledge
      // Always pass session context to the LLM so it understands references like
      // "it", "the best", "compare this" etc. No hardcoded detection needed —
      // the LLM handles coreference resolution naturally when given context.
      let searchQuery = parsed.data.query;
      let sessionContext = "";
      if (recalled.length > 0) {
        const topicHints = recalled
          .slice(0, 5)
          .map((r) => r.claim.split(/[.!?]/)[0]) // first sentence of each claim
          .join("; ")
          .slice(0, 400);
        sessionContext = `Session "${session.name}": ${topicHints}`;

        // Also contextualize the search query for Tavily — short queries
        // without obvious topic keywords benefit from session context
        const queryWords = parsed.data.query.split(/\s+/).length;
        if (queryWords <= 12) {
          searchQuery = `${parsed.data.query} (context: ${session.name} — ${topicHints.slice(0, 200)})`.slice(0, 380);
        }
      }

      // Phase 2: Run the answer pipeline with contextualized query + session context for LLM
      const result = await answerQuery(searchQuery, reqEnv, cache, parsed.data.depth, sessionContext || undefined);

      // Inject recall + contextualize trace steps at the beginning
      const cacheHitIdx = result.trace.findIndex((t) => t.step === "Cache Hit");
      const insertIdx = cacheHitIdx >= 0 ? cacheHitIdx + 1 : 0;
      const traceSteps = [
        {
          step: "Recall Knowledge",
          duration_ms: recallMs,
          detail: `${recalled.length} prior claims from session "${session.name}"`,
        },
      ];
      if (searchQuery !== parsed.data.query) {
        traceSteps.push({
          step: "Contextualize Query",
          duration_ms: 0,
          detail: `"${parsed.data.query}" → "${searchQuery.slice(0, 100)}"`,
        });
      }
      result.trace.splice(insertIdx, 0, ...traceSteps);

      // Phase 3: Store new claims into session knowledge (fire-and-forget)
      const newClaims = result.claims.filter(
        (c) => !recalled.some((r) => r.claim === c.claim)
      );
      sessionStore.storeKnowledge(id, newClaims, parsed.data.query).catch(() => {});
      sessionStore.touchSession(id).catch(() => {});

      // Increment premium quota counter if premium was used
      if (premiumActive && userId) {
        incrementPremiumUsage(userId, cache).catch(() => {});
      }

      // Save to main store too
      const shareId = await store.save(
        parsed.data.query, result, userId || undefined, "session-ask", { client: "session" }
      );

      return {
        success: true,
        result: {
          ...result,
          shareId,
          session: {
            id: session.id,
            name: session.name,
            recalledClaims: recalled.length,
            newClaimsStored: newClaims.length,
          },
        },
      };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(e.statusCode || 500).send({ success: false, error: e.message || "Session ask failed" });
    }
  });

  // Recall — query session knowledge without new web search
  app.post("/session/:id/recall", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = RecallSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send({ success: false, error: zodMessage(parsed.error) });

    try {
      const session = await sessionStore.getSession(id);
      if (!session) return reply.status(404).send({ success: false, error: "Session not found" });

      const entries = await sessionStore.recallKnowledge(id, parsed.data.query, parsed.data.limit);
      return {
        success: true,
        result: {
          session: { id: session.id, name: session.name },
          entries,
          count: entries.length,
        },
      };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Recall failed" });
    }
  });

  // Export all knowledge from a session (owner only — use /session/share/:shareId for public)
  app.get("/session/:id/knowledge", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit } = request.query as { limit?: string };

    try {
      const { userId } = await getRequestEnv(request, env, apiKeyService, cache);
      const session = await sessionStore.getSession(id);
      if (!session) return reply.status(404).send({ success: false, error: "Session not found" });
      if (session.userId && session.userId !== userId) {
        return reply.status(403).send({ success: false, error: "Not authorized to access this session" });
      }

      const entries = await sessionStore.getKnowledge(id, limit ? parseInt(limit) : 50);
      return {
        success: true,
        result: {
          session: { id: session.id, name: session.name },
          entries,
          count: entries.length,
        },
      };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to export knowledge" });
    }
  });

  // Share a session — creates a public share link (owner only)
  app.post("/session/:id/share", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const { userId } = await getRequestEnv(request, env, apiKeyService, cache);
      if (!userId) return reply.status(401).send({ success: false, error: "Authentication required" });
      const session = await sessionStore.getSession(id);
      if (!session) return reply.status(404).send({ success: false, error: "Session not found" });
      if (session.userId && session.userId !== userId) {
        return reply.status(403).send({ success: false, error: "Not authorized to share this session" });
      }

      const shareId = await sessionStore.shareSession(id);
      return { success: true, result: { shareId } };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to share session" });
    }
  });

  // Public: view a shared session (no auth required)
  app.get("/session/share/:shareId", async (request, reply) => {
    const { shareId } = request.params as { shareId: string };
    try {
      const data = await sessionStore.getSharedSession(shareId);
      if (!data) return reply.status(404).send({ success: false, error: "Shared session not found" });
      return { success: true, result: data };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to load shared session" });
    }
  });

  // Fork a shared session — creates a copy under the authenticated user
  app.post("/session/share/:shareId/fork", async (request, reply) => {
    const { shareId } = request.params as { shareId: string };
    try {
      const { userId } = await getRequestEnv(request, env, apiKeyService, cache);
      if (!userId) return reply.status(401).send({ success: false, error: "Sign in to fork a research session" });

      const shared = await sessionStore.getSharedSession(shareId);
      if (!shared) return reply.status(404).send({ success: false, error: "Shared session not found" });

      // Create new session
      const newSession = await sessionStore.createSession(
        `Fork: ${shared.session.name}`,
        userId
      );

      // Copy knowledge entries
      if (shared.entries.length > 0) {
        const claims = shared.entries.map((e) => ({
          claim: e.claim,
          sources: e.sources,
          verified: e.verified,
          verificationScore: e.confidence,
        }));
        await sessionStore.storeKnowledge(newSession.id, claims as any, "forked from shared session");
      }

      return {
        success: true,
        result: {
          session: newSession,
          claimsForked: shared.entries.length,
        },
      };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(e.statusCode || 500).send({ success: false, error: e.message || "Failed to fork session" });
    }
  });
}
