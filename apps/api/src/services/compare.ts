import { createHash } from "crypto";
import { LLM_ENDPOINT, LLM_MODEL } from "@browse/shared";
import type { BrowseResult, CompareProvider, CompareCompetitorResult } from "@browse/shared";
import { answerQuery } from "./answer.js";
import type { CacheService } from "./cache.js";
import type { Env } from "../config/env.js";

function hashKey(s: string): string {
  return createHash("sha256").update(s.toLowerCase().trim()).digest("hex").slice(0, 24);
}

const COMPARE_CACHE_TTL = 3600; // 1 hour

export interface CompareResult {
  query: string;
  provider: CompareProvider;
  competitor: CompareCompetitorResult;
  evidence_backed: {
    answer: string;
    sources: number;
    claims: number;
    confidence: number;
    citations: BrowseResult["sources"];
    claimDetails: BrowseResult["claims"];
    trace: BrowseResult["trace"];
    latency_ms: number;
  };
}

// ── Provider metadata ──

export const PROVIDER_LABELS: Record<CompareProvider, string> = {
  perplexity: "Perplexity",
  tavily: "Tavily",
  exa: "Exa",
  you: "You.com",
  brave: "Brave Search",
  raw_llm: "Raw LLM",
};

// ── Raw LLM (no search, just Gemini) ──

async function callRawLLM(query: string, apiKey: string, cache: CacheService): Promise<CompareCompetitorResult> {
  const cacheKey = `compare:raw_llm:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const start = Date.now();
  const res = await fetch(LLM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: [
        { role: "system", content: "Answer the question clearly and concisely." },
        { role: "user", content: query },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Raw LLM failed: ${res.status}`);
  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content || "No response";

  const result: CompareCompetitorResult = {
    provider: "raw_llm",
    label: "Raw LLM",
    answer,
    sources: 0,
    citations: [],
    latency_ms: Date.now() - start,
  };
  await cache.set(cacheKey, JSON.stringify(result), COMPARE_CACHE_TTL);
  return result;
}

// ── Perplexity (OpenAI-compatible) ──

async function callPerplexity(query: string, apiKey: string, cache: CacheService): Promise<CompareCompetitorResult> {
  const cacheKey = `compare:perplexity:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const start = Date.now();
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "Answer the question clearly with evidence from web sources." },
        { role: "user", content: query },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Perplexity API failed: ${res.status}`);
  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content || "No response";
  const citations = (data.citations || []).map((url: string) => ({
    url,
    title: new URL(url).hostname,
  }));

  const result: CompareCompetitorResult = {
    provider: "perplexity",
    label: "Perplexity",
    answer,
    sources: citations.length,
    citations,
    latency_ms: Date.now() - start,
  };
  await cache.set(cacheKey, JSON.stringify(result), COMPARE_CACHE_TTL);
  return result;
}

// ── Tavily (search + answer) ──

async function callTavily(query: string, apiKey: string, cache: CacheService): Promise<CompareCompetitorResult> {
  const cacheKey = `compare:tavily:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const start = Date.now();
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      include_answer: true,
      search_depth: "advanced",
      max_results: 5,
    }),
  });

  if (!res.ok) throw new Error(`Tavily API failed: ${res.status}`);
  const data = await res.json();
  const answer = data.answer || "No answer generated";
  const citations = (data.results || []).map((r: any) => ({
    url: r.url,
    title: r.title || new URL(r.url).hostname,
  }));

  const result: CompareCompetitorResult = {
    provider: "tavily",
    label: "Tavily",
    answer,
    sources: citations.length,
    citations,
    latency_ms: Date.now() - start,
  };
  await cache.set(cacheKey, JSON.stringify(result), COMPARE_CACHE_TTL);
  return result;
}

// ── Exa (search + contents) ──

async function callExa(query: string, apiKey: string, cache: CacheService): Promise<CompareCompetitorResult> {
  const cacheKey = `compare:exa:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const start = Date.now();
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: 5,
      contents: { text: { maxCharacters: 500 } },
    }),
  });

  if (!res.ok) throw new Error(`Exa API failed: ${res.status}`);
  const data = await res.json();
  const results = data.results || [];
  const citations = results.map((r: any) => ({
    url: r.url,
    title: r.title || new URL(r.url).hostname,
  }));
  // Exa doesn't generate answers — concatenate snippets
  const answer = results
    .map((r: any) => r.text || "")
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2000) || "No results found";

  const result: CompareCompetitorResult = {
    provider: "exa",
    label: "Exa",
    answer,
    sources: citations.length,
    citations,
    latency_ms: Date.now() - start,
  };
  await cache.set(cacheKey, JSON.stringify(result), COMPARE_CACHE_TTL);
  return result;
}

