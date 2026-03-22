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

const ALLOWED_ORIGINS = new Set([
  "https://browseai.dev",
  "https://www.browseai.dev",
  ...(process.env.NODE_ENV !== "production" ? ["http://localhost:8080", "http://localhost:5173", "http://localhost:3000"] : []),
]);

function setCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin || "";
  const corsOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : (ALLOWED_ORIGINS.values().next().value ?? "*");
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Tavily-Key, X-OpenRouter-Key, X-API-Key, Authorization");
  // Security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
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
      // For SSE endpoints, route through Fastify's native request handler
      // so reply.raw writes directly to the Vercel response stream.
      req.url = url;

      // CRITICAL: We must wait for the response to finish before returning,
      // otherwise Vercel terminates the serverless function immediately.
      await new Promise<void>((resolve, reject) => {
        res.on("close", resolve);
        res.on("error", reject);
        fastify.routing(req, res);
      });
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
    const errOrigin = req.headers?.origin || "";
    res.setHeader("Access-Control-Allow-Origin", errOrigin && ALLOWED_ORIGINS.has(errOrigin) ? errOrigin : (ALLOWED_ORIGINS.values().next().value ?? "*"));
    res.statusCode = 500;
    console.error("Handler error:", err);
    res.end(JSON.stringify({ success: false, error: "Internal server error" }));
  }
}
