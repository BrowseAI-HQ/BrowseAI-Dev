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
const VERSION = "0.3.0";
const LLM_MODEL = "google/gemini-2.5-flash";
const LLM_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const MAX_PAGE_CONTENT_LENGTH = 3000;

// --- API mode (BrowseAI Dev API key — required) ---
const BROWSE_API_KEY = process.env.BROWSE_API_KEY;
const BROWSE_API_URL = process.env.BROWSE_API_URL || "https://browseai.dev/api";
const API_MODE = true; // BYOK removed — BAI key always required

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
    BROWSE_API_KEY         BrowseAI Dev API key (required — get one at https://browseai.dev/dashboard)
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

  A BrowseAI Dev API key is required. Get a free one at https://browseai.dev/dashboard

  Quick fix: run 'npx browseai-dev setup' to configure automatically.
`);
    process.exit(1);
  }
}

// Legacy stub — BYOK removed, all calls go through API. Kept for dead code paths.
function getEnvKeys() {
  return { SERP_API_KEY: "", OPENROUTER_API_KEY: "" };
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
  const results = data.results.map((r: { url: string; title: string; content: string; score: number }) => ({
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
      "User-Agent": "Mozilla/5.0 (compatible; BrowseAI-Dev/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const html = await res.text();
  const { document } = parseHTML(html);
  const reader = new Readability(document as unknown as Document);
  const article = reader.parse();
  if (!article) throw new Error(`Could not parse ${url}`);

  const page = {
    title: article.title,
    content: (article.textContent ?? "").slice(0, MAX_PAGE_CONTENT_LENGTH * 2),
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
  try {
    return JSON.parse(toolCall.function.arguments);
  } catch (e) {
    throw new Error(`Failed to parse LLM tool call arguments: ${(e as Error).message}. Raw: ${toolCall.function.arguments}`, { cause: e });
  }
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
type NLIScore = {
  entailment: number;
  contradiction: number;
  neutral: number;
  label: "entailment" | "neutral" | "contradiction";
};
type Contradiction = {
  claimA: string;
  claimB: string;
  topic: string;
  nliConfidence?: number;
};
type ReasoningStep = {
  step: number;
  query: string;
  gapAnalysis: string;
  claimCount: number;
  confidence: number;
};
type BrowseResult = {
  answer: string;
  claims: {
    claim: string;
    sources: string[];
    verified?: boolean;
    verificationScore?: number;
    consensusCount?: number;
    consensusLevel?: "strong" | "moderate" | "weak" | "none";
    nliScore?: NLIScore;
  }[];
  sources: { url: string; title: string; domain: string; quote: string; verified?: boolean; authority?: number }[];
  confidence: number;
  trace: TraceStep[];
  contradictions?: Contradiction[];
  reasoningSteps?: ReasoningStep[];
  shareId?: string;
  effectiveDepth?: "fast" | "thorough" | "deep";
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
    searchResults.slice(0, 5).map((r: { url: string }) => fetchPage(r.url))
  );
  const successfulPages = pages
    .filter(
      (p): p is PromiseFulfilledResult<{ title: string; content: string }> => p.status === "fulfilled"
    )
    .map((p) => p.value);
  trace.push({
    step: "Fetch Pages",
    duration_ms: Date.now() - scrapeStart,
    detail: `${successfulPages.length} pages`,
  });

  const pageContents = successfulPages
    .map(
      (p, i) =>
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
      if (API_MODE) {
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
      const result = await answerPipeline(query);
      let text = JSON.stringify(result, null, 2);
      if (depth && depth !== "fast") {
        text += `\n\n> Note: depth="${depth}" requested but BYOK mode uses standard search depth. Use a BrowseAI API key for thorough/deep modes.`;
      }
      text += `\n\n> Disclaimer: AI-generated research for informational purposes only. Not financial, medical, or legal advice. Verify critical information from primary sources.`;
      return {
        content: [{ type: "text", text }],
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
      if (API_MODE) {
        const body: Record<string, unknown> = { prompt };
        if (context) body.context = context;
        if (intent) body.intent = intent;
        if (mode) body.mode = mode;
        if (verify && !mode) body.verify = verify;
        const result = await apiCall("/browse/clarity", body);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // BYOK mode: Analyze prompt, then optionally call LLM
      const { OPENROUTER_API_KEY } = getEnvKeys();

      // Resolve mode: explicit mode > legacy verify flag > default "answer"
      const resolvedMode = mode ?? (verify ? "verified" : "answer");

      // Step 1: Analyze prompt and build anti-hallucination system prompt
      const analysisRes = await fetch(LLM_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: `You are a Clarity prompt engineer specializing in anti-hallucination techniques. Analyze the user's prompt, detect intent and hallucination risks, then return a Clarity system prompt and rewritten user prompt that reduces hallucinations.

Intent types: factual_question, document_qa, content_generation, agent_pipeline, code_generation, general

Available anti-hallucination techniques:
- uncertainty_permission: Allow saying "I don't know"
- direct_quote_grounding: Extract quotes before reasoning
- citation_then_verify: Cite sources, then verify each claim
- chain_of_verification: Draft → verify → correct loop
- step_back_abstraction: Reason about principles first
- source_attribution: Attribute every claim to a source
- external_knowledge_restriction: Use only provided context

Select 2-4 techniques. Return a Clarity system prompt with anti-hallucination technique instructions and a rewritten user prompt with natural grounding cues.`,
            },
            {
              role: "user",
              content: `Apply anti-hallucination techniques to this prompt:\n\n"${prompt}"${context ? `\n\nContext provided (${context.length} chars)` : ""}`,
            },
          ],
          tools: [{
            type: "function" as const,
            function: {
              name: "return_clarity",
              description: "Return the Clarity anti-hallucination prompt",
              parameters: {
                type: "object",
                properties: {
                  intent: { type: "string", enum: ["factual_question", "document_qa", "content_generation", "agent_pipeline", "code_generation", "general"] },
                  techniques: { type: "array", items: { type: "string" } },
                  risks: { type: "array", items: { type: "string" } },
                  systemPrompt: { type: "string", description: "Clarity system prompt with anti-hallucination technique instructions" },
                  userPrompt: { type: "string", description: "Rewritten user prompt with anti-hallucination grounding cues" },
                },
                required: ["intent", "techniques", "risks", "systemPrompt", "userPrompt"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_clarity" } },
        }),
      });

      if (!analysisRes.ok) throw new Error(`LLM analysis failed: ${analysisRes.status}`);
      const analysisData = await analysisRes.json() as any;
      const analysisToolCall = analysisData.choices?.[0]?.message?.tool_calls?.[0];

      if (!analysisToolCall) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "Failed to analyze prompt" }) }] };
      }

      const analysis = JSON.parse(analysisToolCall.function.arguments);

      // Mode: Prompt — return enhanced prompts only, no LLM answer call
      if (resolvedMode === "prompt") {
        const result = {
          original: prompt,
          intent: intent || analysis.intent,
          answer: "",
          claims: [],
          sources: [],
          confidence: 0,
          techniques: analysis.techniques,
          risks: analysis.risks,
          verified: false,
          mode: "prompt",
          trace: [{ step: "Clarity Analysis", duration_ms: 0 }],
          systemPrompt: analysis.systemPrompt,
          userPrompt: analysis.userPrompt,
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      // Step 2: Call LLM with the clarity-enhanced prompts to get an actual answer
      const answerRes = await fetch(LLM_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: LLM_MODEL,
          temperature: 0.2,
          messages: [
            { role: "system", content: analysis.systemPrompt },
            { role: "user", content: analysis.userPrompt },
          ],
          tools: [{
            type: "function" as const,
            function: {
              name: "return_answer",
              description: "Return the structured answer with extracted claims",
              parameters: {
                type: "object",
                properties: {
                  answer: { type: "string", description: "The complete answer following anti-hallucination rules" },
                  claims: { type: "array", items: { type: "string" }, description: "Individual factual claims made in the answer" },
                },
                required: ["answer", "claims"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_answer" } },
        }),
      });

      if (!answerRes.ok) throw new Error(`LLM answer failed: ${answerRes.status}`);
      const answerData = await answerRes.json() as any;
      const answerToolCall = answerData.choices?.[0]?.message?.tool_calls?.[0];

      const llmAnswer = answerToolCall
        ? JSON.parse(answerToolCall.function.arguments)
        : { answer: answerData.choices?.[0]?.message?.content || "Unable to generate answer.", claims: [] };

      const claims = (llmAnswer.claims || []).map((c: string) => ({
        claim: c,
        origin: "llm",
        sources: [],
        verified: false,
      }));

      const result = {
        original: prompt,
        intent: intent || analysis.intent,
        answer: llmAnswer.answer,
        claims,
        sources: [],
        confidence: Math.min(0.65, 0.45 + claims.length * 0.02),
        techniques: analysis.techniques,
        risks: analysis.risks,
        verified: false,
        mode: resolvedMode,
        trace: [
          { step: "Clarity Analysis", duration_ms: 0 },
          { step: "Clarity LLM Answer", duration_ms: 0, detail: `${claims.length} claims (LLM only)` },
        ],
        systemPrompt: analysis.systemPrompt,
        userPrompt: analysis.userPrompt,
      };

      // Mode: Verified — in BYOK mode, try to run browse pipeline if search keys available
      if (resolvedMode === "verified") {
        try {
          const { SERP_API_KEY } = getEnvKeys();
          if (SERP_API_KEY) {
            const browseResult = await apiCall("/browse/answer", { query: prompt, depth: "fast" });
            return { content: [{ type: "text", text: JSON.stringify({ ...result, verified: true, mode: "verified", browseVerification: browseResult }, null, 2) }] };
          }
        } catch {
          // Verification failed — return LLM-only result with note
        }
        return { content: [{ type: "text", text: JSON.stringify({ ...result, _note: "mode='verified' requested but search keys not available in BYOK mode. Use a BrowseAI Dev API key for web-verified Clarity." }, null, 2) }] };
      }

      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- Research Memory tools (API mode only — sessions require Supabase) ---

  server.tool(
    "browse_session_create",
    "Create a new research session. Sessions persist knowledge across multiple queries — each query builds on prior research.",
    { name: z.string().describe("Name for the session (e.g. 'wasm-research', 'react-comparison')") },
    async ({ name }) => {
      if (!API_MODE) {
        return { content: [{ type: "text", text: "Research Memory requires a BrowseAI Dev API key. Set BROWSE_API_KEY to use sessions." }] };
      }
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
      if (!API_MODE) {
        return { content: [{ type: "text", text: "Research Memory requires a BrowseAI Dev API key." }] };
      }
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
      if (!API_MODE) {
        return { content: [{ type: "text", text: "Research Memory requires a BrowseAI Dev API key." }] };
      }
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
      if (!API_MODE) {
        return { content: [{ type: "text", text: "Research Memory requires a BrowseAI Dev API key." }] };
      }
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
      if (!API_MODE) {
        return { content: [{ type: "text", text: "Research Memory requires a BrowseAI Dev API key." }] };
      }
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
      if (!API_MODE) {
        return { content: [{ type: "text", text: "Research Memory requires a BrowseAI Dev API key." }] };
      }
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
      if (!API_MODE) {
        return { content: [{ type: "text", text: "Feedback requires a BrowseAI API key (BROWSE_API_KEY). Set it to enable feedback." }] };
      }
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
