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

function setCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin || "";
  const corsOrigin = origin || process.env.CORS_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Tavily-Key, X-OpenRouter-Key, X-API-Key, Authorization");
}

// Endpoints that use SSE and need real streaming (not buffered inject)
const STREAMING_PATHS = ["/browse/answer/stream"];

function isStreamingRequest(url: string): boolean {
  return STREAMING_PATHS.some((p) => url.includes(p));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const fastify = await getApp();
    const url = (req.url || "").replace(/^\/api/, "") || "/";

    setCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      res.statusCode = 200;
      res.end();
      return;
    }

    if (isStreamingRequest(url)) {
      // For SSE endpoints, route through Fastify's real server so reply.raw
      // writes directly to the Vercel response stream (not buffered).
      req.url = url;
      fastify.server.emit("request", req, res);
      return;
    }

    // Non-streaming: use inject() (buffered, fine for JSON responses)
    const body = await readBody(req);
    const headers = { ...req.headers } as Record<string, string>;
    delete headers["content-length"];
    delete headers["transfer-encoding"];

    const response = await fastify.inject({
      method: req.method as any,
      url,
      headers,
      payload: body || undefined,
    });

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
