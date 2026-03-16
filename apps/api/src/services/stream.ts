/**
 * Streaming answer pipeline — sends SSE events as each step completes.
 *
 * Event types:
 *   trace   — { step, duration_ms, detail } — pipeline progress
 *   sources — { sources } — discovered sources (sent early)
 *   token   — { text } — streamed answer token
 *   result  — full BrowseResult — final answer
 *   error   — { error } — on failure
 *
 * Supports all depth modes:
 *   fast     — single pass with streaming tokens
 *   thorough — fast pass + rephrase retry if confidence < 60%
 *   deep     — multi-step agentic research with gap analysis
 */

import { search } from "./search.js";
import type { SearchResult } from "./search.js";
import { openPage } from "./scrape.js";
import { streamAnswer, rephraseQuery, generateQueryVariant, analyzeQuery } from "../lib/gemini.js";
import type { QueryAnalysis } from "../lib/gemini.js";
import { braveSearch } from "../lib/brave.js";
import { rerankSources } from "../lib/verify.js";
import { getAdaptivePageCount } from "../lib/learning.js";
import { MAX_PAGE_CONTENT_LENGTH } from "@browse/shared";
import type { BrowseResult, TraceStep } from "@browse/shared";
import type { CacheService } from "./cache.js";
import type { Env } from "../config/env.js";
import {
  hashKey,
  getCacheTTL,
  filterLowQuality,
  enforceDomainDiversity,
  mergeSearchResults,
  ADAPTIVE_PAGE_COUNT,
} from "./searchUtils.js";

const THOROUGH_CONFIDENCE_THRESHOLD = 0.6;

export type SSEWriter = (event: string, data: unknown) => void;

/** Emit a trace step both to the trace array and the SSE stream. */
function emitTrace(trace: TraceStep[], emit: SSEWriter, step: TraceStep) {
  trace.push(step);
  emit("trace", step);
}


/**
 * Run a single streaming pass: search → fetch → stream answer → verify.
 * Returns knowledge + pageTexts for potential re-use by thorough mode.
 */
