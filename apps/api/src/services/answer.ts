import { createHash } from "crypto";
import { search } from "./search.js";
import type { SearchResult } from "./search.js";
import { openPage } from "./scrape.js";
import { extractKnowledge, rephraseQuery, generateQueryVariant, analyzeQuery } from "../lib/gemini.js";
import type { QueryType, QueryAnalysis } from "../lib/gemini.js";
import { braveSearch } from "../lib/brave.js";
import { isLowQualityDomain, rerankSources, trackSourceUsefulness } from "../lib/verify.js";
import { crossEncoderRerank } from "../lib/reranker.js";
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
import type { SearchProvider } from "../lib/searchProvider.js";

// ─── Multi-Pass Consistency (SelfCheckGPT-inspired) ──────────────────
// Compares claims from two independent extraction passes.
// Claims confirmed by both passes are more reliable → boost.
// Claims unique to one pass may be hallucinated → penalize.

interface ConsistencyResult {
  /** Per-claim verification score adjustments */
  adjustments: number[];
  /** Number of claims from primary pass confirmed in secondary */
  confirmedCount: number;
  /** Ratio of confirmed claims (0-1) */
  consistencyRate: number;
}

/**
 * Check consistency between claims from two extraction passes.
 * Uses token overlap to identify matching claims (NLI would be better
 * but adds latency; token overlap is fast and sufficient here since
 * both passes extract from the same sources).
 */
function checkMultiPassConsistency(
  primaryClaims: Array<{ claim: string; [k: string]: unknown }>,
  secondaryClaims: Array<{ claim: string; [k: string]: unknown }>,
): ConsistencyResult {
  if (secondaryClaims.length === 0) {
    return {
      adjustments: primaryClaims.map(() => 0),
      confirmedCount: 0,
      consistencyRate: 0,
    };
  }

  const OVERLAP_THRESHOLD = 0.35; // Min token overlap to consider "same claim"
  const BOOST = 0.08;             // Verification score boost for confirmed claims
  const PENALTY = -0.05;          // Penalty for unconfirmed claims

  const adjustments: number[] = [];
  let confirmedCount = 0;

  for (const primary of primaryClaims) {
    const primaryTokens = consistencyTokenize(primary.claim);
    let bestOverlap = 0;

    for (const secondary of secondaryClaims) {
      const secondaryTokens = consistencyTokenize(secondary.claim);
      const shared = primaryTokens.filter(t => secondaryTokens.includes(t));
      const overlap = shared.length / Math.max(primaryTokens.length, secondaryTokens.length, 1);
      bestOverlap = Math.max(bestOverlap, overlap);
    }

    if (bestOverlap >= OVERLAP_THRESHOLD) {
      confirmedCount++;
      adjustments.push(BOOST);
    } else {
      adjustments.push(PENALTY);
    }
  }

  return {
    adjustments,
    confirmedCount,
    consistencyRate: primaryClaims.length > 0 ? confirmedCount / primaryClaims.length : 0,
  };
}

/** Simple tokenizer for consistency checking */
function consistencyTokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(w => w.length > 2);
}

export type AnswerOptions = {
  /** Pluggable search provider. If set, overrides Tavily/Brave. */
  searchProvider?: SearchProvider;
  /** Secondary search provider (e.g. Brave for diversity). Ignored if searchProvider is set for enterprise. */
  secondaryProvider?: SearchProvider;
  /** Data retention mode — "none" skips caching and storage. */
  dataRetention?: "normal" | "none";
};

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
    let domain: string;
    try { domain = new URL(r.url).hostname.replace(/^www\./, ""); } catch { continue; }
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

/** Execute a search using either the pluggable provider or the default Tavily path. */
function doSearch(
  query: string,
  provider: SearchProvider | undefined,
  serpApiKey: string,
  cache: CacheService,
  limit?: number,
): Promise<{ results: SearchResult[]; cached: boolean }> {
  if (provider) {
    return provider.search(query, limit).then((results) => ({ results, cached: false }));
  }
  return search(query, serpApiKey, cache, limit);
}

