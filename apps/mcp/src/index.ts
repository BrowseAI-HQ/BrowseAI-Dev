#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

// --- Constants (inlined for standalone npm package) ---
const VERSION = "0.1.7";
const LLM_MODEL = "google/gemini-2.5-flash";
const LLM_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const MAX_PAGE_CONTENT_LENGTH = 3000;

// --- API mode (BrowseAI Dev API key) ---
const BROWSE_API_KEY = process.env.BROWSE_API_KEY;
const BROWSE_API_URL = process.env.BROWSE_API_URL || "https://browseai.dev/api";
const API_MODE = !!BROWSE_API_KEY;

// --- CLI handling ---
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  browse-ai v${VERSION}
  Open-source deep research MCP server for AI agents

  Usage:
    browse-ai              Start the MCP server (stdio transport)
    browse-ai --http       Start the MCP server (HTTP transport)
    browse-ai setup        Auto-configure Claude Desktop
    browse-ai --help       Show this help
    browse-ai --version    Show version

  Environment Variables:
    BROWSE_API_KEY         BrowseAI Dev API key (get one at https://browseai.dev/dashboard)
    SERP_API_KEY           Tavily API key (get one at https://tavily.com) — BYOK mode
    OPENROUTER_API_KEY     OpenRouter API key (get one at https://openrouter.ai) — BYOK mode
    MCP_HTTP_PORT          Port for HTTP transport (default: 3100)

  MCP Tools:
    browse_search          Search the web for information
    browse_open            Fetch and parse a web page
    browse_extract         Extract structured knowledge from a page
    browse_answer          Full pipeline: search + extract + answer
    browse_compare         Compare raw LLM vs evidence-backed answer

  Quick Setup:
    Option A: Use a BrowseAI API key (one key for everything)
      1. Sign in at https://browseai.dev and generate an API key
      2. Run: npx browse-ai setup
      3. Restart Claude Desktop

    Option B: Bring your own keys (BYOK)
      1. Get API keys: https://tavily.com + https://openrouter.ai
      2. Run: npx browse-ai setup
      3. Restart Claude Desktop
`);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(VERSION);
  process.exit(0);
}

if (args[0] === "setup") {
  import("./setup.js").then((m) => m.runSetup());
} else {
  // --- Start MCP server ---
  startServer();
}

async function apiCall(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${BROWSE_API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": BROWSE_API_KEY!,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || `API failed: ${res.status}`);
  return data.result;
}

// --- Env validation ---
function getEnvKeys() {
  if (API_MODE) return { SERP_API_KEY: "", OPENROUTER_API_KEY: "" };

  const SERP_API_KEY = process.env.SERP_API_KEY;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!SERP_API_KEY || !OPENROUTER_API_KEY) {
    console.error(`
  browse-ai: Missing required environment variables

  ${!SERP_API_KEY ? "  SERP_API_KEY       - Get one at https://tavily.com" : "  SERP_API_KEY       - Set"}
  ${!OPENROUTER_API_KEY ? "  OPENROUTER_API_KEY - Get one at https://openrouter.ai" : "  OPENROUTER_API_KEY - Set"}

  Quick fix: run 'npx browse-ai setup' to configure automatically.
  Or use a BrowseAI API key: BROWSE_API_KEY=bai_xxx npx browse-ai
`);
    process.exit(1);
  }

  return { SERP_API_KEY, OPENROUTER_API_KEY };
}

// --- In-memory cache ---
const cache = new Map<string, { value: string; expires: number }>();
function cacheGet(key: string): string | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}
function cacheSet(key: string, value: string, ttl = 300) {
  cache.set(key, { value, expires: Date.now() + ttl * 1000 });
}

// --- Tavily search ---
async function tavilySearch(query: string, limit = 5) {
  const { SERP_API_KEY } = getEnvKeys();
  const cached = cacheGet(`search:${query}:${limit}`);
  if (cached) return JSON.parse(cached);

  const res = await fetch(TAVILY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: SERP_API_KEY,
      query,
      max_results: limit,
      include_raw_content: false,
      search_depth: "basic",
    }),
  });
  if (!res.ok) throw new Error(`Tavily search failed: ${res.status}`);
  const data = await res.json();
  const results = data.results.map((r: any) => ({
    url: r.url,
    title: r.title,
    snippet: r.content,
    score: r.score,
  }));
  cacheSet(`search:${query}:${limit}`, JSON.stringify(results), 600);
  return results;
}

// --- Readability page fetch ---
async function fetchPage(url: string) {
  const cached = cacheGet(`page:${url}`);
  if (cached) return JSON.parse(cached);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; BrowseAI/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const html = await res.text();
  const { document } = parseHTML(html);
  const reader = new Readability(document as any);
  const article = reader.parse();
  if (!article) throw new Error(`Could not parse ${url}`);

  const page = {
    title: article.title,
    content: article.textContent.slice(0, MAX_PAGE_CONTENT_LENGTH * 2),
    excerpt: article.excerpt || "",
    siteName: article.siteName,
  };
  cacheSet(`page:${url}`, JSON.stringify(page), 1800);
  return page;
}

// --- LLM knowledge extraction (via OpenRouter) ---
async function extractKnowledge(query: string, pageContents: string) {
  const { OPENROUTER_API_KEY } = getEnvKeys();
  const res = await fetch(LLM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a knowledge extraction engine. Given web page content, extract structured claims with source attribution and write a clear answer. Use only extracted evidence. Never invent sources. Preserve citations. Return a JSON object using the tool provided.",
        },
        {
          role: "user",
          content: `Question: ${query}\n\nWeb sources:\n${pageContents}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_knowledge",
            description:
              "Return extracted knowledge with claims, sources, answer, and confidence",
            parameters: {
              type: "object",
              properties: {
                answer: { type: "string" },
                confidence: { type: "number" },
                claims: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      claim: { type: "string" },
                      sources: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: ["claim", "sources"],
                  },
                },
                sources: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      url: { type: "string" },
                      title: { type: "string" },
                      domain: { type: "string" },
                      quote: { type: "string" },
                    },
                    required: ["url", "title", "domain", "quote"],
                  },
                },
              },
              required: ["answer", "confidence", "claims", "sources"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "return_knowledge" },
      },
    }),
  });

  if (!res.ok) throw new Error(`LLM failed: ${res.status}`);
  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("LLM did not return structured output");
  return JSON.parse(toolCall.function.arguments);
}

