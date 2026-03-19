import { search } from "./search.js";
import type { SearchResult } from "./search.js";
import { openPage } from "./scrape.js";
import { extractKnowledge, rephraseQuery, generateQueryVariant, analyzeQuery, generateClaimQueries, generateCounterQueries } from "../lib/gemini.js";
import type { QueryAnalysis } from "../lib/gemini.js";
import { braveSearch } from "../lib/brave.js";
import { exaSearch } from "../lib/exa.js";
import { rerankSources, trackSourceUsefulness } from "../lib/verify.js";
import { crossEncoderRerank } from "../lib/reranker.js";
import {
  getAdaptiveBM25Threshold,
  getAdaptiveConsensusThreshold,
  getAdaptivePageCount,
  getAdaptiveWeights,
  recordQuerySignals,
} from "../lib/learning.js";
import { MAX_PAGE_CONTENT_LENGTH } from "@browse/shared";
import type { BrowseResult, BrowseClaim, TraceStep } from "@browse/shared";
import type { CacheService } from "./cache.js";
import type { Env } from "../config/env.js";
import type { SearchProvider } from "../lib/searchProvider.js";
import {
  hashKey,
  getCacheTTL,
  filterLowQuality,
  enforceDomainDiversity,
  mergeSearchResults,
  ADAPTIVE_PAGE_COUNT,
  MAX_PER_DOMAIN,
} from "./searchUtils.js";

// ─── Cached Secondary Search Wrappers ──────────────────────────────
// Brave and Exa results are cached so refreshes/retries don't waste API credits.

async function cachedBraveSearch(
  query: string,
  apiKey: string,
  cache: CacheService,
): Promise<SearchResult[]> {
  const cacheKey = `brave:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const results = await braveSearch(query, apiKey);
  const mapped: SearchResult[] = results.map((r) => ({
    url: r.url, title: r.title, snippet: r.description, score: r.score,
  }));
  await cache.set(cacheKey, JSON.stringify(mapped), 600);
  return mapped;
}

async function cachedExaSearch(
  query: string,
  apiKey: string,
  cache: CacheService,
): Promise<SearchResult[]> {
  const cacheKey = `exa:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const results = await exaSearch(query, apiKey);
  const mapped: SearchResult[] = results.map((r) => ({
    url: r.url, title: r.title, snippet: r.snippet, score: r.score,
  }));
  await cache.set(cacheKey, JSON.stringify(mapped), 600);
  return mapped;
}

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

// ─── Per-Claim Evidence Retrieval (SAFE-inspired) ──────────────────
// After initial verification, weak claims get targeted search queries.
// New evidence is used to re-verify only those claims, boosting accuracy.

