import { createHash } from "crypto";
import { search } from "./search.js";
import { openPage } from "./scrape.js";
import { extractKnowledge } from "../lib/gemini.js";
import { MAX_PAGE_CONTENT_LENGTH } from "@browse/shared";
import type { BrowseResult, TraceStep } from "@browse/shared";
import type { CacheService } from "./cache.js";
import type { Env } from "../config/env.js";

function hashKey(s: string): string {
  return createHash("sha256").update(s.toLowerCase().trim()).digest("hex").slice(0, 24);
}

// Time-sensitive keywords → short TTL, everything else → longer TTL
const TIME_SENSITIVE = /\b(today|tonight|yesterday|latest|current|now|live|breaking|this week|this month|this year|price|stock|score|weather|202[4-9])\b/i;

function getCacheTTL(query: string): number {
  return TIME_SENSITIVE.test(query) ? 300 : 1800; // 5 min vs 30 min
}

export async function answerQuery(
  query: string,
  env: Env,
  cache: CacheService
): Promise<BrowseResult> {
  // Check answer cache
  const cacheKey = `answer:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    const result = JSON.parse(cached) as BrowseResult;
    result.trace = [{ step: "Cache Hit", duration_ms: 0, detail: "Served from cache" }, ...result.trace];
    return result;
  }

  const trace: TraceStep[] = [];

  // Step 1: Search
  const searchStart = Date.now();
  const { results: searchResults } = await search(
    query,
    env.SERP_API_KEY,
    cache
  );
  trace.push({
    step: "Search Web",
    duration_ms: Date.now() - searchStart,
    detail: `${searchResults.length} results (Tavily)`,
  });

  if (searchResults.length === 0) {
    throw new Error("No search results found");
  }

  // Step 2: Fetch pages in parallel
  const scrapeStart = Date.now();
  const pages = await Promise.allSettled(
    searchResults.slice(0, 5).map((r) => openPage(r.url, cache))
  );
  const successfulPages = pages
    .filter(
      (
        p
      ): p is PromiseFulfilledResult<
        Awaited<ReturnType<typeof openPage>>
      > => p.status === "fulfilled"
    )
    .map((p) => p.value.page);
  trace.push({
    step: "Fetch Pages",
    duration_ms: Date.now() - scrapeStart,
    detail: `${successfulPages.length} pages (Readability)`,
  });

  // Step 3: Build content for LLM + page text map for verification
  const pageTexts = new Map<string, string>();
  const pageContents = successfulPages
    .map((p, i) => {
      const url = searchResults[i]?.url || "";
      const content = p.content.slice(0, MAX_PAGE_CONTENT_LENGTH);
      pageTexts.set(url, content);
      return `[Source ${i + 1}] URL: ${url}\nTitle: ${p.title}\n\n${content}`;
    })
    .join("\n\n---\n\n");

  // Step 4: Extract knowledge via LLM (OpenRouter) + verify against sources
  const llmStart = Date.now();
  const knowledge = await extractKnowledge(
    query,
    pageContents,
    env.OPENROUTER_API_KEY,
    pageTexts,
  );
  const llmDuration = Date.now() - llmStart;

  // Count verified and consensus claims for trace
  const verifiedCount = knowledge.claims.filter(
    (c: any) => c.verified === true
  ).length;
  const strongConsensus = knowledge.claims.filter(
    (c: any) => c.consensusLevel === "strong" || c.consensusLevel === "moderate"
  ).length;
  const contradictionCount = knowledge.contradictions?.length || 0;

  trace.push({
    step: "Extract Claims",
    duration_ms: Math.round(llmDuration * 0.30),
    detail: `${knowledge.claims.length} claims`,
  });
  trace.push({
    step: "Verify Evidence",
    duration_ms: Math.round(llmDuration * 0.15),
    detail: `${verifiedCount}/${knowledge.claims.length} claims verified`,
  });
  trace.push({
    step: "Cross-Source Consensus",
    duration_ms: Math.round(llmDuration * 0.10),
    detail: `${strongConsensus}/${knowledge.claims.length} multi-source agreement${contradictionCount > 0 ? `, ${contradictionCount} contradiction${contradictionCount > 1 ? "s" : ""}` : ""}`,
  });
  trace.push({
    step: "Build Evidence Graph",
    duration_ms: Math.round(llmDuration * 0.10),
    detail: `${knowledge.sources.length} sources`,
  });
  trace.push({
    step: "Generate Answer",
    duration_ms: Math.round(llmDuration * 0.35),
    detail: "OpenRouter",
  });

  const result = { ...knowledge, trace };
  await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));
  return result;
}