async function streamingSinglePass(
  query: string,
  env: Env,
  cache: CacheService,
  emit: SSEWriter,
  trace: TraceStep[],
  label?: string,
  existingPageTexts?: Map<string, string>,
) {
  const suffix = label ? ` (${label})` : "";

  // Phase 1: Search
  const searchStart = Date.now();
  emit("trace", { step: "Searching", duration_ms: 0, detail: `Querying search providers${suffix}...` });

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

  if (analysis.plan && analysis.plan.length > 0) {
    const planDetail = analysis.plan.map((p) => `[${p.intent}] ${p.query}`).join("; ");
    emitTrace(trace, emit, {
      step: `Query Plan${suffix}`,
      duration_ms: 0,
      detail: `${analysis.plan.length} sub-queries: ${planDetail}`,
    });
  }

  let allResults = mainResults.results;
  let searchDetail = "";

  if (braveResults.length > 0) {
    const before = allResults.length;
    allResults = mergeSearchResults(allResults, braveResults as SearchResult[]);
    const added = allResults.length - before;
    if (added > 0) searchDetail += ` +${added} Brave`;
  }

  if (variantQuery && variantQuery !== query) {
    try {
      const { results: variantResults } = await search(variantQuery, env.SERP_API_KEY, cache);
      const before = allResults.length;
      allResults = mergeSearchResults(allResults, variantResults);
      const added = allResults.length - before;
      if (added > 0) searchDetail += ` +${added} variant`;
    } catch {
      searchDetail += " (variant failed)";
    }
  }

  if (analysis.subQueries && analysis.subQueries.length > 0) {
    const subResults = await Promise.allSettled(
      analysis.subQueries.map((sq) => search(sq, env.SERP_API_KEY, cache))
    );
    for (const sr of subResults) {
      if (sr.status !== "fulfilled") continue;
      const before = allResults.length;
      allResults = mergeSearchResults(allResults, sr.value.results);
      const added = allResults.length - before;
      if (added > 0) searchDetail += ` +${added} sub-q`;
    }
  }

  const filtered = filterLowQuality(allResults);
  const diverseResults = enforceDomainDiversity(filtered);

  // Domain intelligence reranking (authority + usefulness + co-citation)
  let rerankedResults = rerankSources(diverseResults);

  // Neural re-rank (premium)
  let neuralLabel = "";
  if (env.HF_API_KEY && rerankedResults.length > 1) {
    const { crossEncoderRerank } = await import("../lib/reranker.js");
    const ceResult = await crossEncoderRerank(query, rerankedResults, env.HF_API_KEY);
    if (ceResult.reranked) {
      rerankedResults = ceResult.results;
      neuralLabel = " → neural";
    }
  }

  const pageCount = getAdaptivePageCount(analysis.type) || ADAPTIVE_PAGE_COUNT[analysis.type] || 8;

  emitTrace(trace, emit, {
    step: `Search Web${suffix}`,
    duration_ms: Date.now() - searchStart,
    detail: `${rerankedResults.length} results [${analysis.type}]${searchDetail}${neuralLabel}`,
  });

  if (rerankedResults.length === 0) {
    throw new Error("No search results found");
  }

  // Emit sources early
  emit("sources", rerankedResults.slice(0, pageCount).map((r) => ({ url: r.url, title: r.title })));

  // Phase 2: Fetch pages
  const scrapeStart = Date.now();
  emit("trace", { step: "Fetching", duration_ms: 0, detail: `Loading ${Math.min(pageCount, rerankedResults.length)} pages${suffix}...` });

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

  emitTrace(trace, emit, {
    step: `Fetch Pages${suffix}`,
    duration_ms: Date.now() - scrapeStart,
    detail: `${successfulPages.length} pages`,
  });

  // Build content
  const pageTexts = new Map<string, string>(existingPageTexts || []);
  const pageContents = successfulPages
    .map((entry, i) => {
      const url = entry.url;
      const content = entry.page.content.slice(0, MAX_PAGE_CONTENT_LENGTH);
      pageTexts.set(url, content);
      return `[Source ${i + 1}] URL: ${url}\nTitle: ${entry.page.title}\n\n${content}`;
    })
    .join("\n\n---\n\n");

  // Phase 3: Stream answer + extract claims + verify
  const llmStart = Date.now();
  emit("trace", { step: "Generating Answer", duration_ms: 0, detail: `Streaming answer${suffix}...` });

  // Track phase timings for real-time trace emission
  let phaseStart = Date.now();
  const phaseHandler = (phase: "extract_claims" | "verify_evidence" | "consensus" | "build_graph" | "done") => {
    const now = Date.now();
    const elapsed = now - phaseStart;
    phaseStart = now;

    switch (phase) {
      case "extract_claims":
        emitTrace(trace, emit, { step: `Generate Answer${suffix}`, duration_ms: elapsed, detail: "OpenRouter" });
        emit("trace", { step: "Analyzing", duration_ms: 0, detail: `Extracting claims${suffix}...` });
        break;
      case "verify_evidence":
        emitTrace(trace, emit, { step: `Extract Claims${suffix}`, duration_ms: elapsed, detail: "Structured extraction" });
        emit("trace", { step: "Analyzing", duration_ms: 0, detail: `Verifying evidence${suffix}...` });
        break;
      case "done": {
        emitTrace(trace, emit, { step: `Verify Evidence${suffix}`, duration_ms: elapsed, detail: "BM25 + consensus + authority" });
        break;
      }
    }
  };

  const knowledge = await streamAnswer(
    query, pageContents, env.OPENROUTER_API_KEY,
    (token) => emit("token", { text: token }),
    pageTexts, analysis.type, {
      hfApiKey: env.HF_API_KEY,
    },
    phaseHandler,
  );
  const llmDuration = Date.now() - llmStart;

  // Emit final summary steps (with actual claim/source counts now available)
  const verifiedCount = knowledge.claims.filter((c) => c.verified === true).length;
  const strongConsensus = knowledge.claims.filter(
    (c) => c.consensusLevel === "strong" || c.consensusLevel === "moderate"
  ).length;
  const contradictionCount = knowledge.contradictions?.length || 0;
  emitTrace(trace, emit, {
    step: `Cross-Source Consensus${suffix}`,
    duration_ms: 0,
    detail: `${strongConsensus}/${knowledge.claims.length} agreement${contradictionCount > 0 ? `, ${contradictionCount} contradiction${contradictionCount > 1 ? "s" : ""}` : ""}`,
  });
  emitTrace(trace, emit, { step: `Build Evidence Graph${suffix}`, duration_ms: 0, detail: `${knowledge.sources.length} sources` });

  return { knowledge, pageTexts, queryType: analysis.type };
}

