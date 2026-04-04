#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

// --- Constants (inlined for standalone npm package) ---
const VERSION = "0.3.2";

// --- BrowseAI Dev API key (required) ---
const BROWSE_API_KEY = process.env.BROWSE_API_KEY;
const BROWSE_API_URL = process.env.BROWSE_API_URL || "https://browseai.dev/api";

// --- CLI handling ---
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  browseai-dev v${VERSION}
  Open-source deep research MCP server for AI agents

  Usage:
    browseai-dev              Start the MCP server (stdio transport)
    browseai-dev --http       Start the MCP server (HTTP transport)
    browseai-dev setup        Auto-configure Claude Desktop
    browseai-dev --help       Show this help
    browseai-dev --version    Show version

  Environment Variables:
    BROWSE_API_KEY         BrowseAI Dev API key (required — sign in at https://browseai.dev)
    MCP_HTTP_PORT          Port for HTTP transport (default: 3100)

  MCP Tools:
    browse_search          Search the web for information
    browse_open            Fetch and parse a web page
    browse_extract         Extract structured knowledge from a page
    browse_answer          Full pipeline: search + extract + answer
    browse_compare         Compare raw LLM vs evidence-backed answer
    browse_clarity         Clarity: anti-hallucination answer engine (fast LLM or verified with web fusion)
    browse_session_create  Create a research session (persistent memory)
    browse_session_ask     Research within a session (recalls prior knowledge)
    browse_session_recall  Query session knowledge without new searches
    browse_session_share   Share a session publicly via URL
    browse_session_knowledge  Export all knowledge from a session

  Quick Setup:
    1. Sign in at https://browseai.dev and generate a free API key
    2. Run: npx browseai-dev setup
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
  // Include quota info in result if present
  if (data.quota) {
    return { ...data.result, _quota: data.quota };
  }
  return data.result;
}

// --- Env validation ---
function validateEnv() {
  if (!BROWSE_API_KEY) {
    console.error(`
  browseai-dev: Missing BROWSE_API_KEY

  A BrowseAI Dev API key is required. Sign in and get your free key at https://browseai.dev

  Quick fix: run 'npx browseai-dev setup' to configure automatically.
`);
    process.exit(1);
  }
}