// ── You.com (Research API) ──

async function callYou(query: string, apiKey: string, cache: CacheService): Promise<CompareCompetitorResult> {
  const cacheKey = `compare:you:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const start = Date.now();
  const params = new URLSearchParams({ query });
  const res = await fetch(`https://api.ydc-index.io/rag?${params}`, {
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) throw new Error(`You.com API failed: ${res.status}`);
  const data = await res.json();
  const answer = data.answer || "No answer generated";
  const hits = data.hits || [];
  const citations = hits.map((h: any) => ({
    url: h.url || "",
    title: h.title || "Unknown",
  }));

  const result: CompareCompetitorResult = {
    provider: "you",
    label: "You.com",
    answer,
    sources: citations.length,
    citations,
    latency_ms: Date.now() - start,
  };
  await cache.set(cacheKey, JSON.stringify(result), COMPARE_CACHE_TTL);
  return result;
}

// ── Brave (Web Search + Summarizer) ──

async function callBrave(query: string, apiKey: string, cache: CacheService): Promise<CompareCompetitorResult> {
  const cacheKey = `compare:brave:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const start = Date.now();
  const params = new URLSearchParams({ q: query, summary: "1", count: "5" });
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      "X-Subscription-Token": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(`Brave API failed: ${res.status}`);
  const data = await res.json();
  const summary = data.summarizer?.results?.[0]?.text || "";
  const webResults = data.web?.results || [];
  const citations = webResults.slice(0, 5).map((r: any) => ({
    url: r.url,
    title: r.title || new URL(r.url).hostname,
  }));
  // If no summarizer, combine snippets
  const answer = summary || webResults
    .map((r: any) => r.description || "")
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2000) || "No results found";

  const result: CompareCompetitorResult = {
    provider: "brave",
    label: "Brave Search",
    answer,
    sources: citations.length,
    citations,
    latency_ms: Date.now() - start,
  };
  await cache.set(cacheKey, JSON.stringify(result), COMPARE_CACHE_TTL);
  return result;
}

// ── Get available providers based on env keys ──

export function getAvailableProviders(env: Env): CompareProvider[] {
  const providers: CompareProvider[] = ["raw_llm"]; // always available
  if (env.PERPLEXITY_API_KEY) providers.push("perplexity");
  if (env.SERP_API_KEY) providers.push("tavily");
  if (env.EXA_API_KEY) providers.push("exa");
  if (env.YDC_API_KEY) providers.push("you");
  if (env.BRAVE_API_KEY) providers.push("brave");
  return providers;
}

// ── Main compare function ──

async function callCompetitor(
  provider: CompareProvider,
  query: string,
  env: Env,
  cache: CacheService
): Promise<CompareCompetitorResult> {
  switch (provider) {
    case "perplexity":
      if (!env.PERPLEXITY_API_KEY) throw new Error("Perplexity API key not configured");
      return callPerplexity(query, env.PERPLEXITY_API_KEY, cache);
    case "tavily":
      return callTavily(query, env.SERP_API_KEY, cache);
    case "exa":
      if (!env.EXA_API_KEY) throw new Error("Exa API key not configured");
      return callExa(query, env.EXA_API_KEY, cache);
    case "you":
      if (!env.YDC_API_KEY) throw new Error("You.com API key not configured");
      return callYou(query, env.YDC_API_KEY, cache);
    case "brave":
      if (!env.BRAVE_API_KEY) throw new Error("Brave API key not configured");
      return callBrave(query, env.BRAVE_API_KEY, cache);
    case "raw_llm":
      return callRawLLM(query, env.OPENROUTER_API_KEY, cache);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export async function compareAnswers(
  query: string,
  provider: CompareProvider,
  env: Env,
  cache: CacheService
): Promise<CompareResult> {
  const browseStart = Date.now();
  const [competitorResult, evidenceResult] = await Promise.all([
    callCompetitor(provider, query, env, cache),
    answerQuery(query, env, cache),
  ]);
  const browseLatency = Date.now() - browseStart;

  return {
    query,
    provider,
    competitor: competitorResult,
    evidence_backed: {
      answer: evidenceResult.answer,
      sources: evidenceResult.sources.length,
      claims: evidenceResult.claims.length,
      confidence: evidenceResult.confidence,
      citations: evidenceResult.sources,
      claimDetails: evidenceResult.claims,
      trace: evidenceResult.trace,
      latency_ms: browseLatency,
    },
  };
}