/**
 * Run the answer pipeline with streaming progress events.
 * Supports fast, thorough, and deep depth modes.
 */
export async function answerQueryStreaming(
  query: string,
  env: Env,
  cache: CacheService,
  emit: SSEWriter,
  depth: "fast" | "thorough" | "deep" = "fast",
): Promise<BrowseResult> {
  // Check cache first (includes depth in key)
  const cacheKey = `answer:${depth}:${hashKey(query)}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    const result = JSON.parse(cached) as BrowseResult;
    result.trace = [{ step: "Cache Hit", duration_ms: 0, detail: "Served from cache" }, ...result.trace];
    emit("trace", { step: "Cache Hit", duration_ms: 0, detail: "Served from cache" });
    emit("result", result);
    return result;
  }

  // Deep mode: delegate to deep reasoning agent with SSE emit
  if (depth === "deep") {
    const { answerQueryDeep } = await import("./deep.js");
    const result = await answerQueryDeep(query, env, cache, undefined, undefined, (event, data) => {
      emit(event, data);
      // Stream tokens are not available in deep mode (uses extractKnowledge, not streamAnswer)
      // but trace + reasoning_step events flow through
    });
    await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));
    emit("result", result);
    return result;
  }

  const trace: TraceStep[] = [];

  // First pass (with streaming tokens)
  const { knowledge, pageTexts } = await streamingSinglePass(
    query, env, cache, emit, trace,
  );

  // Thorough mode: if confidence is low, rephrase and do a second pass
  if (depth === "thorough" && knowledge.confidence < THOROUGH_CONFIDENCE_THRESHOLD) {
    const rephraseStart = Date.now();
    emit("trace", { step: "Analyzing", duration_ms: 0, detail: "Low confidence — rephrasing query..." });

    const rephrasedQuery = await rephraseQuery(query, env.OPENROUTER_API_KEY);
    emitTrace(trace, emit, {
      step: "Rephrase Query",
      duration_ms: Date.now() - rephraseStart,
      detail: `"${rephrasedQuery.slice(0, 80)}"`,
    });

    // Second pass with rephrased query
    const { knowledge: pass2 } = await streamingSinglePass(
      rephrasedQuery, env, cache, emit, trace, "pass 2", pageTexts,
    );

    // Pick whichever pass produced higher confidence
    const best = pass2.confidence > knowledge.confidence ? pass2 : knowledge;
    const other = pass2.confidence > knowledge.confidence ? knowledge : pass2;
    emitTrace(trace, emit, {
      step: "Select Best Result",
      duration_ms: 0,
      detail: `Pass ${pass2.confidence > knowledge.confidence ? "2" : "1"} selected (${Math.round(best.confidence * 100)}% vs ${Math.round(other.confidence * 100)}%)`,
    });

    const result: BrowseResult = { ...best, trace };
    await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));
    emit("result", result);
    return result;
  }

  // Fast mode: single pass is done
  const result: BrowseResult = { ...knowledge, trace };
  await cache.set(cacheKey, JSON.stringify(result), getCacheTTL(query));
  emit("result", result);
  return result;
}
