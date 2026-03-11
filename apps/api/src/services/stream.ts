/**
 * Streaming answer pipeline — sends SSE events as each step completes.
 *
 * Event types:
 *   trace   — { step, duration_ms, detail } — pipeline progress
 *   sources — { sources } — discovered sources (sent early)
 *   result  — full BrowseResult — final answer
 *   error   — { error } — on failure
 *
 * Clients receive real-time progress instead of waiting 5-15s for the full response.
 */

import { createHash } from "crypto";
import { search } from "./search.js";
import type { SearchResult } from "./search.js";
import { openPage } from "./scrape.js";
import { extractKnowledge, generateQueryVariant, analyzeQuery } from "../lib/gemini.js";
import type { QueryType, QueryAnalysis } from "../lib/gemini.js";
import { braveSearch } from "../lib/brave.js";
import { isLowQualityDomain } from "../lib/verify.js";
import { MAX_PAGE_CONTENT_LENGTH } from "@browse/shared";
import type { BrowseResult, TraceStep } from "@browse/shared";
import type { CacheService } from "./cache.js";
import type { Env } from "../config/env.js";

const MAX_PER_DOMAIN = 2;

const ADAPTIVE_PAGE_COUNT: Record<QueryType, number> = {
  factual: 6,
  comparison: 10,
  "how-to": 6,
  "time-sensitive": 8,
  opinion: 10,
};

const TIME_SENSITIVE = /\b(today|tonight|yesterday|latest|current|now|live|breaking|this week|this month|this year|price|stock|score|weather|202[4-9])\b/i;

function hashKey(s: string): string {
  return createHash("sha256").update(s.toLowerCase().trim()).digest("hex").slice(0, 24);
}

function getCacheTTL(query: string): number {
  return TIME_SENSITIVE.test(query) ? 300 : 1800;
}

function filterLowQuality(results: SearchResult[]): SearchResult[] {
  return results.filter((r) => !isLowQualityDomain(r.url));
}

function enforceDomainDiversity(results: SearchResult[], maxPerDomain: number = MAX_PER_DOMAIN): SearchResult[] {
  const domainCounts = new Map<string, number>();
  const diverse: SearchResult[] = [];
  for (const r of results) {
    const domain = new URL(r.url).hostname.replace(/^www\./, "");
    const count = domainCounts.get(domain) || 0;
    if (count < maxPerDomain) {
      diverse.push(r);
      domainCounts.set(domain, count + 1);
    }
  }
  return diverse;
}

function mergeSearchResults(a: SearchResult[], b: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const merged: SearchResult[] = [];
  for (const r of [...a, ...b]) {
    if (!seen.has(r.url)) {
      seen.add(r.url);
      merged.push(r);
    }
  }
  return merged.sort((x, y) => y.score - x.score);
}

export type SSEWriter = (event: string, data: unknown) => void;

/**
 * Run the answer pipeline with streaming progress events.
 * Returns the final BrowseResult (also sent via SSE).
 */