async function perClaimRetrieval(
  claims: BrowseClaim[],
  env: Env,
  cache: CacheService,
  pageTexts: Map<string, string>,
  trace: TraceStep[],
): Promise<{ updatedClaims: BrowseClaim[]; newPageTexts: Map<string, string> }> {
  const start = Date.now();

  // Generate targeted search queries for weak claims
  const claimQueries = await generateClaimQueries(claims, env.OPENROUTER_API_KEY);
  const queriesNeeded = claimQueries.filter((q) => q !== null) as Array<{ claim: string; query: string }>;

  if (queriesNeeded.length === 0) {
    return { updatedClaims: claims, newPageTexts: pageTexts };
  }

  // Search for evidence (using cached searches, limit to 5 concurrent)
  const searchPromises = queriesNeeded.slice(0, 5).map(async (cq) => {
    const results: SearchResult[] = [];
    // Use all available providers for targeted claim searches
    const searches = [
      search(cq.query, env.SERP_API_KEY, cache).then((r) => r.results).catch(() => []),
    ];
    if (env.BRAVE_API_KEY) {
      searches.push(cachedBraveSearch(cq.query, env.BRAVE_API_KEY, cache).catch(() => []));
    }
    if (env.EXA_API_KEY) {
      searches.push(cachedExaSearch(cq.query, env.EXA_API_KEY, cache).catch(() => []));
    }
    const allResults = await Promise.all(searches);
    for (const r of allResults) results.push(...r);
    return { claim: cq.claim, results: mergeSearchResults(results, []) };
  });

  const searchResults = await Promise.all(searchPromises);

  // For each weak claim, check if new search results contain supporting evidence
  // using snippet text (lightweight — no page fetch needed)
  const updatedClaims = claims.map((claim) => {
    const match = searchResults.find((sr) => sr.claim === claim.claim);
    if (!match || match.results.length === 0) return claim;

    // Check if any snippet semantically matches the claim (simple keyword overlap)
    const claimTokens = new Set(
      claim.claim.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 3)
    );
    let bestSnippetOverlap = 0;
    let bestSnippetUrl = "";

    for (const result of match.results.slice(0, 5)) {
      const snippetTokens = result.snippet.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/);
      const overlap = snippetTokens.filter((t) => claimTokens.has(t)).length / Math.max(claimTokens.size, 1);
      if (overlap > bestSnippetOverlap) {
        bestSnippetOverlap = overlap;
        bestSnippetUrl = result.url;
      }
    }

    // If strong snippet match found, boost the claim
    if (bestSnippetOverlap >= 0.3) {
      const newScore = Math.min(1, (claim.verificationScore || 0) + 0.15);
      const newSources = [...(claim.sources || [])];
      if (bestSnippetUrl && !newSources.includes(bestSnippetUrl)) {
        newSources.push(bestSnippetUrl);
      }
      return {
        ...claim,
        verified: newScore >= 0.2,
        verificationScore: Math.round(newScore * 100) / 100,
        sources: newSources,
      };
    }

    return claim;
  });

  const boostedCount = updatedClaims.filter(
    (c, i) => (c.verificationScore || 0) > (claims[i].verificationScore || 0)
  ).length;

  trace.push({
    step: "Per-Claim Retrieval",
    duration_ms: Date.now() - start,
    detail: `${queriesNeeded.length} targeted searches → ${boostedCount} claims boosted`,
  });

  return { updatedClaims, newPageTexts: pageTexts };
}

// ─── Counter-Query Verification (SANCTUARY-inspired) ───────────────
// Actively searches for evidence that CONTRADICTS verified claims.
// If contradictions found via adversarial search, confidence is lowered.