// --- Tool registration (shared between stdio and http) ---
function registerTools(server: McpServer) {
  server.tool(
    "browse_search",
    "Search the web for information on a topic. Returns URLs, titles, snippets, and relevance scores.",
    { query: z.string(), limit: z.number().optional() },
    async ({ query, limit }) => {
      const result = await apiCall("/browse/search", { query, limit: limit ?? 5 });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "browse_open",
    "Fetch and parse a web page into clean text using Readability. Strips ads, nav, and boilerplate.",
    { url: z.string() },
    async ({ url }) => {
      const result = await apiCall("/browse/open", { url });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "browse_extract",
    "Extract structured knowledge (claims + sources + confidence) from a single web page using AI.",
    { url: z.string(), query: z.string().optional() },
    async ({ url, query }) => {
      const result = await apiCall("/browse/extract", { url, query });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "browse_answer",
    "Full deep research pipeline: search the web, fetch pages, extract claims, build evidence graph, and generate a structured answer with citations and confidence score. Use depth='thorough' for auto-retry with rephrased queries when confidence is low. Use depth='deep' for multi-step agentic research that identifies knowledge gaps and runs follow-up searches. Enterprise: use searchProvider to search internal data instead of the public web. DISCLAIMER: Results are AI-generated for informational purposes only — not financial, medical, or legal advice. Confidence scores are algorithmic estimates, not accuracy guarantees. Always verify critical information from primary sources.",
    {
      query: z.string(),
      depth: z.enum(["fast", "thorough", "deep"]).optional().describe("Research depth: 'fast' (default), 'thorough' (auto-retry if confidence < 60%), or 'deep' (multi-step agentic research with gap analysis)"),
      searchProvider: z.object({
        type: z.enum(["tavily", "brave", "elasticsearch", "confluence", "custom"]).describe("Search backend type"),
        endpoint: z.string().optional().describe("Endpoint URL (required for elasticsearch, confluence, custom)"),
        authHeader: z.string().optional().describe("Auth header value (e.g. 'Bearer xxx')"),
        index: z.string().optional().describe("Elasticsearch index name"),
        spaceKey: z.string().optional().describe("Confluence space key"),
        dataRetention: z.enum(["normal", "none"]).optional().describe("'none' skips all caching/storage (enterprise)"),
      }).optional().describe("Enterprise: configure a custom search backend instead of public web search"),
    },
    async ({ query, depth, searchProvider }) => {
      const body: Record<string, unknown> = { query, depth: depth || "fast" };
      if (searchProvider) body.searchProvider = searchProvider;
      const result = await apiCall("/browse/answer", body);
      const content: Array<{ type: "text"; text: string }> = [
        { type: "text", text: JSON.stringify(result, null, 2) },
      ];
      // Surface quota info so agents can inform users about premium status
      if (result._quota) {
        const q = result._quota;
        const status = q.premiumActive
          ? `Premium active (${q.used}/${q.limit} queries used today)`
          : `Premium quota exceeded (${q.used}/${q.limit}). Results use standard verification. Upgrade or wait 24h for reset.`;
        content.push({ type: "text", text: `\n---\nQuota: ${status}` });
      }
      content.push({ type: "text", text: `\n---\nDisclaimer: AI-generated research for informational purposes only. Not financial, medical, or legal advice. Verify critical information from primary sources.` });
      return { content };
    }
  );

  server.tool(
    "browse_compare",
    "Compare a raw LLM answer (no sources) vs an evidence-backed answer. Shows the difference between hallucination-prone and grounded responses.",
    { query: z.string() },
    async ({ query }) => {
      const result = await apiCall("/browse/compare", { query });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
  // --- Clarity — Anti-Hallucination Answer Engine ---

  server.tool(
    "browse_clarity",
    "Clarity — anti-hallucination answer engine. Three modes: (1) mode='prompt': Returns only enhanced system + user prompts with anti-hallucination techniques. No LLM call, no internet. Use this when you want YOUR OWN LLM (e.g. Claude) to answer using the enhanced prompts. (2) mode='answer' (default): Rewrites prompt, calls LLM with grounding instructions, returns answer with extracted claims. Fast, no internet. (3) mode='verified': Does #2, then runs full browse pipeline (search + extract + verify), fuses best of both — source-backed claims, evidence-based confidence. Use for maximum accuracy.",
    {
      prompt: z.string().describe("The prompt to answer with anti-hallucination techniques"),
      context: z.string().optional().describe("Optional context documents to ground against"),
      intent: z.enum(["factual_question", "document_qa", "content_generation", "agent_pipeline", "code_generation", "general"]).optional().describe("Override auto-detected intent"),
      mode: z.enum(["prompt", "answer", "verified"]).optional().describe("'prompt' = returns enhanced prompts only (no LLM call), 'answer' = LLM answer with anti-hallucination (default), 'verified' = LLM + web fusion for maximum accuracy"),
      verify: z.boolean().optional().describe("Deprecated: use mode instead. verify=true is equivalent to mode='verified'"),
    },
    async ({ prompt, context, intent, mode, verify }) => {
      const body: Record<string, unknown> = { prompt };
      if (context) body.context = context;
      if (intent) body.intent = intent;
      if (mode) body.mode = mode;
      if (verify && !mode) body.verify = verify;
      const result = await apiCall("/browse/clarity", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- Research Memory tools (API mode only — sessions require Supabase) ---

  server.tool(
    "browse_session_create",
    "Create a new research session. Sessions persist knowledge across multiple queries — each query builds on prior research.",
    { name: z.string().describe("Name for the session (e.g. 'wasm-research', 'react-comparison')") },
    async ({ name }) => {
      const result = await apiCall("/session", { name });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "browse_session_ask",
    "Research a question within a session. Recalls prior knowledge, runs the research pipeline, and stores new claims. Later queries in the same session benefit from accumulated knowledge.",
    {
      session_id: z.string().describe("Session ID from browse_session_create"),
      query: z.string(),
      depth: z.enum(["fast", "thorough", "deep"]).optional().describe("'fast' (default), 'thorough', or 'deep' (multi-step agentic)"),
    },
    async ({ session_id, query, depth }) => {
      const result = await apiCall(`/session/${session_id}/ask`, { query, depth: depth || "fast" });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "browse_session_recall",
    "Query accumulated knowledge from a session without making new web searches. Returns previously verified claims relevant to the query.",
    {
      session_id: z.string().describe("Session ID"),
      query: z.string().describe("What to recall from session knowledge"),
      limit: z.number().optional().describe("Max entries to return (default 10)"),
    },
    async ({ session_id, query, limit }) => {
      const result = await apiCall(`/session/${session_id}/recall`, { query, limit: limit ?? 10 });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "browse_session_share",
    "Share a research session publicly. Returns a shareable URL that anyone can view — great for sharing research findings with teammates, in reports, or on social media.",
    {
      session_id: z.string().describe("Session ID to share"),
    },
    async ({ session_id }) => {
      const result = await apiCall(`/session/${session_id}/share`, {});
      const shareUrl = `https://browseai.dev/session/share/${result.shareId}`;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ shareId: result.shareId, url: shareUrl, message: "Session shared! Anyone with this link can view the research." }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "browse_session_knowledge",
    "Export all knowledge from a research session. Returns all verified claims, sources, and confidence scores accumulated across queries.",
    {
      session_id: z.string().describe("Session ID"),
      limit: z.number().optional().describe("Max entries to return (default 50)"),
    },
    async ({ session_id, limit }) => {
      const res = await fetch(`${BROWSE_API_URL}/session/${session_id}/knowledge?limit=${limit ?? 50}`, {
        headers: { "X-API-Key": BROWSE_API_KEY! },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to export knowledge");
      return { content: [{ type: "text", text: JSON.stringify(data.result, null, 2) }] };
    }
  );

  server.tool(
    "browse_session_fork",
    "Fork a shared research session to continue building on someone else's research. Creates a copy of all knowledge in your own session.",
    {
      share_id: z.string().describe("Share ID from a shared session URL"),
    },
    async ({ share_id }) => {
      const result = await apiCall(`/session/share/${share_id}/fork`, {});
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            sessionId: result.session.id,
            name: result.session.name,
            claimsForked: result.claimsForked,
            message: "Session forked! You can now continue researching with all the prior knowledge.",
          }, null, 2),
        }],
      };
    }
  );

  // --- Feedback Tool ---
  server.tool(
    "browse_feedback",
    "Submit feedback on a search result to improve future accuracy. Helps the self-learning engine tune verification thresholds.",
    {
      result_id: z.string().describe("The shareId/resultId from a previous search result"),
      rating: z.enum(["good", "bad", "wrong"]).describe("Rate the result: 'good' (accurate), 'bad' (not helpful), or 'wrong' (factually incorrect)"),
      claim_index: z.number().int().min(0).optional().describe("Optional: index of the specific claim that was wrong"),
    },
    async ({ result_id, rating, claim_index }) => {
      const body: Record<string, unknown> = { resultId: result_id, rating };
      if (claim_index !== undefined) body.claimIndex = claim_index;
      const result = await apiCall("/browse/feedback", body);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ recorded: true, message: "Feedback recorded. This helps improve future search accuracy." }, null, 2),
        }],
      };
    }
  );
}

// --- MCP Server ---
function startServer() {
  // Validate env before starting
  validateEnv();

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
          name: "browseai-dev",
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
      console.error(`browseai-dev v${VERSION} MCP server running on http://localhost:${port}/mcp`);
    });
  } else {
    const server = new McpServer({
      name: "browseai-dev",
      version: VERSION,
    });
    registerTools(server);

    async function run() {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error(`browseai-dev v${VERSION} MCP server running on stdio`);
    }

    run().catch((err) => {
      console.error("Failed to start browseai-dev:", err);
      process.exit(1);
    });
  }
}