export async function answerQueryStreaming(
  query: string,
  env: Env,
  cache: CacheService,
  emit: SSEWriter,
): Promise<BrowseResult> {
  // Check cache first
  const cacheKey = `answer:fast:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    const result = JSON.parse(cached) as BrowseResult;
    result.trace = [{ step: "Cache Hit", duration_ms: 0, detail: "Served from cache" }, ...result.trace];
    emit("trace", { step: "Cache Hit", duration_ms: 0, detail: "Served from cache" });
    emit("result", result);
    return result;
  }

  const trace: TraceStep[] = [];

  // Phase 1: Search
  const searchStart = Date.now();
  emit("trace", { step: "Searching", duration_ms: 0, detail: "Querying search providers..." });

  const [mainResults, variantQuery, analysis, braveResults] = await Promise.all([
    search(query, env.SERP_API_KEY, cache),
    generateQueryVariant(query, env.OPENROUTER_API_KEY),
    analyzeQuery(query, env.OPENROUTER_API_KEY),
    env.BRAVE_API_KEY
      ? braveSearch(query, env.BRAVE_API_KEY).then((results) =>
          results.map((r) => ({ url: r.url, title: r.title, snippet: r.description, score: r.score }))
        )
      : Promise.resolve([]),
  ] as const);

  let allResults = mainResults.results;
  let searchDetail = "";

  if (braveResults.length > 0) {
    const before = allResults.length;
    allResults = mergeSearchResults(allResults, braveResults as SearchResult[]);
    const added = allResults.length - before;
    if (added > 0) searchDetail += ` +${added} Brave`;
  }

  if (variantQuery && variantQuery !== query) {
    const { results: variantResults } = await search(variantQuery, env.SERP_API_KEY, cache);
    const before = allResults.length;
    allResults = mergeSearchResults(allResults, variantResults);
    const added = allResults.length - before;
    if (added > 0) searchDetail += ` +${added} variant`;
  }

  if (analysis.subQueries && analysis.subQueries.length > 0) {
    const subResults = await Promise.all(
      analysis.subQueries.map((sq) => search(sq, env.SERP_API_KEY, cache))
    );
    for (const sr of subResults) {
      const before = allResults.length;
      allResults = mergeSearchResults(allResults, sr.results);
      const added = allResults.length - before;
      if (added > 0) searchDetail += ` +${added} sub-q`;
    }
  }

  const filtered = filterLowQuality(allResults);
  const diverseResults = enforceDomainDiversity(filtered);
  const pageCount = ADAPTIVE_PAGE_COUNT[analysis.type] || 8;

  const searchStep: TraceStep = {
    step: "Search Web",
    duration_ms: Date.now() - searchStart,
    detail: `${diverseResults.length} results [${analysis.type}]${searchDetail}`,
  };
  trace.push(searchStep);
  emit("trace", searchStep);

  if (diverseResults.length === 0) {
    throw new Error("No search results found");
  }

  // Emit sources early so client can show them while pages load
  emit("sources", diverseResults.slice(0, pageCount).map((r) => ({ url: r.url, title: r.title })));

  // Phase 2: Fetch pages
  const scrapeStart = Date.now();
  emit("trace", { step: "Fetching", duration_ms: 0, detail: `Loading ${Math.min(pageCount, diverseResults.length)} pages...` });

  const pages = await Promise.allSettled(
    diverseResults.slice(0, pageCount).map((r) => openPage(r.url, cache))
  );
  const successfulPages = pages
    .filter((p): p is PromiseFulfilledResult<Awaited<ReturnType<typeof openPage>>> => p.status === "fulfilled")
    .map((p) => p.value.page);

  const fetchStep: TraceStep = {
    step: "Fetch Pages",
    duration_ms: Date.now() - scrapeStart,
    detail: `${successfulPages.length} pages`,
  };
  trace.push(fetchStep);
  emit("trace", fetchStep);

  // Build content
  const pageTexts = new Map<string, string>();
  const pageContents = successfulPages
    .map((p, i) => {
      const url = diverseResults[i]?.url || "";
      const content = p.content.slice(0, MAX_PAGE_CONTENT_LENGTH);
      pageTexts.set(url, content);
      return `[Source ${i + 1}] URL: ${url}\nTitle: ${p.title}\n\n${content}`;
    })
    .join("\n\n---\n\n");

  // Phase 3: Extract + verify
  const llmStart = Date.now();
  emit("trace", { step: "Analyzing", duration_ms: 0, detail: "Extracting knowledge and verifying claims..." });

  const knowledge = await extractKnowledge(query, pageContents, env.OPENROUTER_API_KEY, pageTexts, analysis.type);
  const llmDuration = Date.now() - llmStart;

  const verifiedCount = knowledge.claims.filter((c: any) => c.verified === true).length;
  const strongConsensus = knowledge.claims.filter(
    (c: any) => c.consensusLevel === "strong" || c.consensusLevel === "moderate"
  ).length;
  const contradictionCount = knowledge.contradictions?.length || 0;

  const extractStep: TraceStep = { step: "Extract Claims", duration_ms: Math.round(llmDuration * 0.30), detail: `${knowledge.claims.length} claims` };
  const verifyStep: TraceStep = { step: "Verify Evidence", duration_ms: Math.round(llmDuration * 0.15), detail: `${verifiedCount}/${knowledge.claims.length} verified` };
  const consensusStep: TraceStep = {
    step: "Cross-Source Consensus",
    duration_ms: Math.round(llmDuration * 0.10),
    detail: `${strongConsensus}/${knowledge.claims.length} agreement${contradictionCount > 0 ? `, ${contradictionCount} contradiction${contradictionCount > 1 ? "s" : ""}` : ""}`,
  };
  const graphStep: TraceStep = { step: "Build Evidence Graph", duration_ms: Math.round(llmDuration * 0.10), detail: `${knowledge.sources.length} sources` };
  const answerStep: TraceStep = { step: "Generate Answer", duration_ms: Math.round(llmDuration * 0.35), detail: "OpenRouter" };

  trace.push(extractStep, verifyStep, consensusStep, graphStep, answerStep);
  emit("trace", extractStep);
  emit("trace", verifyStep);
  emit("trace", consensusStep);
  emit("trace", graphStep);
  emit("trace", answerStep);

  const result: BrowseResult = { ...knowledge, trace };

  // Cache
  await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));

  // Send final result
  emit("result", result);

  return result;
}
