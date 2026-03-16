import type { FastifyInstance, FastifyRequest } from "fastify";
import { getUserIdFromRequest } from "../lib/auth.js";
import { validateTavilyKey } from "../lib/tavily.js";
import type { ApiKeyService } from "../services/apiKeys.js";

async function requireAuth(request: FastifyRequest): Promise<string> {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    throw { statusCode: 401, message: "Authentication required" };
  }
  return userId;
}

export function registerApiKeyRoutes(
  app: FastifyInstance,
  apiKeyService: ApiKeyService
) {
  app.post("/api-keys", async (request, reply) => {
    const userId = await requireAuth(request);

    const body = request.body as {
      tavily_key?: string;
      openrouter_key?: string;
      label?: string;
    };

    if (!body?.tavily_key || !body?.openrouter_key) {
      return reply.status(400).send({
        success: false,
        error: "tavily_key and openrouter_key are required",
      });
    }

    // Validate Tavily key before storing — fail fast on bad keys
    const tavilyValidation = await validateTavilyKey(body.tavily_key);
    if (!tavilyValidation.valid) {
      return reply.status(400).send({
        success: false,
        error: `Invalid Tavily key: ${tavilyValidation.error}`,
      });
    }

    try {
      const result = await apiKeyService.create(
        userId,
        body.tavily_key,
        body.openrouter_key,
        body.label
      );
      return {
        success: true,
        result: {
          apiKey: result.apiKey,
          ...result.record,
        },
      };
    } catch (e: unknown) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to create API key" });
    }
  });

  app.get("/api-keys", async (request, reply) => {
    const userId = await requireAuth(request);

    try {
      const keys = await apiKeyService.list(userId);
      return { success: true, result: keys };
    } catch (e: unknown) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to list API keys" });
    }
  });

  app.delete("/api-keys/:id", async (request, reply) => {
    const userId = await requireAuth(request);
    const { id } = request.params as { id: string };

    try {
      // Check how many active keys the user has
      const activeCount = await apiKeyService.countActive(userId);

      const revoked = await apiKeyService.revoke(userId, id);
      if (!revoked) {
        return reply.status(404).send({ success: false, error: "Key not found" });
      }

      // If this was the last key, include a warning
      const isLastKey = activeCount <= 1;
      return {
        success: true,
        ...(isLastKey && {
          warning: "All API keys removed. You're now on the free demo tier (5 queries/hour). Add keys again anytime to get unlimited access.",
        }),
      };
    } catch (e: unknown) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to revoke API key" });
    }
  });
}
