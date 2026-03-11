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

/** Resolve request env (simplified — reuses the same BYOK/API key logic) */
async function getRequestEnv(
  request: FastifyRequest,
  env: Env,
  apiKeyService: ApiKeyService | null,
  cache: CacheService
): Promise<{ env: Env; userId: string | null }> {
  let userId = getUserIdFromRequest(request);

  const tavilyKey = request.headers["x-tavily-key"] as string | undefined;
  const openrouterKey = request.headers["x-openrouter-key"] as string | undefined;
  if (tavilyKey || openrouterKey) {
    return {
      env: {
        ...env,
        ...(tavilyKey && { SERP_API_KEY: tavilyKey }),
        ...(openrouterKey && { OPENROUTER_API_KEY: openrouterKey }),
      },
      userId,
    };
  }

  // BrowseAI API key resolution
  if (apiKeyService) {
    const xApiKey = request.headers["x-api-key"] as string | undefined;
    const browseKey = xApiKey?.startsWith("bai_") ? xApiKey : null;
    if (browseKey) {
      const cacheKey = `bai_resolve:${browseKey.slice(0, 12)}`;
      const cached = await cache.get(cacheKey);
      const resolved = cached ? JSON.parse(cached) : await apiKeyService.resolve(browseKey);
      if (resolved && !cached) await cache.set(cacheKey, JSON.stringify(resolved), 60);
      if (resolved) {
        userId = resolved.userId;
        return {
          env: { ...env, SERP_API_KEY: resolved.tavilyKey, OPENROUTER_API_KEY: resolved.openrouterKey },
          userId,
        };
      }
      throw { statusCode: 401, message: "Invalid BrowseAI API key." };
    }
  }

  // Priority 3: Auto-resolve stored keys for signed-in users
  if (apiKeyService && userId) {
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
        userId,
      };
    }
  }

  return { env, userId };
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

  // Get session details
  app.get("/session/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const session = await sessionStore.getSession(id);
      if (!session) return reply.status(404).send({ success: false, error: "Session not found" });
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

  // Delete session
  app.delete("/session/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await sessionStore.deleteSession(id);
      return { success: true };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to delete session" });
    }
  });

  // Ask with session context — the core Research Memory endpoint
  app.post("/session/:id/ask", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = SessionAskSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.status(400).send({ success: false, error: zodMessage(parsed.error) });

    try {
      const session = await sessionStore.getSession(id);
      if (!session) return reply.status(404).send({ success: false, error: "Session not found" });

      const { env: reqEnv, userId } = await getRequestEnv(request, env, apiKeyService, cache);

      // Phase 1: Recall existing knowledge relevant to this query
      const recallStart = Date.now();
      const recalled = await sessionStore.recallKnowledge(id, parsed.data.query, 15);
      const recallMs = Date.now() - recallStart;

      // Phase 1.5: Contextualize vague queries using session knowledge
      // If query is short/vague and we have recalled claims, prepend session context
      // so the search engine understands what "this", "it", "how does it work" refers to
      let searchQuery = parsed.data.query;
      const isVague = parsed.data.query.split(/\s+/).length <= 6 &&
        /\b(this|it|that|these|those|here|there|how|why|what|explain|more|details?)\b/i.test(parsed.data.query);

      if (isVague && recalled.length > 0) {
        // Build context from session name + top recalled claims
        // Keep under 350 chars total to stay within Tavily's 400 char limit
        const topicHints = recalled
          .slice(0, 3)
          .map((r) => r.claim.split(/[.!?]/)[0]) // first sentence of each claim
          .join("; ")
          .slice(0, 250);
        searchQuery = `${parsed.data.query} (context: ${session.name} — ${topicHints})`.slice(0, 380);
      }

      // Phase 2: Run the answer pipeline with contextualized query
      const result = await answerQuery(searchQuery, reqEnv, cache, parsed.data.depth);

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

  // Export all knowledge from a session
  app.get("/session/:id/knowledge", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit } = request.query as { limit?: string };

    try {
      const session = await sessionStore.getSession(id);
      if (!session) return reply.status(404).send({ success: false, error: "Session not found" });

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

  // Share a session — creates a public share link
  app.post("/session/:id/share", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const session = await sessionStore.getSession(id);
      if (!session) return reply.status(404).send({ success: false, error: "Session not found" });

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
