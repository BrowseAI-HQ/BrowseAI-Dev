import type { IncomingMessage, ServerResponse } from "http";
import { buildApp } from "../apps/api/src/app.js";

let app: Awaited<ReturnType<typeof buildApp>> | null = null;

async function getApp() {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const fastify = await getApp();

    // Strip /api prefix to match Fastify route definitions
    const url = (req.url || "").replace(/^\/api/, "") || "/";

    // Read raw body from stream
    const body = await readBody(req);

    // Forward headers but remove content-length (Fastify recalculates)
    const headers = { ...req.headers } as Record<string, string>;
    delete headers["content-length"];
    delete headers["transfer-encoding"];

    const response = await fastify.inject({
      method: req.method as any,
      url,
      headers,
      payload: body || undefined,
    });

    // Set CORS headers — allow same-origin and configured origins
    const origin = req.headers.origin || "";
    const corsOrigin = origin || process.env.CORS_ORIGIN || "*";
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Tavily-Key, X-OpenRouter-Key, X-API-Key, Authorization");

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
    res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
    res.statusCode = 500;
    console.error("Handler error:", err);
    res.end(JSON.stringify({ success: false, error: "Internal server error" }));
  }
}
