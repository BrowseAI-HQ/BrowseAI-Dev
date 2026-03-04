import type { IncomingMessage, ServerResponse } from "http";
import { buildApp } from "../apps/api/src/app";

let app: Awaited<ReturnType<typeof buildApp>> | null = null;

async function getApp() {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  try {
    const fastify = await getApp();

    // Strip /api prefix to match Fastify route definitions
    const url = (req.url || "").replace(/^\/api/, "") || "/";

    const response = await fastify.inject({
      method: req.method as any,
      url,
      headers: req.headers as Record<string, string>,
      payload: req.body ? JSON.stringify(req.body) : undefined,
    });

    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Tavily-Key, X-OpenRouter-Key");

    if (req.method === "OPTIONS") {
      res.statusCode = 200;
      res.end();
      return;
    }

    res.statusCode = response.statusCode;
    for (const [key, value] of Object.entries(response.headers)) {
      if (value) res.setHeader(key, value as string);
    }
    res.end(response.body);
  } catch (err: any) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
}
