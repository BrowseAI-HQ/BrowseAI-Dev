import { createHash } from "crypto";
import { search } from "./search.js";
import type { SearchResult } from "./search.js";
import { openPage } from "./scrape.js";
import { extractKnowledge, rephraseQuery, generateQueryVariant, analyzeQuery } from "../lib/gemini.js";
import type { QueryType, QueryAnalysis } from "../lib/gemini.js";
import { braveSearch } from "../lib/brave.js";
import { isLowQualityDomain, rerankSources, trackSourceUsefulness } from "../lib/verify.js";
import {
  getAdaptiveBM25Threshold,
  getAdaptiveConsensusThreshold,
  getAdaptivePageCount,
  getAdaptiveWeights,
  recordQuerySignals,
} from "../lib/learning.js";
import { MAX_PAGE_CONTENT_LENGTH } from "@browse/shared";
import type { BrowseResult, TraceStep } from "@browse/shared";
import type { CacheService } from "./cache.js";
import type { Env } from "../config/env.js";

const THOROUGH_CONFIDENCE_THRESHOLD = 0.6;
const MAX_PER_DOMAIN = 2;

/** Adaptive page count based on query type. Complex queries need more sources. */
const ADAPTIVE_PAGE_COUNT: Record<QueryType, number> = {
  factual: 6,
  comparison: 10,
  "how-to": 6,
  "time-sensitive": 8,
  opinion: 10,
};

function hashKey(s: string): string {
  return createHash("sha256").update(s.toLowerCase().trim()).digest("hex").slice(0, 24);
}

// Time-sensitive keywords → short TTL, everything else → longer TTL
const TIME_SENSITIVE = /\b(today|tonight|yesterday|latest|current|now|live|breaking|this week|this month|this year|price|stock|score|weather|202[4-9])\b/i;

function getCacheTTL(query: string): number {
  return TIME_SENSITIVE.test(query) ? 300 : 1800; // 5 min vs 30 min
}

/** Filter out known low-quality domains before fetching (saves slots for better sources). */
function filterLowQuality(results: SearchResult[]): SearchResult[] {
  return results.filter((r) => !isLowQualityDomain(r.url));
}

/**
 * Enforce domain diversity: max N results per domain, sorted by score.
 * Ensures we get perspectives from different sources rather than 5 pages from one site.
 */