async function counterQueryVerification(
  claims: BrowseClaim[],
  env: Env,
  cache: CacheService,
  trace: TraceStep[],
): Promise<{ adjustedClaims: BrowseClaim[]; newContradictions: number }> {
  const start = Date.now();

  const counterQueries = await generateCounterQueries(claims, env.OPENROUTER_API_KEY);
  const needed = counterQueries.filter((q) => q !== null) as Array<{ claim: string; counterQuery: string }>;

  if (needed.length === 0) {
    return { adjustedClaims: claims, newContradictions: 0 };
  }

  // Search for counter-evidence
  const counterSearches = needed.slice(0, 3).map(async (cq) => {
    const results = await search(cq.counterQuery, env.SERP_API_KEY, cache)
      .then((r) => r.results)
      .catch(() => [] as SearchResult[]);
    return { claim: cq.claim, results };
  });

  const counterResults = await Promise.all(counterSearches);
  let newContradictions = 0;

  // Check if counter-evidence snippets actually contradict the claim
  const adjustedClaims = claims.map((claim) => {
    const match = counterResults.find((cr) => cr.claim === claim.claim);
    if (!match || match.results.length === 0) return claim;

    // Look for strong negation signals in counter-search snippets
    const NEGATION_TERMS = new Set([
      "not", "false", "incorrect", "wrong", "myth", "debunked",
      "misleading", "inaccurate", "contrary", "disproven", "untrue",
      "no longer", "outdated", "revised", "corrected", "retracted",
    ]);

    let contradictionSignals = 0;
    for (const result of match.results.slice(0, 3)) {
      const words = result.snippet.toLowerCase().split(/\s+/);
      const negations = words.filter((w) => NEGATION_TERMS.has(w)).length;
      if (negations >= 2) contradictionSignals++;
    }

    // If multiple counter-sources have negation signals, penalize
    if (contradictionSignals >= 2) {
      newContradictions++;
      const penalizedScore = Math.max(0, (claim.verificationScore || 0.5) - 0.15);
      return {
        ...claim,
        verificationScore: Math.round(penalizedScore * 100) / 100,
        verified: penalizedScore >= 0.2,
      };
    }

    return claim;
  });

  trace.push({
    step: "Counter-Query Verification",
    duration_ms: Date.now() - start,
    detail: `${needed.length} adversarial searches → ${newContradictions} new contradictions found`,
  });

  return { adjustedClaims, newContradictions };
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

  // Build secondary search promises (Brave + Exa run in parallel with primary)
  // All secondary searches are cached to avoid wasting API credits on refresh/retry
  const secondarySearch: Promise<SearchResult[]> =
    options?.secondaryProvider
      ? options.secondaryProvider.search(query).catch(() => [])
      : (!useProvider && env.BRAVE_API_KEY)
        ? cachedBraveSearch(query, env.BRAVE_API_KEY, cache).catch(() => [])
        : Promise.resolve([]);

  // Exa: neural/semantic search — finds conceptually related pages keyword engines miss
  const tertiarySearch: Promise<SearchResult[]> =
    (!useProvider && env.EXA_API_KEY)
      ? cachedExaSearch(query, env.EXA_API_KEY, cache).catch(() => [])
      : Promise.resolve([]);

  const parallelTasks: [
    Promise<{ results: SearchResult[]; cached: boolean }>,
    Promise<string>,
    Promise<QueryAnalysis>,
    Promise<SearchResult[]>,
    Promise<SearchResult[]>,
  ] = [
    doSearch(query, useProvider, env.SERP_API_KEY, cache),
    generateQueryVariant(query, env.OPENROUTER_API_KEY),
    preAnalysis ? Promise.resolve(preAnalysis) : analyzeQuery(query, env.OPENROUTER_API_KEY),
    secondarySearch,
    tertiarySearch,
  ];

  const [mainResults, variantQuery, analysis, braveResults, exaResults] = await Promise.all(parallelTasks);

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

  // Merge Exa results (neural/semantic search)
  if (exaResults.length > 0) {
    const before = allResults.length;
    allResults = mergeSearchResults(allResults, exaResults);
    const added = allResults.length - before;
    if (added > 0) searchDetail += ` +${added} Exa`;
  }

  // Merge variant results (non-fatal — don't crash if variant search fails)
  if (variantQuery && variantQuery !== query) {
    try {
      const { results: variantResults } = await doSearch(variantQuery, useProvider, env.SERP_API_KEY, cache);
      const before = allResults.length;
      allResults = mergeSearchResults(allResults, variantResults);
      const added = allResults.length - before;
      if (added > 0) searchDetail += ` +${added} variant`;
    } catch (e) {
      // Variant search failed — continue with main results
      console.warn("Variant search failed:", e instanceof Error ? e.message : e);
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

  // Build content + merge page texts + collect publication dates
  const pageTexts = new Map<string, string>(existingPageTexts || []);
  const pageDates = new Map<string, string>();
  const pageContents = successfulPages
    .map((entry, i) => {
      const url = entry.url;
      const content = entry.page.content.slice(0, MAX_PAGE_CONTENT_LENGTH);
      pageTexts.set(url, content);
      if (entry.page.publishedDate) pageDates.set(url, entry.page.publishedDate);
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
    embeddingApiKey: env.HF_API_KEY ? env.OPENROUTER_API_KEY : undefined,
  };
  const knowledge = await extractKnowledge(query, pageContents, env.OPENROUTER_API_KEY, pageTexts, analysis.type, sessionContext, adaptiveOptions, pageDates);
  const llmDuration = Date.now() - llmStart;

  // Trace steps
  const verifiedCount = knowledge.claims.filter((c) => c.verified === true).length;
  const strongConsensus = knowledge.claims.filter(
    (c) => c.consensusLevel === "strong" || c.consensusLevel === "moderate"
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
        if (claim.verified) existing.verified = true;
        if (claim.consensusLevel === "strong" || claim.consensusLevel === "moderate") existing.consensus = true;
        domainUseful.set(d, existing);
      }
    }
    for (const [domain, u] of domainUseful) {
      trackSourceUsefulness(domain, u.verified, u.consensus);
    }
  } catch (e) { console.warn("Failed to track source usefulness:", e instanceof Error ? e.message : e); }

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
  const isPremium = !!env.HF_API_KEY; // Premium tier has enhanced verification

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

  // ── Enhanced Verification (premium only) ──
  // Per-claim retrieval + counter-query verification run in parallel
  // These are the SAFE-inspired and SANCTUARY-inspired upgrades
  let enhancedClaims = knowledge.claims;
  let extraContradictions = 0;

  if (isPremium && knowledge.claims.length > 0) {
    const [claimResult, counterResult] = await Promise.all([
      perClaimRetrieval(knowledge.claims, env, cache, pageTexts, trace).catch(() => ({
        updatedClaims: knowledge.claims,
        newPageTexts: pageTexts,
      })),
      counterQueryVerification(knowledge.claims, env, cache, trace).catch(() => ({
        adjustedClaims: knowledge.claims,
        newContradictions: 0,
      })),
    ]);

    // Merge: per-claim boosted scores + counter-query penalized scores
    enhancedClaims = knowledge.claims.map((claim, i) => {
      const boosted = claimResult.updatedClaims[i];
      const countered = counterResult.adjustedClaims[i];

      // Take the best verification score from per-claim retrieval,
      // but apply any penalty from counter-query verification
      const boostDelta = (boosted.verificationScore || 0) - (claim.verificationScore || 0);
      const counterDelta = (countered.verificationScore || 0) - (claim.verificationScore || 0);

      const newScore = Math.max(0, Math.min(1, (claim.verificationScore || 0) + boostDelta + counterDelta));
      const newSources = [...new Set([...(claim.sources || []), ...(boosted.sources || [])])];

      return {
        ...claim,
        verificationScore: Math.round(newScore * 100) / 100,
        verified: newScore >= 0.2,
        sources: newSources,
      };
    });

    extraContradictions = counterResult.newContradictions;
  }

  // ── Thorough Mode: Iterative Confidence-Gated Loop (FIRE-inspired) ──
  // Instead of a single retry, loop up to MAX_ITERATIONS:
  //   verify → if weak claims remain → generate targeted query → search → re-verify
  // Early termination when confidence meets threshold or queries repeat
  if (depth === "thorough" && knowledge.confidence < THOROUGH_CONFIDENCE_THRESHOLD) {
    const MAX_ITERATIONS = 3;
    let bestKnowledge = { ...knowledge, claims: enhancedClaims };
    let currentPageTexts = pageTexts;
    const previousQueries = new Set<string>([query]);

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      const iterStart = Date.now();

      // Generate rephrased query targeting weak claims
      const weakClaims = bestKnowledge.claims.filter(
        (c) => !c.verified || (c.verificationScore !== undefined && c.verificationScore < 0.4)
      );

      if (weakClaims.length === 0) {
        trace.push({
          step: "Iteration Stop",
          duration_ms: 0,
          detail: `All claims verified — stopping at iteration ${iteration}`,
        });
        break;
      }

      const rephrasedQuery = await rephraseQuery(query, env.OPENROUTER_API_KEY);

      // Early termination: if rephrased query is too similar to previous ones
      const normalizedRephrase = rephrasedQuery.toLowerCase().trim();
      let tooSimilar = false;
      for (const prev of previousQueries) {
        const tokens1 = new Set(normalizedRephrase.split(/\s+/));
        const tokens2 = new Set(prev.toLowerCase().trim().split(/\s+/));
        const intersection = [...tokens1].filter((t) => tokens2.has(t)).length;
        const similarity = intersection / Math.max(tokens1.size, tokens2.size, 1);
        if (similarity > 0.8) { tooSimilar = true; break; }
      }

      if (tooSimilar) {
        trace.push({
          step: "Iteration Stop",
          duration_ms: Date.now() - iterStart,
          detail: `Query too similar to previous — stopping at iteration ${iteration}`,
        });
        break;
      }

      previousQueries.add(normalizedRephrase);

      trace.push({
        step: `Rephrase Query (iter ${iteration})`,
        duration_ms: Date.now() - iterStart,
        detail: `"${rephrasedQuery.slice(0, 80)}" — ${weakClaims.length} weak claims`,
      });

      // New pass with rephrased query
      const { knowledge: passN } = await singlePass(
        rephrasedQuery, env, cache, trace, currentPageTexts, `pass ${iteration + 1}`, undefined, undefined, options
      );

      // Pick whichever pass produced higher confidence
      const best = passN.confidence > bestKnowledge.confidence ? passN : bestKnowledge;
      const other = passN.confidence > bestKnowledge.confidence ? bestKnowledge : passN;

      trace.push({
        step: `Select Best (iter ${iteration})`,
        duration_ms: 0,
        detail: `${Math.round(best.confidence * 100)}% vs ${Math.round(other.confidence * 100)}%`,
      });

      // Multi-pass consistency check
      const consistencyResult = checkMultiPassConsistency(best.claims, other.claims);
      trace.push({
        step: `Consistency (iter ${iteration})`,
        duration_ms: 0,
        detail: `${consistencyResult.confirmedCount}/${best.claims.length} confirmed`,
      });

      // Apply consistency adjustments
      const adjustedClaims = best.claims.map((claim, i) => {
        const adjustment = consistencyResult.adjustments[i] ?? 0;
        if (!claim.verificationScore) return claim;
        const adjusted = Math.max(0, Math.min(1, claim.verificationScore + adjustment));
        return {
          ...claim,
          verificationScore: Math.round(adjusted * 100) / 100,
          verified: adjusted >= 0.2,
        };
      });

      let adjustedConfidence = best.confidence;
      if (consistencyResult.consistencyRate < 0.3) {
        adjustedConfidence = Math.max(0.10, adjustedConfidence - 0.15);
      } else if (consistencyResult.consistencyRate > 0.7) {
        adjustedConfidence = Math.min(0.97, adjustedConfidence + 0.05);
      }

      bestKnowledge = { ...best, claims: adjustedClaims, confidence: Math.round(adjustedConfidence * 100) / 100 };

      // Stop if we've reached good confidence
      if (bestKnowledge.confidence >= THOROUGH_CONFIDENCE_THRESHOLD) {
        trace.push({
          step: "Iteration Stop",
          duration_ms: 0,
          detail: `Confidence ${Math.round(bestKnowledge.confidence * 100)}% ≥ ${THOROUGH_CONFIDENCE_THRESHOLD * 100}% — stopping`,
        });
        break;
      }
    }

    // Apply counter-query penalties to final contradictions count
    const totalContradictions = (bestKnowledge.contradictions?.length || 0) + extraContradictions;
    const result = { ...bestKnowledge, trace };
    if (cacheKey && !noRetention) await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));

    // Record learning signals (fire-and-forget)
    try {
      recordQuerySignals({
        queryType: queryType,
        confidence: result.confidence,
        verificationRate: result.claims.filter((c) => c.verified).length / Math.max(result.claims.length, 1),
        consensusScore: result.claims.filter((c) => c.consensusLevel === "strong" || c.consensusLevel === "moderate").length / Math.max(result.claims.length, 1),
        sourceCount: result.sources.length,
        claimCount: result.claims.length,
        contradictionCount: totalContradictions,
        responseTimeMs: Date.now() - queryStart,
        depth: "thorough",
        thoroughImproved: result.confidence > knowledge.confidence,
      });
    } catch (e) { console.warn("Failed to record thorough-mode learning signals:", e instanceof Error ? e.message : e); }

    return result;
  }

  // Fast mode: apply enhanced claims if premium
  const finalClaims = isPremium ? enhancedClaims : knowledge.claims;
  const result = { ...knowledge, claims: finalClaims, trace };
  if (cacheKey && !noRetention) await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));

  // Record learning signals (fire-and-forget)
  try {
    recordQuerySignals({
      queryType: queryType,
      confidence: result.confidence,
      verificationRate: result.claims.filter((c) => c.verified).length / Math.max(result.claims.length, 1),
      consensusScore: result.claims.filter((c) => c.consensusLevel === "strong" || c.consensusLevel === "moderate").length / Math.max(result.claims.length, 1),
      sourceCount: result.sources.length,
      claimCount: result.claims.length,
      contradictionCount: (result.contradictions?.length || 0) + extraContradictions,
      responseTimeMs: Date.now() - queryStart,
      depth,
    });
  } catch (e) { console.warn("Failed to record learning signals:", e instanceof Error ? e.message : e); }

  return result;
}