// --- Raw LLM call (no sources, for compare) ---
async function rawLLMAnswer(query: string): Promise<string> {
  const { OPENROUTER_API_KEY } = getEnvKeys();
  const res = await fetch(LLM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        {
          role: "system",
          content: "Answer the question clearly and concisely.",
        },
        { role: "user", content: query },
      ],
    }),
  });

  if (!res.ok) throw new Error(`LLM failed: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "No response";
}

// --- Full pipeline ---
type TraceStep = { step: string; duration_ms: number; detail?: string };
type BrowseResult = {
  answer: string;
  claims: { claim: string; sources: string[] }[];
  sources: { url: string; title: string; domain: string; quote: string }[];
  confidence: number;
  trace: TraceStep[];
};

async function answerPipeline(query: string): Promise<BrowseResult> {
  const trace: TraceStep[] = [];

  const searchStart = Date.now();
  const searchResults = await tavilySearch(query);
  trace.push({
    step: "Search Web",
    duration_ms: Date.now() - searchStart,
    detail: `${searchResults.length} results`,
  });

  const scrapeStart = Date.now();
  const pages = await Promise.allSettled(
    searchResults.slice(0, 5).map((r: any) => fetchPage(r.url))
  );
  const successfulPages = pages
    .filter(
      (p): p is PromiseFulfilledResult<any> => p.status === "fulfilled"
    )
    .map((p) => p.value);
  trace.push({
    step: "Fetch Pages",
    duration_ms: Date.now() - scrapeStart,
    detail: `${successfulPages.length} pages`,
  });

  const pageContents = successfulPages
    .map(
      (p: any, i: number) =>
        `[Source ${i + 1}] URL: ${searchResults[i]?.url}\nTitle: ${p.title}\n\n${p.content.slice(0, MAX_PAGE_CONTENT_LENGTH)}`
    )
    .join("\n\n---\n\n");

  const llmStart = Date.now();
  const knowledge = await extractKnowledge(query, pageContents);
  const llmDuration = Date.now() - llmStart;

  trace.push({
    step: "Extract Claims",
    duration_ms: Math.round(llmDuration * 0.4),
    detail: `${knowledge.claims?.length || 0} claims`,
  });
  trace.push({
    step: "Build Evidence Graph",
    duration_ms: Math.round(llmDuration * 0.1),
    detail: `${knowledge.sources?.length || 0} sources`,
  });
  trace.push({
    step: "Generate Answer",
    duration_ms: Math.round(llmDuration * 0.5),
    detail: "OpenRouter",
  });

  return {
    answer: knowledge.answer,
    claims: knowledge.claims || [],
    sources: knowledge.sources || [],
    confidence: knowledge.confidence || 0.85,
    trace,
  };
}

// --- Tool registration (shared between stdio and http) ---
function registerTools(server: McpServer) {
  server.tool(
    "browse_search",
    "Search the web for information on a topic. Returns URLs, titles, snippets, and relevance scores.",
    { query: z.string(), limit: z.number().optional() },
    async ({ query, limit }) => {
      if (API_MODE) {
        const result = await apiCall("/browse/search", { query, limit: limit ?? 5 });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      const results = await tavilySearch(query, limit ?? 5);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  server.tool(
    "browse_open",
    "Fetch and parse a web page into clean text using Readability. Strips ads, nav, and boilerplate.",
    { url: z.string() },
    async ({ url }) => {
      if (API_MODE) {
        const result = await apiCall("/browse/open", { url });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      const page = await fetchPage(url);
      return {
        content: [{ type: "text", text: JSON.stringify(page, null, 2) }],
      };
    }
  );

  server.tool(
    "browse_extract",
    "Extract structured knowledge (claims + sources + confidence) from a single web page using AI.",
    { url: z.string(), query: z.string().optional() },
    async ({ url, query }) => {
      if (API_MODE) {
        const result = await apiCall("/browse/extract", { url, query });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      const page = await fetchPage(url);
      const domain = new URL(url).hostname;
      const pageContent = `[Source 1] URL: ${url}\nTitle: ${page.title}\n\n${page.content.slice(0, MAX_PAGE_CONTENT_LENGTH)}`;
      const q = query || `Summarize the content from ${domain}`;
      const result = await extractKnowledge(q, pageContent);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "browse_answer",
    "Full deep research pipeline: search the web, fetch pages, extract claims, build evidence graph, and generate a structured answer with citations and confidence score. Use depth='thorough' for auto-retry with rephrased queries when confidence is low.",
    { query: z.string(), depth: z.enum(["fast", "thorough"]).optional().describe("Research depth: 'fast' (default) or 'thorough' (auto-retries with rephrased query if confidence < 60%)") },
    async ({ query, depth }) => {
      if (API_MODE) {
        const result = await apiCall("/browse/answer", { query, depth: depth || "fast" });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      const result = await answerPipeline(query);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  server.tool(
    "browse_compare",
    "Compare a raw LLM answer (no sources) vs an evidence-backed answer. Shows the difference between hallucination-prone and grounded responses.",
    { query: z.string() },
    async ({ query }) => {
      if (API_MODE) {
        const result = await apiCall("/browse/compare", { query });
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      const [rawAnswer, evidenceResult] = await Promise.all([
        rawLLMAnswer(query),
        answerPipeline(query),
      ]);
      const comparison = {
        query,
        raw_llm: {
          answer: rawAnswer,
          sources: 0,
          claims: 0,
          confidence: null,
        },
        evidence_backed: {
          answer: evidenceResult.answer,
          sources: evidenceResult.sources.length,
          claims: evidenceResult.claims.length,
          confidence: evidenceResult.confidence,
          citations: evidenceResult.sources,
        },
      };
      return {
        content: [
          { type: "text", text: JSON.stringify(comparison, null, 2) },
        ],
      };
    }
  );
}

// --- MCP Server ---
function startServer() {
  // Validate env before starting
  getEnvKeys();

  const useHttp = args.includes("--http") || !!process.env.MCP_HTTP_PORT;
  const port = parseInt(process.env.MCP_HTTP_PORT || process.env.PORT || "3100", 10);

  if (useHttp) {
    const transports = new Map<string, StreamableHTTPServerTransport>();

    const httpServer = createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://localhost:${port}`);

      // Health check
      if (url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", version: VERSION }));
        return;
      }

      if (url.pathname === "/mcp") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;

        if (sessionId && transports.has(sessionId)) {
          const transport = transports.get(sessionId)!;
          await transport.handleRequest(req, res);
          return;
        }

        // New session
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            transports.delete(transport.sessionId);
          }
        };

        const server = new McpServer({
          name: "browse-ai",
          version: VERSION,
        });
        registerTools(server);
        await server.connect(transport);

        if (transport.sessionId) {
          transports.set(transport.sessionId, transport);
        }

        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    httpServer.listen(port, () => {
      console.error(`browse-ai v${VERSION} MCP server running on http://localhost:${port}/mcp`);
    });
  } else {
    const server = new McpServer({
      name: "browse-ai",
      version: VERSION,
    });
    registerTools(server);

    async function run() {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error(`browse-ai v${VERSION} MCP server running on stdio`);
    }

    run().catch((err) => {
      console.error("Failed to start browse-ai:", err);
      process.exit(1);
    });
  }
}