/** Run a single search → fetch → extract pass. Returns result + raw page texts for merging. */
export async function singlePass(
  query: string,
  env: Env,
  cache: CacheService,
  trace: TraceStep[],
  existingPageTexts?: Map<string, string>,
  passLabel?: string,
  preAnalysis?: QueryAnalysis,
  sessionContext?: string,
  options?: AnswerOptions,
) {
  const label = passLabel ? ` (${passLabel})` : "";
  const useProvider = options?.searchProvider;

  // Phase 1: Parallel — search + variant + analysis + secondary search (if available)
  const searchStart = Date.now();

  // Build secondary search promise
  const secondarySearch: Promise<SearchResult[]> =
    options?.secondaryProvider
      ? options.secondaryProvider.search(query).catch(() => [])
      : (!useProvider && env.BRAVE_API_KEY)
        ? braveSearch(query, env.BRAVE_API_KEY).then((results) =>
            results.map((r) => ({ url: r.url, title: r.title, snippet: r.description, score: r.score }))
          )
        : Promise.resolve([]);

  const parallelTasks: [
    Promise<{ results: SearchResult[]; cached: boolean }>,
    Promise<string>,
    Promise<QueryAnalysis>,
    Promise<SearchResult[]>,
  ] = [
    doSearch(query, useProvider, env.SERP_API_KEY, cache),
    generateQueryVariant(query, env.OPENROUTER_API_KEY),
    preAnalysis ? Promise.resolve(preAnalysis) : analyzeQuery(query, env.OPENROUTER_API_KEY),
    secondarySearch,
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

  // Merge variant results (non-fatal — don't crash if variant search fails)
  if (variantQuery && variantQuery !== query) {
    try {
      const { results: variantResults } = await doSearch(variantQuery, useProvider, env.SERP_API_KEY, cache);
      const before = allResults.length;
      allResults = mergeSearchResults(allResults, variantResults);
      const added = allResults.length - before;
      if (added > 0) searchDetail += ` +${added} variant`;
    } catch {
      // Variant search failed — continue with main results
      searchDetail += " (variant failed)";
    }
  }

  // Phase 2: Sub-query decomposition (for complex queries)
  if (analysis.subQueries && analysis.subQueries.length > 0) {
    const subResults = await Promise.allSettled(
      analysis.subQueries.map((sq) => doSearch(sq, useProvider, env.SERP_API_KEY, cache))
    );
    for (const sr of subResults) {
      if (sr.status !== "fulfilled") continue; // Skip failed sub-queries
      const before = allResults.length;
      allResults = mergeSearchResults(allResults, sr.value.results);
      const added = allResults.length - before;
      if (added > 0) searchDetail += ` +${added} sub-q`;
    }
  }

  // Phase 3: Quality filter + domain diversity
  const filtered = filterLowQuality(allResults);
  const diverseResults = enforceDomainDiversity(filtered);

  // Rerank using domain intelligence (authority + usefulness + co-citation)
  let rerankedResults = rerankSources(diverseResults);

  // Neural re-rank: cross-encoder scoring for semantic query-document relevance (premium)
  let neuralReranked = false;
  if (env.HF_API_KEY && rerankedResults.length > 1) {
    const rerankStart = Date.now();
    const ceResult = await crossEncoderRerank(query, rerankedResults, env.HF_API_KEY);
    if (ceResult.reranked) {
      rerankedResults = ceResult.results;
      neuralReranked = true;
      trace.push({
        step: `Neural Rerank${label}`,
        duration_ms: Date.now() - rerankStart,
        detail: `${rerankedResults.length} results re-scored by cross-encoder`,
      });
    }
  }

  // Adaptive page count: learning engine overrides if enough data, else use defaults
  const pageCount = getAdaptivePageCount(analysis.type) || ADAPTIVE_PAGE_COUNT[analysis.type] || 8;

  const providerLabel = useProvider ? ` via ${useProvider.name}` : "";
  const rerankLabel = neuralReranked ? " → neural" : "";
  trace.push({
    step: `Search Web${label}`,
    duration_ms: Date.now() - searchStart,
    detail: `${rerankedResults.length} results (${allResults.length} raw → ${filtered.length} quality → diverse → reranked${rerankLabel}) [${analysis.type}]${searchDetail}${providerLabel}`,
  });

  if (rerankedResults.length === 0) {
    throw new Error("No search results found");
  }

  // Phase 4: Fetch pages (adaptive count, best sources first thanks to reranking)
  const scrapeStart = Date.now();
  const pagesToFetch = rerankedResults.slice(0, pageCount);
  const pages = await Promise.allSettled(
    pagesToFetch.map((r) => openPage(r.url, cache))
  );
  // Track URL alongside each successful page to avoid index misalignment
  const successfulPages: { page: Awaited<ReturnType<typeof openPage>>["page"]; url: string }[] = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    if (p.status === "fulfilled") {
      successfulPages.push({ page: p.value.page, url: pagesToFetch[i].url });
    }
  }
  trace.push({
    step: `Fetch Pages${label}`,
    duration_ms: Date.now() - scrapeStart,
    detail: `${successfulPages.length} pages (Readability, reranked)`,
  });

  // Build content + merge page texts
  const pageTexts = new Map<string, string>(existingPageTexts || []);
  const pageContents = successfulPages
    .map((entry, i) => {
      const url = entry.url;
      const content = entry.page.content.slice(0, MAX_PAGE_CONTENT_LENGTH);
      pageTexts.set(url, content);
      return `[Source ${i + 1}] URL: ${url}\nTitle: ${entry.page.title}\n\n${content}`;
    })
    .join("\n\n---\n\n");

  // Phase 5: Extract + verify (with type-aware prompt)
  const llmStart = Date.now();
  // Pass adaptive thresholds from learning engine into extraction + verification
  const adaptiveOptions = {
    bm25Threshold: getAdaptiveBM25Threshold(analysis.type),
    consensusThreshold: getAdaptiveConsensusThreshold(analysis.type),
    weights: getAdaptiveWeights(analysis.type),
    hfApiKey: env.HF_API_KEY,
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
  depth: "fast" | "thorough" | "deep" = "fast",
  sessionContext?: string,
  options?: AnswerOptions,
): Promise<BrowseResult> {
  const noRetention = options?.dataRetention === "none";

  // Cache key includes depth so thorough results are cached separately
  // Session-contextualized queries skip cache since context varies
  // Zero data retention mode skips cache entirely
  const cacheKey = (sessionContext || noRetention) ? null : `answer:${depth}:${hashKey(query)}`;
  if (cacheKey) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      const result = JSON.parse(cached) as BrowseResult;
      result.trace = [{ step: "Cache Hit", duration_ms: 0, detail: "Served from cache" }, ...result.trace];
      return result;
    }
  }

  // Deep mode: multi-step reasoning agent
  if (depth === "deep") {
    const { answerQueryDeep } = await import("./deep.js");
    const result = await answerQueryDeep(query, env, cache, sessionContext, options);
    if (cacheKey && !noRetention) await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));
    return result;
  }

  const queryStart = Date.now();
  const trace: TraceStep[] = [];

  // First pass
  const { knowledge, pageTexts, queryType } = await singlePass(query, env, cache, trace, undefined, undefined, undefined, sessionContext, options);

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
      rephrasedQuery, env, cache, trace, pageTexts, "pass 2", undefined, undefined, options
    );

    // Pick whichever pass produced higher confidence
    const best = pass2.confidence > knowledge.confidence ? pass2 : knowledge;
    const other = pass2.confidence > knowledge.confidence ? knowledge : pass2;
    trace.push({
      step: "Select Best Result",
      duration_ms: 0,
      detail: `Pass ${pass2.confidence > knowledge.confidence ? "2" : "1"} selected (${Math.round(best.confidence * 100)}% vs ${Math.round(other.confidence * 100)}%)`,
    });

    // Multi-pass consistency check (SelfCheckGPT-inspired):
    // Compare claims across both passes. Claims confirmed by both passes
    // get a consistency boost; claims only in one pass get penalized.
    // Uses NLI entailment when available, falls back to token overlap.
    const consistencyStart = Date.now();
    const consistencyResult = checkMultiPassConsistency(
      best.claims,
      other.claims,
    );
    trace.push({
      step: "Consistency Check",
      duration_ms: Date.now() - consistencyStart,
      detail: `${consistencyResult.confirmedCount}/${best.claims.length} claims confirmed across passes`,
    });

    // Apply consistency adjustments to verification scores
    const adjustedClaims = best.claims.map((claim: any, i: number) => {
      const adjustment = consistencyResult.adjustments[i] ?? 0;
      if (!claim.verificationScore) return claim;
      const adjusted = Math.max(0, Math.min(1, claim.verificationScore + adjustment));
      return {
        ...claim,
        verificationScore: Math.round(adjusted * 100) / 100,
        // Downgrade consistency-failed claims
        verified: adjusted >= 0.2,
      };
    });

    // Adjust overall confidence based on consistency rate
    let adjustedConfidence = best.confidence;
    if (consistencyResult.consistencyRate < 0.3) {
      // Very low consistency — penalize heavily
      adjustedConfidence = Math.max(0.10, adjustedConfidence - 0.15);
    } else if (consistencyResult.consistencyRate > 0.7) {
      // High consistency — boost confidence
      adjustedConfidence = Math.min(0.97, adjustedConfidence + 0.05);
    }
    adjustedConfidence = Math.round(adjustedConfidence * 100) / 100;

    const result = { ...best, claims: adjustedClaims, confidence: adjustedConfidence, trace };
    if (cacheKey && !noRetention) await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));

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
  if (cacheKey && !noRetention) await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));

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
