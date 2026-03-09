import type { FastifyInstance, FastifyRequest } from "fastify";
import { getUserIdFromRequest } from "../lib/auth.js";
import type { ApiKeyService } from "../services/apiKeys.js";

function requireAuth(request: FastifyRequest): string {
  const userId = getUserIdFromRequest(request);
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
    const userId = requireAuth(request);

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
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to create API key" });
    }
  });

  app.get("/api-keys", async (request, reply) => {
    const userId = requireAuth(request);

    try {
      const keys = await apiKeyService.list(userId);
      return { success: true, result: keys };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to list API keys" });
    }
  });

  app.delete("/api-keys/:id", async (request, reply) => {
    const userId = requireAuth(request);
    const { id } = request.params as { id: string };

    try {
      const revoked = await apiKeyService.revoke(userId, id);
      if (!revoked) {
        return reply.status(404).send({ success: false, error: "Key not found" });
      }
      return { success: true };
    } catch (e: any) {
      request.log.error(e);
      return reply.status(500).send({ success: false, error: "Failed to revoke API key" });
    }
  });
}