function enforceDomainDiversity(results: SearchResult[], maxPerDomain: number = MAX_PER_DOMAIN): SearchResult[] {
  const domainCounts = new Map<string, number>();
  const diverse: SearchResult[] = [];

  // Results should already be sorted by score from Tavily
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

/**
 * Merge two sets of search results, deduplicating by URL and re-sorting by score.
 */
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

/** Run a single search → fetch → extract pass. Returns result + raw page texts for merging. */
async function singlePass(
  query: string,
  env: Env,
  cache: CacheService,
  trace: TraceStep[],
  existingPageTexts?: Map<string, string>,
  passLabel?: string,
  preAnalysis?: QueryAnalysis,
  sessionContext?: string,
) {
  const label = passLabel ? ` (${passLabel})` : "";

  // Phase 1: Parallel — search + variant + analysis + brave (if available)
  const searchStart = Date.now();

  const parallelTasks: [
    Promise<{ results: SearchResult[]; cached: boolean }>,
    Promise<string>,
    Promise<QueryAnalysis>,
    Promise<SearchResult[]>,
  ] = [
    search(query, env.SERP_API_KEY, cache),
    generateQueryVariant(query, env.OPENROUTER_API_KEY),
    preAnalysis ? Promise.resolve(preAnalysis) : analyzeQuery(query, env.OPENROUTER_API_KEY),
    env.BRAVE_API_KEY
      ? braveSearch(query, env.BRAVE_API_KEY).then((results) =>
          results.map((r) => ({ url: r.url, title: r.title, snippet: r.description, score: r.score }))
        )
      : Promise.resolve([]),
  ];

  const [mainResults, variantQuery, analysis, braveResults] = await Promise.all(parallelTasks);

  // Add query plan trace step if plan exists
  if (analysis.plan && analysis.plan.length > 0) {
    const planDetail = analysis.plan.map((p) => `[${p.intent}] ${p.query}`).join("; ");
    trace.push({
      step: `Query Plan${label}`,
      duration_ms: 0, // included in search timing
      detail: `${analysis.plan.length} sub-queries: ${planDetail}`,
    });
  }

  let allResults = mainResults.results;
  let searchDetail = "";

  // Merge Brave results (multi-provider search)
  if (braveResults.length > 0) {
    const before = allResults.length;
    allResults = mergeSearchResults(allResults, braveResults);
    const added = allResults.length - before;
    if (added > 0) searchDetail += ` +${added} Brave`;
  }

  // Merge variant results
  if (variantQuery && variantQuery !== query) {
    const { results: variantResults } = await search(variantQuery, env.SERP_API_KEY, cache);
    const before = allResults.length;
    allResults = mergeSearchResults(allResults, variantResults);
    const added = allResults.length - before;
    if (added > 0) searchDetail += ` +${added} variant`;
  }

  // Phase 2: Sub-query decomposition (for complex queries)
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

  // Phase 3: Quality filter + domain diversity
  const filtered = filterLowQuality(allResults);
  const diverseResults = enforceDomainDiversity(filtered);

  // Rerank using domain intelligence (authority + usefulness + co-citation)
  const rerankedResults = rerankSources(diverseResults);

  // Adaptive page count: learning engine overrides if enough data, else use defaults
  const pageCount = getAdaptivePageCount(analysis.type) || ADAPTIVE_PAGE_COUNT[analysis.type] || 8;

  trace.push({
    step: `Search Web${label}`,
    duration_ms: Date.now() - searchStart,
    detail: `${rerankedResults.length} results (${allResults.length} raw → ${filtered.length} quality → diverse → reranked) [${analysis.type}]${searchDetail}`,
  });

  if (rerankedResults.length === 0) {
    throw new Error("No search results found");
  }

  // Phase 4: Fetch pages (adaptive count, best sources first thanks to reranking)
  const scrapeStart = Date.now();
  const pages = await Promise.allSettled(
    rerankedResults.slice(0, pageCount).map((r) => openPage(r.url, cache))
  );
  const successfulPages = pages
    .filter(
      (p): p is PromiseFulfilledResult<Awaited<ReturnType<typeof openPage>>> =>
        p.status === "fulfilled"
    )
    .map((p) => p.value.page);
  trace.push({
    step: `Fetch Pages${label}`,
    duration_ms: Date.now() - scrapeStart,
    detail: `${successfulPages.length} pages (Readability, reranked)`,
  });

  // Build content + merge page texts
  const pageTexts = new Map<string, string>(existingPageTexts || []);
  const pageContents = successfulPages
    .map((p, i) => {
      const url = rerankedResults[i]?.url || "";
      const content = p.content.slice(0, MAX_PAGE_CONTENT_LENGTH);
      pageTexts.set(url, content);
      return `[Source ${i + 1}] URL: ${url}\nTitle: ${p.title}\n\n${content}`;
    })
    .join("\n\n---\n\n");

  // Phase 5: Extract + verify (with type-aware prompt)
  const llmStart = Date.now();
  // Pass adaptive thresholds from learning engine into extraction + verification
  const adaptiveOptions = {
    bm25Threshold: getAdaptiveBM25Threshold(analysis.type),
    consensusThreshold: getAdaptiveConsensusThreshold(analysis.type),
    weights: getAdaptiveWeights(analysis.type),
  };
  const knowledge = await extractKnowledge(query, pageContents, env.OPENROUTER_API_KEY, pageTexts, analysis.type, sessionContext, adaptiveOptions);
  const llmDuration = Date.now() - llmStart;

  // Trace steps
  const verifiedCount = knowledge.claims.filter((c: any) => c.verified === true).length;
  const strongConsensus = knowledge.claims.filter(
    (c: any) => c.consensusLevel === "strong" || c.consensusLevel === "moderate"
  ).length;
  const contradictionCount = knowledge.contradictions?.length || 0;

  trace.push({
    step: `Extract Claims${label}`,
    duration_ms: Math.round(llmDuration * 0.30),
    detail: `${knowledge.claims.length} claims`,
  });
  trace.push({
    step: `Verify Evidence${label}`,
    duration_ms: Math.round(llmDuration * 0.15),
    detail: `${verifiedCount}/${knowledge.claims.length} claims verified`,
  });
  trace.push({
    step: `Cross-Source Consensus${label}`,
    duration_ms: Math.round(llmDuration * 0.10),
    detail: `${strongConsensus}/${knowledge.claims.length} multi-source agreement${contradictionCount > 0 ? `, ${contradictionCount} contradiction${contradictionCount > 1 ? "s" : ""}` : ""}`,
  });
  trace.push({
    step: `Build Evidence Graph${label}`,
    duration_ms: Math.round(llmDuration * 0.10),
    detail: `${knowledge.sources.length} sources`,
  });
  trace.push({
    step: `Generate Answer${label}`,
    duration_ms: Math.round(llmDuration * 0.35),
    detail: "OpenRouter",
  });

  // Track source usefulness (fire-and-forget, inline learning)
  try {
    const urlDomain = new Map<string, string>();
    for (const s of knowledge.sources) urlDomain.set(s.url, s.domain);

    const domainUseful = new Map<string, { verified: boolean; consensus: boolean }>();
    for (const claim of knowledge.claims) {
      for (const url of claim.sources || []) {
        const domain = urlDomain.get(url);
        if (!domain) continue;
        const d = domain.toLowerCase().replace(/^www\./, "");
        const existing = domainUseful.get(d) || { verified: false, consensus: false };
        if ((claim as any).verified) existing.verified = true;
        if ((claim as any).consensusLevel === "strong" || (claim as any).consensusLevel === "moderate") existing.consensus = true;
        domainUseful.set(d, existing);
      }
    }
    for (const [domain, u] of domainUseful) {
      trackSourceUsefulness(domain, u.verified, u.consensus);
    }
  } catch { /* non-critical */ }

  return { knowledge, pageTexts, queryType: analysis.type };
}

export async function answerQuery(
  query: string,
  env: Env,
  cache: CacheService,
  depth: "fast" | "thorough" = "fast",
  sessionContext?: string,
): Promise<BrowseResult> {
  // Cache key includes depth so thorough results are cached separately
  // Session-contextualized queries skip cache since context varies
  const cacheKey = sessionContext ? null : `answer:${depth}:${hashKey(query)}`;
  if (cacheKey) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      const result = JSON.parse(cached) as BrowseResult;
      result.trace = [{ step: "Cache Hit", duration_ms: 0, detail: "Served from cache" }, ...result.trace];
      return result;
    }
  }

  const queryStart = Date.now();
  const trace: TraceStep[] = [];

  // First pass
  const { knowledge, pageTexts, queryType } = await singlePass(query, env, cache, trace, undefined, undefined, undefined, sessionContext);

  // Thorough mode: if confidence is low, rephrase and do a second pass
  if (depth === "thorough" && knowledge.confidence < THOROUGH_CONFIDENCE_THRESHOLD) {
    const rephraseStart = Date.now();
    const rephrasedQuery = await rephraseQuery(query, env.OPENROUTER_API_KEY);
    trace.push({
      step: "Rephrase Query",
      duration_ms: Date.now() - rephraseStart,
      detail: `"${rephrasedQuery.slice(0, 80)}"`,
    });

    // Second pass with rephrased query, merging existing page texts
    const { knowledge: pass2 } = await singlePass(
      rephrasedQuery, env, cache, trace, pageTexts, "pass 2"
    );

    // Pick whichever pass produced higher confidence
    const best = pass2.confidence > knowledge.confidence ? pass2 : knowledge;
    trace.push({
      step: "Select Best Result",
      duration_ms: 0,
      detail: `Pass ${pass2.confidence > knowledge.confidence ? "2" : "1"} selected (${Math.round(best.confidence * 100)}% vs ${Math.round((pass2.confidence > knowledge.confidence ? knowledge : pass2).confidence * 100)}%)`,
    });

    const result = { ...best, trace };
    if (cacheKey) await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));

    // Record learning signals (fire-and-forget)
    try {
      recordQuerySignals({
        queryType: queryType,
        confidence: result.confidence,
        verificationRate: result.claims.filter((c: any) => c.verified).length / Math.max(result.claims.length, 1),
        consensusScore: result.claims.filter((c: any) => c.consensusLevel === "strong" || c.consensusLevel === "moderate").length / Math.max(result.claims.length, 1),
        sourceCount: result.sources.length,
        claimCount: result.claims.length,
        contradictionCount: result.contradictions?.length || 0,
        responseTimeMs: Date.now() - queryStart,
        depth: "thorough",
        thoroughImproved: pass2.confidence > knowledge.confidence,
      });
    } catch { /* non-critical */ }

    return result;
  }

  const result = { ...knowledge, trace };
  if (cacheKey) await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));

  // Record learning signals (fire-and-forget)
  try {
    recordQuerySignals({
      queryType: queryType,
      confidence: result.confidence,
      verificationRate: result.claims.filter((c: any) => c.verified).length / Math.max(result.claims.length, 1),
      consensusScore: result.claims.filter((c: any) => c.consensusLevel === "strong" || c.consensusLevel === "moderate").length / Math.max(result.claims.length, 1),
      sourceCount: result.sources.length,
      claimCount: result.claims.length,
      contradictionCount: result.contradictions?.length || 0,
      responseTimeMs: Date.now() - queryStart,
      depth,
    });
  } catch { /* non-critical */ }

  return result;
}
